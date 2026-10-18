create or replace function public.get_my_connection_requests()
returns table (
  request_id uuid,
  sender_id uuid,
  sender_name text,
  sender_username text,
  sender_avatar_url text,
  request_reason text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cr.id,
    cr.sender_id,
    p.name,
    p.username,
    p.avatar_url,
    cr.request_reason,
    cr.created_at
  from public.connection_requests cr
  join public.profiles p on p.id = cr.sender_id
  where cr.receiver_id = auth.uid()
    and cr.status = 'pending'
    and p.account_status = 'active'
    and public.can_socially_interact(auth.uid(), cr.sender_id)
  order by cr.created_at desc;
$$;

grant execute on function public.get_my_connection_requests() to authenticated;

create or replace function public.get_public_profile(target_user uuid)
returns table (
  id uuid,
  name text,
  username text,
  bio text,
  avatar_url text,
  city text,
  region text,
  current_intention text,
  availability text,
  is_verified boolean,
  occupation text,
  languages text[],
  profile_status text,
  age integer,
  goals text[],
  interests text[],
  trust_score numeric,
  review_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    p.id,
    p.name,
    p.username,
    p.bio,
    p.avatar_url,
    p.city,
    p.region,
    p.current_intention,
    p.availability,
    p.is_verified,
    p.occupation,
    p.languages,
    p.profile_status,
    extract(year from age(current_date, p.birth_date))::integer,
    coalesce(
      (select array_agg(pg.goal order by pg.goal)
       from public.profile_goals pg
       where pg.user_id = p.id),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(i.name order by i.name)
       from public.profile_interests pi
       join public.interests i on i.id = pi.interest_id
       where pi.user_id = p.id),
      '{}'::text[]
    ),
    coalesce(tm.trust_score, 0),
    coalesce(tm.review_count, 0)
  from public.profiles p
  left join public.privacy_settings ps on ps.user_id = p.id
  left join public.trust_metrics tm on tm.user_id = p.id
  where p.id = target_user
    and p.account_status = 'active'
    and public.can_socially_interact(me, p.id)
    and (
      p.id = me
      or coalesce(ps.visibility, 'visible') = 'visible'
      or (
        coalesce(ps.visibility, 'visible') = 'connections'
        and public.are_connected(me, p.id)
      )
    );
end;
$$;

grant execute on function public.get_public_profile(uuid) to authenticated;
