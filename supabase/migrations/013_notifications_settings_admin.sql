create table if not exists public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.my_role()
returns text language sql stable security definer set search_path=public
as $$
  select coalesce((select role from public.user_roles where user_id=auth.uid()),'user');
$$;

alter table public.user_roles enable row level security;

create policy "user_roles_own_read"
on public.user_roles
for select
to authenticated
using(user_id=auth.uid());

create or replace function public.get_my_notifications(p_limit integer default 50)
returns table(notification_id uuid,actor_id uuid,actor_name text,actor_avatar text,actor_verified boolean,type text,title text,body text,entity_type text,entity_id uuid,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path=public
as $$
  select n.id,actor.id,actor.name,actor.avatar_url,coalesce(actor.is_verified,false),n.type,n.title,n.body,n.entity_type,n.entity_id,n.read_at,n.created_at
  from public.notifications n
  left join public.profiles actor on actor.id=n.actor_id
  where n.user_id=auth.uid()
  order by n.created_at desc
  limit least(greatest(p_limit,1),100);
$$;
grant execute on function public.get_my_notifications(integer) to authenticated;

create or replace function public.get_unread_notification_count()
returns bigint language sql stable security definer set search_path=public
as $$
  select count(*) from public.notifications where user_id=auth.uid() and read_at is null;
$$;
grant execute on function public.get_unread_notification_count() to authenticated;

create or replace function public.mark_notification_read(target_notification uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  update public.notifications set read_at=coalesce(read_at,now()) where id=target_notification and user_id=auth.uid();
end;
$$;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns void language plpgsql security definer set search_path=public
as $$
begin
  update public.notifications set read_at=now() where user_id=auth.uid() and read_at is null;
end;
$$;
grant execute on function public.mark_all_notifications_read() to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

create or replace function public.update_my_privacy(p_visibility text,p_stats_visibility text,p_who_can_call text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if p_visibility not in('visible','connections','invisible') then raise exception 'Invalid map visibility'; end if;
  if p_stats_visibility not in('everyone','connections','nobody') then raise exception 'Invalid stats visibility'; end if;
  if p_who_can_call not in('connections','nobody') then raise exception 'Invalid call setting'; end if;
  update public.privacy_settings set visibility=p_visibility,stats_visibility=p_stats_visibility,who_can_call=p_who_can_call,updated_at=now() where user_id=auth.uid();
  update public.user_presence set visible=p_visibility<>'invisible',updated_at=now() where user_id=auth.uid();
end;
$$;
grant execute on function public.update_my_privacy(text,text,text) to authenticated;

create or replace function public.get_my_blocked_users()
returns table(user_id uuid,name text,avatar_url text,blocked_at timestamptz)
language sql stable security definer set search_path=public
as $$
  select p.id,p.name,p.avatar_url,b.created_at
  from public.blocks b
  join public.profiles p on p.id=b.blocked_id
  where b.blocker_id=auth.uid()
  order by b.created_at desc;
$$;
grant execute on function public.get_my_blocked_users() to authenticated;

create or replace function public.get_my_guardian()
returns table(guardian_link_id uuid,guardian_name text,relationship text,masked_phone text,masked_email text,status text,verified_at timestamptz)
language sql stable security definer set search_path=public
as $$
  select gl.id,gl.guardian_name,gl.relationship,
    case when gl.guardian_phone is null then null else '••••'||right(gl.guardian_phone,4) end,
    case when gl.guardian_email is null then null else left(gl.guardian_email,2)||'••••@'||split_part(gl.guardian_email,'@',2) end,
    gl.status,gl.verified_at
  from public.guardian_links gl
  where gl.minor_user_id=auth.uid()
  order by gl.created_at desc
  limit 1;
$$;
grant execute on function public.get_my_guardian() to authenticated;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path=public
as $$ select public.my_role() in ('moderator','admin'); $$;

create or replace function public.service_admin_reports(p_status text default 'open')
returns table(report_id uuid,reporter_id uuid,reported_user_id uuid,reported_name text,reason text,description text,target_type text,target_id uuid,status text,created_at timestamptz)
language sql stable security definer set search_path=public
as $$
  select r.id,r.reporter_id,r.reported_user_id,p.name,r.reason,r.description,r.target_type,r.target_id,r.status,r.created_at
  from public.reports r join public.profiles p on p.id=r.reported_user_id
  where p_status is null or r.status=p_status
  order by r.created_at desc;
$$;
revoke all on function public.service_admin_reports(text) from public;
revoke all on function public.service_admin_reports(text) from authenticated;
grant execute on function public.service_admin_reports(text) to service_role;

create or replace function public.service_resolve_report(p_report_id uuid,p_status text,p_moderator uuid,p_notes text default null)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if p_status not in('reviewing','resolved','dismissed') then raise exception 'Invalid status'; end if;
  update public.reports set status=p_status,moderator_id=p_moderator,moderator_notes=nullif(trim(p_notes),''),updated_at=now() where id=p_report_id;
  insert into public.security_events(user_id,event_type,metadata) values(p_moderator,'report_moderated',jsonb_build_object('report_id',p_report_id,'result',p_status));
end;
$$;
revoke all on function public.service_resolve_report(uuid,text,uuid,text) from public;
revoke all on function public.service_resolve_report(uuid,text,uuid,text) from authenticated;
grant execute on function public.service_resolve_report(uuid,text,uuid,text) to service_role;
