alter table public.conversations
add column if not exists activity_id uuid unique
references public.activities(id)
on delete cascade;

create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  media_path text,
  visibility text not null default 'public' check (visibility in ('public','connections')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists feed_posts_created_idx
on public.feed_posts(created_at desc);

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists feed_comments_post_idx
on public.feed_comments(post_id, created_at);

create table if not exists public.feed_reactions (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'support',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.feed_posts enable row level security;
alter table public.feed_comments enable row level security;
alter table public.feed_reactions enable row level security;

create policy "feed_posts_own_update"
on public.feed_posts
for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create or replace function public.create_activity(
  p_title text,
  p_description text,
  p_category text,
  p_activity_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_participants integer,
  p_region text,
  p_visibility text default 'public',
  p_cover_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  new_activity uuid;
  new_conversation uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(p_title)) < 3 then raise exception 'Title too short'; end if;
  if p_activity_type not in ('hangout','event','study','sport','project','group') then raise exception 'Invalid activity type'; end if;
  if p_visibility not in ('public','connections','private') then raise exception 'Invalid visibility'; end if;
  if p_starts_at <= now() then raise exception 'Activity must be in the future'; end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'Invalid end time'; end if;
  if p_max_participants is not null and (p_max_participants < 2 or p_max_participants > 100) then raise exception 'Invalid participant limit'; end if;

  insert into public.activities (
    creator_id,title,description,category,cover_url,visibility,activity_type,max_participants,starts_at,ends_at,region,status
  ) values (
    current_user_id,trim(p_title),nullif(trim(p_description),''),nullif(trim(p_category),''),p_cover_path,p_visibility,p_activity_type,p_max_participants,p_starts_at,p_ends_at,nullif(trim(p_region),''),'open'
  ) returning id into new_activity;

  insert into public.activity_members (activity_id,user_id,role,status)
  values (new_activity,current_user_id,'creator','confirmed');

  insert into public.conversations (type,title,created_by,activity_id)
  values ('activity',trim(p_title),current_user_id,new_activity)
  returning id into new_conversation;

  insert into public.conversation_members (conversation_id,user_id)
  values (new_conversation,current_user_id);

  return new_activity;
end;
$$;

grant execute on function public.create_activity(text,text,text,text,timestamptz,timestamptz,integer,text,text,text) to authenticated;

create or replace function public.join_activity(target_activity uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_record public.activities%rowtype;
  member_count integer;
  group_conversation uuid;
begin
  select * into activity_record from public.activities where id = target_activity for update;
  if activity_record.id is null then raise exception 'Activity not found'; end if;
  if activity_record.status <> 'open' then raise exception 'Activity unavailable'; end if;

  if activity_record.visibility = 'private' then
    if not exists (
      select 1 from public.activity_invites ai
      where ai.activity_id = target_activity
        and ai.receiver_id = auth.uid()
        and ai.status = 'pending'
    ) then raise exception 'Invitation required'; end if;
  end if;

  if not public.can_socially_interact(auth.uid(), activity_record.creator_id) then raise exception 'Activity unavailable'; end if;
  if exists (select 1 from public.activity_members am where am.activity_id=target_activity and am.user_id=auth.uid() and am.status='confirmed') then raise exception 'Already participating'; end if;
  if activity_record.visibility='connections' and not public.are_connected(auth.uid(),activity_record.creator_id) then raise exception 'Activity unavailable'; end if;

  select count(*) into member_count from public.activity_members where activity_id=target_activity and status='confirmed';
  if activity_record.max_participants is not null and member_count >= activity_record.max_participants then
    update public.activities set status='full' where id=target_activity;
    raise exception 'Activity full';
  end if;

  insert into public.activity_members(activity_id,user_id,role,status)
  values(target_activity,auth.uid(),'member','confirmed')
  on conflict(activity_id,user_id) do update set status='confirmed', role='member';

  select id into group_conversation from public.conversations where activity_id=target_activity;
  insert into public.conversation_members(conversation_id,user_id)
  values(group_conversation,auth.uid()) on conflict do nothing;

  if activity_record.creator_id <> auth.uid() then
    insert into public.notifications(user_id,actor_id,type,title,body,entity_type,entity_id)
    values(activity_record.creator_id,auth.uid(),'activity_joined','Nova participante','Alguém entrou no seu rolê.','activity',target_activity);
  end if;

  select count(*) into member_count from public.activity_members where activity_id=target_activity and status='confirmed';
  if activity_record.max_participants is not null and member_count >= activity_record.max_participants then
    update public.activities set status='full' where id=target_activity;
  end if;

  return group_conversation;
end;
$$;

create or replace function public.invite_to_activity(target_activity uuid,target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_record public.activities%rowtype;
  invite_id uuid;
begin
  select * into activity_record from public.activities where id=target_activity;
  if activity_record.id is null then raise exception 'Activity unavailable'; end if;
  if not exists(select 1 from public.activity_members am where am.activity_id=target_activity and am.user_id=auth.uid() and am.status='confirmed') then raise exception 'Not a participant'; end if;
  if not public.can_socially_interact(auth.uid(),target_user) then raise exception 'Invitation not allowed'; end if;
  if exists(select 1 from public.activity_members am where am.activity_id=target_activity and am.user_id=target_user and am.status='confirmed') then raise exception 'Already participating'; end if;
  if exists(select 1 from public.activity_invites ai where ai.activity_id=target_activity and ai.receiver_id=target_user and ai.status='pending') then raise exception 'Invitation already pending'; end if;

  insert into public.activity_invites(activity_id,sender_id,receiver_id)
  values(target_activity,auth.uid(),target_user)
  returning id into invite_id;

  insert into public.notifications(user_id,actor_id,type,title,body,entity_type,entity_id)
  values(target_user,auth.uid(),'activity_invite','Convite para rolê',activity_record.title,'activity_invite',invite_id);

  return invite_id;
end;
$$;

create or replace function public.respond_activity_invite(target_invite uuid,response_value text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.activity_invites%rowtype;
  group_conversation uuid;
begin
  if response_value not in ('accepted','maybe','declined') then raise exception 'Invalid response'; end if;
  select * into invite_record from public.activity_invites where id=target_invite for update;
  if invite_record.id is null then raise exception 'Invitation unavailable'; end if;
  if invite_record.receiver_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if invite_record.status <> 'pending' then raise exception 'Invitation already processed'; end if;

  if response_value='accepted' then
    group_conversation := public.join_activity(invite_record.activity_id);
  end if;

  update public.activity_invites set status=response_value, responded_at=now() where id=target_invite;
  insert into public.notifications(user_id,actor_id,type,title,body,entity_type,entity_id)
  values(invite_record.sender_id,auth.uid(),'activity_invite_response',
    case when response_value='accepted' then 'Convite aceito' when response_value='maybe' then 'Talvez participe' else 'Convite recusado' end,
    null,'activity',invite_record.activity_id);

  return group_conversation;
end;
$$;

grant execute on function public.join_activity(uuid) to authenticated;
grant execute on function public.invite_to_activity(uuid,uuid) to authenticated;
grant execute on function public.respond_activity_invite(uuid,text) to authenticated;

create or replace function public.leave_activity(target_activity uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare creator uuid; group_chat uuid;
begin
  select creator_id into creator from public.activities where id=target_activity;
  if creator is null then raise exception 'Activity unavailable'; end if;
  if creator=auth.uid() then raise exception 'Creator cannot leave activity'; end if;
  update public.activity_members set status='removed' where activity_id=target_activity and user_id=auth.uid();
  select id into group_chat from public.conversations where activity_id=target_activity;
  delete from public.conversation_members where conversation_id=group_chat and user_id=auth.uid();
  update public.activities set status='open' where id=target_activity and status='full';
end;
$$;

create or replace function public.get_activity_feed(p_limit integer default 30)
returns table (
  activity_id uuid,
  creator_id uuid,
  creator_name text,
  creator_avatar text,
  creator_verified boolean,
  title text,
  description text,
  category text,
  activity_type text,
  cover_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  region text,
  max_participants integer,
  participant_count bigint,
  status text,
  already_joined boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,p.id,p.name,p.avatar_url,p.is_verified,a.title,a.description,a.category,a.activity_type,a.cover_url,a.starts_at,a.ends_at,a.region,a.max_participants,
    (select count(*) from public.activity_members am where am.activity_id=a.id and am.status='confirmed'),
    a.status,
    exists(select 1 from public.activity_members mine where mine.activity_id=a.id and mine.user_id=auth.uid() and mine.status='confirmed')
  from public.activities a
  join public.profiles p on p.id=a.creator_id
  where a.status in ('open','full')
    and a.starts_at > now()
    and public.can_socially_interact(auth.uid(),a.creator_id)
    and (
      a.visibility='public'
      or (a.visibility='connections' and public.are_connected(auth.uid(),a.creator_id))
      or a.creator_id=auth.uid()
      or exists(select 1 from public.activity_invites ai where ai.activity_id=a.id and ai.receiver_id=auth.uid())
    )
  order by a.starts_at asc
  limit least(greatest(p_limit,1),100);
$$;

create or replace function public.get_activity_details(target_activity uuid)
returns table (
  activity_id uuid,creator_id uuid,creator_name text,creator_avatar text,creator_verified boolean,title text,description text,category text,activity_type text,cover_path text,visibility text,starts_at timestamptz,ends_at timestamptz,region text,max_participants integer,participant_count bigint,status text,joined boolean,group_conversation_id uuid
)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not exists(
    select 1 from public.activities a
    where a.id=target_activity and (
      a.creator_id=auth.uid()
      or (
        public.can_socially_interact(auth.uid(),a.creator_id)
        and (
          a.visibility='public'
          or (a.visibility='connections' and public.are_connected(auth.uid(),a.creator_id))
          or exists(select 1 from public.activity_invites ai where ai.activity_id=a.id and ai.receiver_id=auth.uid())
        )
      )
    )
  ) then raise exception 'Activity unavailable'; end if;

  return query
  select a.id,p.id,p.name,p.avatar_url,p.is_verified,a.title,a.description,a.category,a.activity_type,a.cover_url,a.visibility,a.starts_at,a.ends_at,a.region,a.max_participants,
    (select count(*) from public.activity_members am where am.activity_id=a.id and am.status='confirmed'),
    a.status,
    exists(select 1 from public.activity_members mine where mine.activity_id=a.id and mine.user_id=auth.uid() and mine.status='confirmed'),
    (select c.id from public.conversations c where c.activity_id=a.id limit 1)
  from public.activities a join public.profiles p on p.id=a.creator_id
  where a.id=target_activity;
end;
$$;

create or replace function public.get_my_connections()
returns table(user_id uuid,name text,avatar_url text,is_verified boolean)
language sql stable security definer set search_path=public
as $$
  select p.id,p.name,p.avatar_url,p.is_verified
  from public.connections c
  join public.profiles p on p.id=case when c.user_a=auth.uid() then c.user_b else c.user_a end
  where c.user_a=auth.uid() or c.user_b=auth.uid()
  order by p.name;
$$;

create or replace function public.get_my_activity_invites()
returns table(invite_id uuid,activity_id uuid,title text,starts_at timestamptz,region text,sender_id uuid,sender_name text,sender_avatar text,status text)
language sql stable security definer set search_path=public
as $$
  select ai.id,a.id,a.title,a.starts_at,a.region,sender.id,sender.name,sender.avatar_url,ai.status
  from public.activity_invites ai
  join public.activities a on a.id=ai.activity_id
  join public.profiles sender on sender.id=ai.sender_id
  where ai.receiver_id=auth.uid() and ai.status='pending'
  order by ai.created_at desc;
$$;

create or replace function public.create_feed_post(p_content text,p_visibility text default 'public',p_media_path text default null)
returns uuid language plpgsql security definer set search_path=public
as $$
declare new_post uuid;
begin
  if char_length(trim(p_content))<2 then raise exception 'Post too short'; end if;
  if char_length(p_content)>1500 then raise exception 'Post too long'; end if;
  if p_visibility not in ('public','connections') then raise exception 'Invalid visibility'; end if;
  insert into public.feed_posts(author_id,content,visibility,media_path)
  values(auth.uid(),trim(p_content),p_visibility,p_media_path)
  returning id into new_post;
  return new_post;
end;
$$;

create or replace function public.get_feed_posts(p_limit integer default 30)
returns table(post_id uuid,author_id uuid,author_name text,author_avatar text,author_verified boolean,content text,media_path text,created_at timestamptz,reaction_count bigint,comment_count bigint,reacted boolean)
language sql stable security definer set search_path=public
as $$
  select fp.id,p.id,p.name,p.avatar_url,p.is_verified,fp.content,fp.media_path,fp.created_at,
    (select count(*) from public.feed_reactions fr where fr.post_id=fp.id),
    (select count(*) from public.feed_comments fc where fc.post_id=fp.id and fc.deleted_at is null),
    exists(select 1 from public.feed_reactions mine where mine.post_id=fp.id and mine.user_id=auth.uid())
  from public.feed_posts fp
  join public.profiles p on p.id=fp.author_id
  where fp.deleted_at is null
    and public.can_socially_interact(auth.uid(),fp.author_id)
    and (fp.visibility='public' or fp.author_id=auth.uid() or (fp.visibility='connections' and public.are_connected(auth.uid(),fp.author_id)))
  order by fp.created_at desc
  limit least(greatest(p_limit,1),100);
$$;

create or replace function public.toggle_feed_reaction(target_post uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare author uuid;
begin
  select author_id into author from public.feed_posts where id=target_post and deleted_at is null;
  if author is null then raise exception 'Post unavailable'; end if;
  if not public.can_socially_interact(auth.uid(),author) then raise exception 'Post unavailable'; end if;
  if exists(select 1 from public.feed_reactions where post_id=target_post and user_id=auth.uid()) then
    delete from public.feed_reactions where post_id=target_post and user_id=auth.uid();
  else
    insert into public.feed_reactions(post_id,user_id,reaction) values(target_post,auth.uid(),'support');
  end if;
end;
$$;

create or replace function public.comment_feed_post(target_post uuid,p_content text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare post_author uuid; new_comment uuid;
begin
  if char_length(trim(p_content))<1 then raise exception 'Empty comment'; end if;
  select author_id into post_author from public.feed_posts where id=target_post and deleted_at is null;
  if post_author is null then raise exception 'Post unavailable'; end if;
  if not public.can_socially_interact(auth.uid(),post_author) then raise exception 'Post unavailable'; end if;
  insert into public.feed_comments(post_id,author_id,content) values(target_post,auth.uid(),trim(p_content)) returning id into new_comment;
  if post_author<>auth.uid() then
    insert into public.notifications(user_id,actor_id,type,title,body,entity_type,entity_id)
    values(post_author,auth.uid(),'post_comment','Novo comentário',null,'post',target_post);
  end if;
  return new_comment;
end;
$$;

grant execute on function public.get_activity_feed(integer) to authenticated;
grant execute on function public.get_activity_details(uuid) to authenticated;
grant execute on function public.get_my_connections() to authenticated;
grant execute on function public.get_my_activity_invites() to authenticated;
grant execute on function public.create_feed_post(text,text,text) to authenticated;
grant execute on function public.get_feed_posts(integer) to authenticated;
grant execute on function public.toggle_feed_reaction(uuid) to authenticated;
grant execute on function public.comment_feed_post(uuid,text) to authenticated;
grant execute on function public.leave_activity(uuid) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='activities') then alter publication supabase_realtime add table public.activities; end if;
end $$;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='activity_members') then alter publication supabase_realtime add table public.activity_members; end if;
end $$;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='feed_posts') then alter publication supabase_realtime add table public.feed_posts; end if;
end $$;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='feed_reactions') then alter publication supabase_realtime add table public.feed_reactions; end if;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('social-media','social-media',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy "social_media_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id='social-media'
  and (storage.foldername(name))[1]=auth.uid()::text
);

create policy "social_media_authenticated_read"
on storage.objects
for select
to authenticated
using(bucket_id='social-media');

create or replace function public.create_sos(
  sos_category text,
  sos_description text,
  sos_mode text default 'online',
  sos_needed_at timestamptz default null,
  sos_region text default null,
  sos_identity_visibility text default 'normal'
)
returns uuid language plpgsql security definer set search_path=public
as $$
declare new_id uuid;
begin
  if char_length(trim(sos_description))<10 then raise exception 'Description too short'; end if;
  if sos_mode not in ('online','presential','either') then raise exception 'Invalid help mode'; end if;
  if sos_identity_visibility not in ('normal','first_name','private') then raise exception 'Invalid privacy'; end if;
  if public.is_minor(auth.uid()) and sos_mode in ('presential','either') and not exists(select 1 from public.guardian_links gl where gl.minor_user_id=auth.uid() and gl.status='verified') then raise exception 'Verified guardian required for in-person help'; end if;
  insert into public.sos_requests(author_id,category,description,help_mode,needed_at,region,identity_visibility)
  values(auth.uid(),trim(sos_category),trim(sos_description),sos_mode,sos_needed_at,nullif(trim(sos_region),''),sos_identity_visibility)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.get_sos_feed(p_limit integer default 50)
returns table(sos_id uuid,author_id uuid,display_name text,avatar_url text,is_verified boolean,category text,description text,help_mode text,needed_at timestamptz,region text,status text,response_count bigint,already_offered boolean,created_at timestamptz)
language sql stable security definer set search_path=public
as $$
  select s.id,p.id,
    case when s.identity_visibility='private' then 'Usuária Nexa' when s.identity_visibility='first_name' then split_part(p.name,' ',1) else p.name end,
    case when s.identity_visibility='private' then null else p.avatar_url end,
    case when s.identity_visibility='private' then false else p.is_verified end,
    s.category,s.description,s.help_mode,s.needed_at,s.region,s.status,
    (select count(*) from public.sos_responses sr where sr.sos_id=s.id and sr.status in ('offered','accepted','completed')),
    exists(select 1 from public.sos_responses mine where mine.sos_id=s.id and mine.helper_id=auth.uid()),
    s.created_at
  from public.sos_requests s
  join public.profiles p on p.id=s.author_id
  where s.status in ('looking','responses') and s.author_id<>auth.uid() and public.can_socially_interact(auth.uid(),s.author_id)
  order by case when s.needed_at is null then 1 else 0 end,s.needed_at,s.created_at desc
  limit least(greatest(p_limit,1),100);
$$;

create or replace function public.get_my_sos_requests()
returns table(sos_id uuid,category text,description text,help_mode text,status text,response_count bigint,created_at timestamptz)
language sql stable security definer set search_path=public
as $$
 select s.id,s.category,s.description,s.help_mode,s.status,(select count(*) from public.sos_responses sr where sr.sos_id=s.id),s.created_at
 from public.sos_requests s where s.author_id=auth.uid() order by s.created_at desc;
$$;

create or replace function public.get_sos_responses(target_sos uuid)
returns table(response_id uuid,helper_id uuid,helper_name text,helper_avatar text,helper_verified boolean,helper_trust_score numeric,status text,created_at timestamptz)
language plpgsql stable security definer set search_path=public
as $$
begin
 if not exists(select 1 from public.sos_requests s where s.id=target_sos and s.author_id=auth.uid()) then raise exception 'Not allowed'; end if;
 return query
 select sr.id,p.id,p.name,p.avatar_url,p.is_verified,tm.trust_score,sr.status,sr.created_at
 from public.sos_responses sr join public.profiles p on p.id=sr.helper_id left join public.trust_metrics tm on tm.user_id=p.id
 where sr.sos_id=target_sos and sr.status not in ('declined','cancelled') order by sr.created_at;
end;
$$;

create or replace function public.accept_sos_help(target_response uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare response_record public.sos_responses%rowtype; sos_record public.sos_requests%rowtype; new_conversation uuid;
begin
 select * into response_record from public.sos_responses where id=target_response for update;
 if response_record.id is null then raise exception 'Response unavailable'; end if;
 select * into sos_record from public.sos_requests where id=response_record.sos_id for update;
 if sos_record.author_id<>auth.uid() then raise exception 'Not allowed'; end if;
 if response_record.status<>'offered' then raise exception 'Response unavailable'; end if;
 insert into public.conversations(type,title,created_by) values('help','SOS Delas',auth.uid()) returning id into new_conversation;
 insert into public.conversation_members(conversation_id,user_id) values(new_conversation,auth.uid()),(new_conversation,response_record.helper_id);
 update public.sos_responses set status='accepted',responded_at=now(),conversation_id=new_conversation where id=target_response;
 update public.sos_responses set status='declined',responded_at=now() where sos_id=response_record.sos_id and id<>target_response and status='offered';
 update public.sos_requests set status='in_progress' where id=response_record.sos_id;
 insert into public.notifications(user_id,actor_id,type,title,body,entity_type,entity_id)
 values(response_record.helper_id,auth.uid(),'sos_accepted','Sua ajuda foi aceita','Uma usuária aceitou sua ajuda.','sos',response_record.sos_id);
 return new_conversation;
end;
$$;

create or replace function public.complete_sos(target_sos uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare accepted_response uuid;
begin
 if not exists(select 1 from public.sos_requests s where s.id=target_sos and s.author_id=auth.uid() and s.status='in_progress') then raise exception 'SOS unavailable'; end if;
 select id into accepted_response from public.sos_responses where sos_id=target_sos and status='accepted' limit 1;
 if accepted_response is null then raise exception 'No accepted helper'; end if;
 update public.sos_responses set status='completed' where id=accepted_response;
 update public.sos_requests set status='resolved',resolved_at=now() where id=target_sos;
 return accepted_response;
end;
$$;

grant execute on function public.create_sos(text,text,text,timestamptz,text,text) to authenticated;
grant execute on function public.get_sos_feed(integer) to authenticated;
grant execute on function public.get_my_sos_requests() to authenticated;
grant execute on function public.get_sos_responses(uuid) to authenticated;
grant execute on function public.accept_sos_help(uuid) to authenticated;
grant execute on function public.complete_sos(uuid) to authenticated;
