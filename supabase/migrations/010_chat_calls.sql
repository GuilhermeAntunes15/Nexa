alter table public.messages
add column if not exists metadata jsonb
not null default '{}'::jsonb;

create index if not exists
messages_conversation_id_created_at_idx
on public.messages (
  conversation_id,
  created_at desc
);

drop policy if exists
"messages_send_members"
on public.messages;

create or replace function public.can_send_to_conversation(
  target_conversation uuid,
  target_user uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  conversation_type text;
begin
  if not public.is_conversation_member(
    target_conversation,
    target_user
  ) then
    return false;
  end if;

  select type
  into conversation_type
  from public.conversations
  where id = target_conversation;

  if conversation_type is null then
    return false;
  end if;

  if conversation_type = 'dm' then
    if exists (
      select 1
      from public.conversation_members mine
      join public.conversation_members other_member
        on other_member.conversation_id = mine.conversation_id
      where
        mine.conversation_id = target_conversation
        and mine.user_id = target_user
        and other_member.user_id <> target_user
        and public.users_blocked(
          target_user,
          other_member.user_id
        )
    ) then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.send_message(
  target_conversation uuid,
  p_type text,
  p_content text default null,
  p_media_path text default null,
  p_reply_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  new_message_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_send_to_conversation(
    target_conversation,
    current_user_id
  ) then
    raise exception 'Cannot send message';
  end if;

  if p_type not in (
    'text',
    'image',
    'audio',
    'activity',
    'system'
  ) then
    raise exception 'Invalid message type';
  end if;

  if p_type = 'text'
    and (
      p_content is null
      or char_length(trim(p_content)) = 0
    )
  then
    raise exception 'Message cannot be empty';
  end if;

  if p_type in ('image', 'audio')
    and p_media_path is null
  then
    raise exception 'Media required';
  end if;

  if p_reply_to is not null then
    if not exists (
      select 1
      from public.messages m
      where
        m.id = p_reply_to
        and m.conversation_id = target_conversation
    ) then
      raise exception 'Invalid reply';
    end if;
  end if;

  insert into public.messages (
    conversation_id,
    sender_id,
    message_type,
    content,
    media_url,
    reply_to
  )
  values (
    target_conversation,
    current_user_id,
    p_type,
    nullif(trim(p_content), ''),
    p_media_path,
    p_reply_to
  )
  returning id into new_message_id;

  update public.conversations
  set updated_at = now()
  where id = target_conversation;

  return new_message_id;
end;
$$;

grant execute
on function public.send_message(
  uuid,
  text,
  text,
  text,
  uuid
)
to authenticated;

create or replace function public.mark_conversation_read(
  target_conversation uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_members
  set last_read_at = now()
  where
    conversation_id = target_conversation
    and user_id = auth.uid();
end;
$$;

grant execute
on function public.mark_conversation_read(uuid)
to authenticated;

create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  conversation_type text,
  title text,
  other_user_id uuid,
  other_name text,
  other_avatar text,
  other_verified boolean,
  other_presence text,
  last_message text,
  last_message_type text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.type,
    case
      when c.type = 'dm' then other_profile.name
      else c.title
    end,
    other_profile.id,
    other_profile.name,
    other_profile.avatar_url,
    other_profile.is_verified,
    other_presence.presence_status,
    case
      when last_message.message_type = 'image' then '📷 Foto'
      when last_message.message_type = 'audio' then '🎙 Áudio'
      when last_message.message_type = 'activity' then '📅 Atividade'
      else last_message.content
    end,
    last_message.message_type,
    last_message.created_at,
    (
      select count(*)
      from public.messages unread_message
      where
        unread_message.conversation_id = c.id
        and unread_message.sender_id <> auth.uid()
        and unread_message.created_at > coalesce(
          my_member.last_read_at,
          '-infinity'::timestamptz
        )
        and unread_message.deleted_at is null
    )
  from public.conversations c
  join public.conversation_members my_member
    on my_member.conversation_id = c.id
    and my_member.user_id = auth.uid()
  left join public.conversation_members other_member
    on other_member.conversation_id = c.id
    and other_member.user_id <> auth.uid()
    and c.type = 'dm'
  left join public.profiles other_profile
    on other_profile.id = other_member.user_id
  left join public.user_presence other_presence
    on other_presence.user_id = other_profile.id
  left join lateral (
    select
      m.id,
      m.content,
      m.message_type,
      m.created_at
    from public.messages m
    where
      m.conversation_id = c.id
      and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) last_message on true
  order by coalesce(
    last_message.created_at,
    c.created_at
  ) desc;
$$;

grant execute
on function public.get_my_conversations()
to authenticated;

create or replace function public.get_conversation_details(
  target_conversation uuid
)
returns table (
  conversation_id uuid,
  conversation_type text,
  title text,
  other_user_id uuid,
  other_name text,
  other_avatar text,
  other_verified boolean,
  other_presence text,
  other_last_seen timestamptz,
  other_last_read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_conversation_member(
    target_conversation,
    auth.uid()
  ) then
    raise exception 'Conversation unavailable';
  end if;

  return query
  select
    c.id,
    c.type,
    case
      when c.type = 'dm' then p.name
      else c.title
    end,
    p.id,
    p.name,
    p.avatar_url,
    p.is_verified,
    up.presence_status,
    up.last_seen,
    cm_other.last_read_at
  from public.conversations c
  left join public.conversation_members cm_other
    on cm_other.conversation_id = c.id
    and cm_other.user_id <> auth.uid()
  left join public.profiles p
    on p.id = cm_other.user_id
  left join public.user_presence up
    on up.user_id = p.id
  where c.id = target_conversation;
end;
$$;

grant execute
on function public.get_conversation_details(uuid)
to authenticated;

create or replace function public.get_conversation_messages(
  target_conversation uuid,
  p_before timestamptz default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  sender_avatar text,
  message_type text,
  content text,
  media_path text,
  reply_to uuid,
  reply_content text,
  reply_sender_name text,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  safe_limit integer;
begin
  if not public.is_conversation_member(
    target_conversation,
    auth.uid()
  ) then
    raise exception 'Conversation unavailable';
  end if;

  safe_limit := least(greatest(p_limit, 1), 100);

  return query
  select
    m.id,
    m.sender_id,
    sender.name,
    sender.avatar_url,
    m.message_type,
    case when m.deleted_at is null then m.content else null end,
    case when m.deleted_at is null then m.media_url else null end,
    m.reply_to,
    replied.content,
    replied_sender.name,
    m.created_at,
    m.edited_at,
    m.deleted_at
  from public.messages m
  join public.profiles sender
    on sender.id = m.sender_id
  left join public.messages replied
    on replied.id = m.reply_to
  left join public.profiles replied_sender
    on replied_sender.id = replied.sender_id
  where
    m.conversation_id = target_conversation
    and (
      p_before is null
      or m.created_at < p_before
    )
  order by m.created_at desc
  limit safe_limit;
end;
$$;

grant execute
on function public.get_conversation_messages(
  uuid,
  timestamptz,
  integer
)
to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'chat-media',
  'chat-media',
  false,
  20971520,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg'
  ]
)
on conflict (id)
do nothing;

create policy "chat_media_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and public.is_conversation_member(
    (storage.foldername(name))[1]::uuid,
    auth.uid()
  )
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "chat_media_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-media'
  and public.is_conversation_member(
    (storage.foldername(name))[1]::uuid,
    auth.uid()
  )
);

create policy "chat_media_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create or replace function public.request_call(
  target_conversation uuid,
  p_call_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  other_user uuid;
  new_call uuid;
  conversation_type text;
  other_call_setting text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_call_type not in ('audio', 'video') then
    raise exception 'Invalid call type';
  end if;

  if not public.can_send_to_conversation(
    target_conversation,
    current_user_id
  ) then
    raise exception 'Call unavailable';
  end if;

  select type
  into conversation_type
  from public.conversations
  where id = target_conversation;

  if conversation_type <> 'dm' then
    raise exception 'Calls currently available only in private conversations';
  end if;

  select cm.user_id
  into other_user
  from public.conversation_members cm
  where
    cm.conversation_id = target_conversation
    and cm.user_id <> current_user_id
  limit 1;

  select ps.who_can_call
  into other_call_setting
  from public.privacy_settings ps
  where ps.user_id = other_user;

  if other_call_setting = 'nobody' then
    raise exception 'User does not accept calls';
  end if;

  if exists (
    select 1
    from public.calls existing_call
    where
      existing_call.conversation_id = target_conversation
      and existing_call.status in ('ringing', 'accepted')
  ) then
    raise exception 'Call already active';
  end if;

  insert into public.calls (
    conversation_id,
    initiator_id,
    call_type,
    status
  )
  values (
    target_conversation,
    current_user_id,
    p_call_type,
    'ringing'
  )
  returning id into new_call;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    title,
    body,
    entity_type,
    entity_id
  )
  values (
    other_user,
    current_user_id,
    'incoming_call',
    case
      when p_call_type = 'video' then 'Chamada de vídeo'
      else 'Chamada de áudio'
    end,
    'Uma conexão quer falar com você.',
    'call',
    new_call
  );

  return new_call;
