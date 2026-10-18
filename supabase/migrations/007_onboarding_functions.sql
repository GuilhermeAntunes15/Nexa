create or replace function public.finish_onboarding()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  profile_record public.profiles%rowtype;
  interest_count integer;
  goal_count integer;
  age_years integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into profile_record
  from public.profiles
  where id = current_user_id
  for update;

  if profile_record.id is null then
    raise exception 'Profile unavailable';
  end if;

  if profile_record.name is null
     or char_length(trim(profile_record.name)) < 2 then
    raise exception 'Name required';
  end if;

  if profile_record.birth_date is null then
    raise exception 'Birth date required';
  end if;

  age_years := extract(
    year from age(current_date, profile_record.birth_date)
  )::integer;

  if age_years < 13 then
    raise exception 'Minimum age not reached';
  end if;

  if profile_record.avatar_url is null
     or char_length(trim(profile_record.avatar_url)) = 0 then
    raise exception 'Avatar required';
  end if;

  select count(*)
  into interest_count
  from public.profile_interests
  where user_id = current_user_id;

  if interest_count < 3 then
    raise exception 'Choose at least three interests';
  end if;

  select count(*)
  into goal_count
  from public.profile_goals
  where user_id = current_user_id;

  if goal_count < 1 then
    raise exception 'Choose at least one goal';
  end if;

  if profile_record.current_intention is null
     or char_length(trim(profile_record.current_intention)) = 0 then
    raise exception 'Choose an intention';
  end if;

  if age_years < 18 then
    if not exists (
      select 1
      from public.guardian_links gl
      where gl.minor_user_id = current_user_id
        and gl.status in ('pending','verified')
    ) then
      raise exception 'Guardian required';
    end if;
  end if;

  update public.profiles
  set
    onboarding_completed = true,
    profile_completed_at = coalesce(profile_completed_at, now()),
    updated_at = now()
  where id = current_user_id;
end;
$$;

revoke all on function public.finish_onboarding() from public;
grant execute on function public.finish_onboarding() to authenticated;
