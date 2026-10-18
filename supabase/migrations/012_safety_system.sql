alter table public.meeting_sessions add column if not exists place_is_public_verified boolean not null default false;
alter table public.meeting_sessions add column if not exists started_at timestamptz;
alter table public.meeting_sessions add column if not exists ended_at timestamptz;
alter table public.meeting_sessions add column if not exists guardian_approval_required boolean not null default false;
alter table public.meeting_sessions add column if not exists place_categories text[] not null default '{}';

alter table public.guardian_links add column if not exists contact_confirmed_at timestamptz;
alter table public.guardian_links add column if not exists token_expires_at timestamptz;
alter table public.guardian_links add column if not exists verification_provider text;
alter table public.guardian_links add column if not exists verification_reference text;

create table public.guardian_meeting_approvals (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meeting_sessions(id) on delete cascade,
  minor_user_id uuid not null references public.profiles(id) on delete cascade,
  guardian_link_id uuid not null references public.guardian_links(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','approved','change_requested','revoked','expired')),
  guardian_message text,
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index guardian_meeting_approvals_meeting_idx on public.guardian_meeting_approvals(meeting_id,status);
create index guardian_meeting_approvals_minor_idx on public.guardian_meeting_approvals(minor_user_id,created_at desc);

alter table public.guardian_share_sessions add column if not exists started_at timestamptz not null default now();
alter table public.guardian_share_sessions add column if not exists last_accessed_at timestamptz;
alter table public.reports add column if not exists evidence_path text;

alter table public.guardian_meeting_approvals enable row level security;

create policy "guardian_approval_minor_read"
on public.guardian_meeting_approvals
for select
to authenticated
using (minor_user_id=auth.uid());

create or replace function public.has_verified_guardian(target_minor uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.guardian_links gl where gl.minor_user_id=target_minor and gl.status='verified');
$$;

create or replace function public.set_visibility(new_visibility text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if new_visibility not in ('visible','connections','invisible') then raise exception 'Invalid visibility'; end if;
  update public.privacy_settings set visibility=new_visibility,updated_at=now() where user_id=auth.uid();
  update public.user_presence set visible=new_visibility<>'invisible',updated_at=now() where user_id=auth.uid();
end;
$$;

create or replace function public.can_see_map_presence(viewer uuid,target uuid)
returns boolean language plpgsql stable security definer set search_path=public
as $$
declare target_visibility text;
begin
  if viewer=target then return true; end if;
  if not public.can_socially_interact(viewer,target) then return false; end if;
  select visibility into target_visibility from public.privacy_settings where user_id=target;
  if target_visibility='invisible' then return false; end if;
  if target_visibility='connections' then return public.are_connected(viewer,target); end if;
  return true;
end;
$$;

drop policy if exists "presence_read_allowed" on public.user_presence;
create policy "presence_read_allowed"
on public.user_presence
for select
to authenticated
using(user_id=auth.uid() or public.can_see_map_presence(auth.uid(),user_id));

create or replace function public.service_create_meeting_from_activity(
  p_creator uuid,
  p_activity_id uuid,
  p_expected_end_at timestamptz,
  p_place_provider text,
  p_place_id text,
  p_place_name text,
  p_place_address text,
  p_place_lat double precision,
  p_place_lng double precision,
  p_place_categories text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_record public.activities%rowtype;
  new_meeting uuid;
  minor_count integer;
begin
  select * into activity_record from public.activities where id=p_activity_id;
  if activity_record.id is null then raise exception 'Activity unavailable'; end if;
  if activity_record.creator_id<>p_creator then raise exception 'Only activity creator can prepare meeting'; end if;
  if activity_record.starts_at is null then raise exception 'Activity schedule required'; end if;
  if p_expected_end_at<=activity_record.starts_at then raise exception 'Invalid expected end'; end if;
  if p_expected_end_at>activity_record.starts_at+interval '24 hours' then raise exception 'Meeting too long'; end if;

  select count(*) into minor_count
  from public.activity_members am
  where am.activity_id=p_activity_id and am.status='confirmed' and public.is_minor(am.user_id);

  insert into public.meeting_sessions(
    creator_id,activity_id,scheduled_at,expected_end_at,place_provider,place_id,place_name,place_address,place_lat,place_lng,place_categories,place_is_public_verified,guardian_approval_required,status
  ) values(
    p_creator,p_activity_id,activity_record.starts_at,p_expected_end_at,p_place_provider,p_place_id,p_place_name,p_place_address,p_place_lat,p_place_lng,coalesce(p_place_categories,'{}'::text[]),true,minor_count>0,'preparing'
  ) returning id into new_meeting;

  insert into public.meeting_participants(meeting_id,user_id,status)
  select new_meeting,am.user_id,'confirmed' from public.activity_members am where am.activity_id=p_activity_id and am.status='confirmed';

  insert into public.meeting_verifications(meeting_id,user_id,status)
  select new_meeting,am.user_id,'pending' from public.activity_members am where am.activity_id=p_activity_id and am.status='confirmed';

  insert into public.security_events(user_id,event_type,meeting_id,metadata)
  values(p_creator,'meeting_created',new_meeting,jsonb_build_object('place',p_place_name));

  return new_meeting;
end;
$$;

revoke all on function public.service_create_meeting_from_activity(uuid,uuid,timestamptz,text,text,text,text,double precision,double precision,text[]) from public;
revoke all on function public.service_create_meeting_from_activity(uuid,uuid,timestamptz,text,text,text,text,double precision,double precision,text[]) from authenticated;
grant execute on function public.service_create_meeting_from_activity(uuid,uuid,timestamptz,text,text,text,text,double precision,double precision,text[]) to service_role;

create or replace function public.get_meeting_room(target_meeting uuid)
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare
  current_user_id uuid; meeting_record public.meeting_sessions%rowtype; total_participants integer; verified_participants integer; total_minors integer; approved_minors integer; current_is_minor boolean; current_guardian uuid; result jsonb;
begin
  current_user_id:=auth.uid(); if current_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.is_meeting_participant(target_meeting,current_user_id) then raise exception 'Meeting unavailable'; end if;
  select * into meeting_record from public.meeting_sessions where id=target_meeting; if meeting_record.id is null then raise exception 'Meeting unavailable'; end if;
  select count(*) into total_participants from public.meeting_participants where meeting_id=target_meeting and status not in('cancelled');
  select count(*) into verified_participants from public.meeting_verifications where meeting_id=target_meeting and status='verified';
  select count(*) into total_minors from public.meeting_participants mp where mp.meeting_id=target_meeting and mp.status<>'cancelled' and public.is_minor(mp.user_id);
  select count(distinct gma.minor_user_id) into approved_minors from public.guardian_meeting_approvals gma where gma.meeting_id=target_meeting and gma.status='approved' and gma.expires_at>now();
  current_is_minor:=public.is_minor(current_user_id);
  if current_is_minor then select gl.id into current_guardian from public.guardian_links gl where gl.minor_user_id=current_user_id and gl.status='verified' order by gl.verified_at desc limit 1; end if;
  result:=jsonb_build_object('id',meeting_record.id,'creator_id',meeting_record.creator_id,'activity_id',meeting_record.activity_id,'scheduled_at',meeting_record.scheduled_at,'expected_end_at',meeting_record.expected_end_at,'started_at',meeting_record.started_at,'status',meeting_record.status,'place',jsonb_build_object('name',meeting_record.place_name,'address',meeting_record.place_address,'lat',meeting_record.place_lat,'lng',meeting_record.place_lng,'verified_public',meeting_record.place_is_public_verified),'participant_count',total_participants,'verified_count',verified_participants,'minor_count',total_minors,'guardian_approved_count',approved_minors,'current_user_is_minor',current_is_minor,'current_guardian_link_id',current_guardian,'all_ready',(meeting_record.place_is_public_verified and total_participants>0 and verified_participants=total_participants and approved_minors=total_minors),'participants',(select coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'name',p.name,'avatar_url',p.avatar_url,'verified_identity',(mv.status='verified'),'meeting_status',mp.status,'is_minor',public.is_minor(p.id)) order by p.name),'[]'::jsonb) from public.meeting_participants mp join public.profiles p on p.id=mp.user_id left join public.meeting_verifications mv on mv.meeting_id=mp.meeting_id and mv.user_id=mp.user_id where mp.meeting_id=target_meeting and mp.status<>'cancelled'));
  return result;
end;
$$;
grant execute on function public.get_meeting_room(uuid) to authenticated;

create or replace function public.start_meeting(target_meeting uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare meeting_record public.meeting_sessions%rowtype; total_participants integer; verified_participants integer; total_minors integer; approved_minors integer;
begin
  select * into meeting_record from public.meeting_sessions where id=target_meeting for update;
  if meeting_record.id is null then raise exception 'Meeting unavailable'; end if;
  if meeting_record.creator_id<>auth.uid() then raise exception 'Only creator can start meeting'; end if;
  if meeting_record.status not in('preparing','ready') then raise exception 'Meeting cannot be started'; end if;
  if not meeting_record.place_is_public_verified then raise exception 'Public place required'; end if;
  select count(*) into total_participants from public.meeting_participants where meeting_id=target_meeting and status<>'cancelled';
  select count(*) into verified_participants from public.meeting_verifications where meeting_id=target_meeting and status='verified';
  if total_participants<>verified_participants then raise exception 'Identity verification incomplete'; end if;
  select count(*) into total_minors from public.meeting_participants where meeting_id=target_meeting and status<>'cancelled' and public.is_minor(user_id);
  select count(distinct minor_user_id) into approved_minors from public.guardian_meeting_approvals where meeting_id=target_meeting and status='approved' and expires_at>now();
  if total_minors<>approved_minors then raise exception 'Guardian approval incomplete'; end if;
  update public.meeting_sessions set status='active',started_at=now(),updated_at=now() where id=target_meeting;
  insert into public.security_events(user_id,event_type,meeting_id) values(auth.uid(),'meeting_started',target_meeting);
end;
$$;
grant execute on function public.start_meeting(uuid) to authenticated;

create or replace function public.meeting_checkin(target_meeting uuid,checkin_type text)
returns void language plpgsql security definer set search_path=public
as $$
declare meeting_status text;
begin
  if not public.is_meeting_participant(target_meeting,auth.uid()) then raise exception 'Not allowed'; end if;
  if checkin_type not in ('on_the_way','arrived','safe','want_to_leave','need_help','finished') then raise exception 'Invalid checkin'; end if;
  select status into meeting_status from public.meeting_sessions where id=target_meeting;
  if checkin_type in ('safe','want_to_leave','need_help','finished') and meeting_status<>'active' then raise exception 'Meeting is not active'; end if;
  insert into public.meeting_checkins(meeting_id,user_id,type) values(target_meeting,auth.uid(),checkin_type);
  update public.meeting_participants set status=case when checkin_type='on_the_way' then 'on_the_way' when checkin_type='arrived' then 'arrived' when checkin_type='finished' then 'left' else status end where meeting_id=target_meeting and user_id=auth.uid();
  if checkin_type='need_help' then insert into public.security_events(user_id,event_type,meeting_id,metadata) values(auth.uid(),'meeting_help_requested',target_meeting,jsonb_build_object('priority','high')); end if;
end;
$$;
grant execute on function public.meeting_checkin(uuid,text) to authenticated;

create or replace function public.complete_meeting(target_meeting uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.meeting_sessions where id=target_meeting and creator_id=auth.uid() and status='active') then raise exception 'Meeting unavailable'; end if;
  update public.meeting_sessions set status='completed',ended_at=now(),updated_at=now() where id=target_meeting;
  update public.guardian_share_sessions set revoked_at=now() where meeting_id=target_meeting and revoked_at is null;
  insert into public.security_events(user_id,event_type,meeting_id) values(auth.uid(),'meeting_completed',target_meeting);
end;
$$;
grant execute on function public.complete_meeting(uuid) to authenticated;

create or replace function public.service_guardian_share_snapshot(p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare session_record public.guardian_share_sessions%rowtype; location_lat double precision; location_lng double precision; location_accuracy double precision; location_time timestamptz; meeting_record public.meeting_sessions%rowtype; minor_name text; latest_checkin_type text; latest_checkin_at timestamptz;
begin
 select * into session_record from public.guardian_share_sessions where token_hash=p_token_hash and revoked_at is null and expires_at>now(); if session_record.id is null then return null; end if;
 select st_y(location::geometry),st_x(location::geometry),accuracy,updated_at into location_lat,location_lng,location_accuracy,location_time from public.user_locations_private where user_id=session_record.minor_user_id;
 select * into meeting_record from public.meeting_sessions where id=session_record.meeting_id;
 select name into minor_name from public.profiles where id=session_record.minor_user_id;
 select type,created_at into latest_checkin_type,latest_checkin_at from public.meeting_checkins where meeting_id=session_record.meeting_id and user_id=session_record.minor_user_id order by created_at desc limit 1;
 return jsonb_build_object('display_name',minor_name,'meeting_status',meeting_record.status,'place_name',meeting_record.place_name,'place_address',meeting_record.place_address,'expected_end_at',meeting_record.expected_end_at,'session_started_at',session_record.started_at,'session_expires_at',session_record.expires_at,'latitude',location_lat,'longitude',location_lng,'accuracy',location_accuracy,'location_updated_at',location_time,'latest_checkin',latest_checkin_type,'latest_checkin_at',latest_checkin_at);
end;
$$;
revoke all on function public.service_guardian_share_snapshot(text) from public;
revoke all on function public.service_guardian_share_snapshot(text) from authenticated;
grant execute on function public.service_guardian_share_snapshot(text) to service_role;

create or replace function public.block_user(target_user uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if target_user=auth.uid() then raise exception 'Cannot block yourself'; end if;
  insert into public.blocks(blocker_id,blocked_id) values(auth.uid(),target_user) on conflict(blocker_id,blocked_id) do nothing;
  update public.connection_requests set status='cancelled',responded_at=now() where status='pending' and ((sender_id=auth.uid() and receiver_id=target_user) or (sender_id=target_user and receiver_id=auth.uid()));
  insert into public.security_events(user_id,event_type,metadata) values(auth.uid(),'user_blocked',jsonb_build_object('target_user_id',target_user));
end;
$$;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(target_user uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  delete from public.blocks where blocker_id=auth.uid() and blocked_id=target_user;
end;
$$;
grant execute on function public.unblock_user(uuid) to authenticated;

create or replace function public.submit_report(target_user uuid,report_reason text,report_description text default null,report_target_type text default 'profile',report_target_id uuid default null,report_evidence_path text default null)
returns uuid language plpgsql security definer set search_path=public
as $$
declare new_report uuid;
begin
  if target_user=auth.uid() then raise exception 'Invalid report'; end if;
  if report_reason not in('harassment','fake_profile','aggression','image_misuse','inappropriate_content','discrimination','false_information','other') then raise exception 'Invalid report reason'; end if;
  insert into public.reports(reporter_id,reported_user_id,reason,description,target_type,target_id,evidence_path)
  values(auth.uid(),target_user,report_reason,nullif(trim(report_description),''),report_target_type,report_target_id,report_evidence_path)
  returning id into new_report;
  insert into public.security_events(user_id,event_type,metadata) values(auth.uid(),'report_submitted',jsonb_build_object('report_id',new_report));
  return new_report;
end;
$$;
grant execute on function public.submit_report(uuid,text,text,text,uuid,text) to authenticated;
