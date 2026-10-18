drop policy if exists
"profiles_select"
on public.profiles;


create policy "profiles_select_own"

on public.profiles

for select

to authenticated

using (
  id = auth.uid()
);


create or replace function public.get_connection_state(
  target_user uuid
)
returns table (
  state text,
  request_id uuid,
  conversation_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$

declare
  current_user_id uuid;
  connection_record uuid;

begin

  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'Not authenticated';
  end if;

  if target_user =
     current_user_id then

    return query
    select
      'self'::text,
      null::uuid,
      null::uuid;

    return;
  end if;

  select c.id
  into connection_record
  from public.connections c
  where
    (
      c.user_a =
        current_user_id
      and
      c.user_b =
        target_user
    )
    or
    (
      c.user_a =
        target_user
      and
      c.user_b =
        current_user_id
    )
  limit 1;

  if connection_record is not null then

    return query
    select
      'connected'::text,
      null::uuid,
      (
        select conv.id
        from public.conversations conv
        where
          conv.connection_id =
            connection_record
        limit 1
      );

    return;
  end if;

  return query
  select
    'outgoing_pending'::text,
    cr.id,
    null::uuid

  from public.connection_requests cr

  where
    cr.sender_id =
      current_user_id
    and
    cr.receiver_id =
      target_user
    and
    cr.status =
      'pending'

  limit 1;

  if found then
    return;
  end if;

  return query
  select
    'incoming_pending'::text,
    cr.id,
    null::uuid

  from public.connection_requests cr

  where
    cr.sender_id =
      target_user
    and
    cr.receiver_id =
      current_user_id
    and
    cr.status =
      'pending'

  limit 1;

  if found then
    return;
  end if;

  return query
  select
    'none'::text,
    null::uuid,
    null::uuid;

end;

$$;


grant execute
on function public.get_connection_state(uuid)
to authenticated;


create or replace function public.cancel_connection_request(
  target_request uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$

begin

  update public.connection_requests

  set
    status =
      'cancelled',

    responded_at =
      now()

  where
    id =
      target_request

    and
    sender_id =
      auth.uid()

    and
    status =
      'pending';

end;

$$;