end;
$$;

create or replace function public.respond_call(
  target_call uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  call_record public.calls%rowtype;
begin
  select *
  into call_record
  from public.calls
  where id = target_call
  for update;

  if call_record.id is null then
    raise exception 'Call not found';
  end if;

  if not public.is_conversation_member(
    call_record.conversation_id,
    auth.uid()
  ) then
    raise exception 'Not allowed';
  end if;

  if call_record.initiator_id = auth.uid() then
    raise exception 'Initiator cannot respond';
  end if;

  if call_record.status <> 'ringing' then
    raise exception 'Call already processed';
  end if;

  if p_accept then
    update public.calls
    set
      status = 'accepted',
      started_at = now()
    where id = target_call;
  else
    update public.calls
    set
      status = 'declined',
      ended_at = now()
    where id = target_call;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    title,
    body,
    entity_type,
    entity_id
  )
  values (
    call_record.initiator_id,
    auth.uid(),
    case
      when p_accept then 'call_accepted'
      else 'call_declined'
    end,
    case
      when p_accept then 'Chamada aceita'
      else 'Chamada recusada'
    end,
    null,
    'call',
    target_call
  );
end;
$$;

create or replace function public.end_call(
  target_call uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_conversation uuid;
begin
  select conversation_id
  into target_conversation
  from public.calls
  where id = target_call;

  if target_conversation is null then
    raise exception 'Call not found';
  end if;

  if not public.is_conversation_member(
    target_conversation,
    auth.uid()
  ) then
    raise exception 'Not allowed';
  end if;

  update public.calls
  set
    status = 'ended',
    ended_at = now()
  where
    id = target_call
    and status in ('ringing', 'accepted');
end;
$$;

grant execute
on function public.request_call(uuid, text)
to authenticated;

grant execute
on function public.respond_call(uuid, boolean)
to authenticated;

grant execute
on function public.end_call(uuid)
to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'calls'
  ) then
    alter publication supabase_realtime
    add table public.calls;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime
    add table public.messages;
  end if;
end $$;

create or replace function public.toggle_message_reaction(
  target_message uuid,
  reaction_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_conversation uuid;
begin
  select conversation_id
  into target_conversation
  from public.messages
  where id = target_message;

  if target_conversation is null then
    raise exception 'Message not found';
  end if;

  if not public.is_conversation_member(
    target_conversation,
    auth.uid()
  ) then
    raise exception 'Not allowed';
  end if;

  if char_length(reaction_value) > 8 then
    raise exception 'Invalid reaction';
  end if;

  if exists (
    select 1
    from public.message_reactions
    where
      message_id = target_message
      and user_id = auth.uid()
      and reaction = reaction_value
  ) then
    delete from public.message_reactions
    where
      message_id = target_message
      and user_id = auth.uid()
      and reaction = reaction_value;
  else
    insert into public.message_reactions (
      message_id,
      user_id,
      reaction
    )
    values (
      target_message,
      auth.uid(),
      reaction_value
    );
  end if;
end;
$$;

grant execute
on function public.toggle_message_reaction(uuid, text)
to authenticated;
