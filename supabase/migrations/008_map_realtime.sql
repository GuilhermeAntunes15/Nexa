create or replace function public.discovery_cohort(
  target_user uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$

  select
    case
      when p.birth_date is null
        then 'unknown'

      when extract(
        year
        from age(
          current_date,
          p.birth_date
        )
      ) < 13
        then 'blocked'

      when extract(
        year
        from age(
          current_date,
          p.birth_date
        )
      ) <= 15
        then 'minor_13_15'

      when extract(
        year
        from age(
          current_date,
          p.birth_date
        )
      ) <= 17
        then 'minor_16_17'

      else
        'adult'
    end

  from public.profiles p

  where
    p.id =
    target_user;

$$;


create or replace function public.can_socially_interact(
  first_user uuid,
  second_user uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$

declare
  first_group text;
  second_group text;

begin

  if
    first_user is null
    or
    second_user is null
  then
    return false;
  end if;

  if first_user =
     second_user then
    return true;
  end if;

  if public.users_blocked(
    first_user,
    second_user
  ) then
    return false;
  end if;

  first_group :=
    public.discovery_cohort(
      first_user
    );

  second_group :=
    public.discovery_cohort(
      second_user
    );

  if
    first_group in (
      'unknown',
      'blocked'
    )
    or
    second_group in (
      'unknown',
      'blocked'
    )
  then
    return false;
  end if;

  if
    first_group <>
    second_group
  then
    return false;
  end if;

  return true;

end;

$$;


create or replace function public.set_my_location(
  lat double precision,
  lng double precision,
  gps_accuracy double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$

declare
  current_user_id uuid;
  privacy_mode text;
  cohort text;
  grid_size double precision;
  approximate_lat double precision;
  approximate_lng double precision;

begin

  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'Not authenticated';
  end if;

  if
    lat < -90
    or
    lat > 90
  then
    raise exception
      'Invalid latitude';
  end if;

  if
    lng < -180
    or
    lng > 180
  then
    raise exception
      'Invalid longitude';
  end if;

  select visibility
  into privacy_mode
  from public.privacy_settings
  where user_id =
    current_user_id;

  cohort :=
    public.discovery_cohort(
      current_user_id
    );

  insert into public.user_locations_private (
    user_id,
    location,
    accuracy,
    updated_at
  )

  values (
    current_user_id,

    st_setsrid(
      st_makepoint(
        lng,
        lat
      ),
      4326
    )::geography,

    gps_accuracy,
    now()
  )

  on conflict (
    user_id
  )

  do update set
    location =
      excluded.location,

    accuracy =
      excluded.accuracy,

    updated_at =
      now();

  if cohort like
     'minor_%' then
    grid_size :=
      0.03;
  else
    grid_size :=
      0.015;
  end if;

  approximate_lat :=
    (
      round(
        (
          lat /
          grid_size
        )::numeric
      )
      *
      grid_size
    )::double precision;

  approximate_lng :=
    (
      round(
        (
          lng /
          grid_size
        )::numeric
      )
      *
      grid_size
    )::double precision;

  insert into public.user_presence (
    user_id,
    public_lat,
    public_lng,
    presence_status,
    visible,
    last_seen,
    updated_at
  )

  values (
    current_user_id,
    approximate_lat,
    approximate_lng,
    'online',
    privacy_mode <>
      'invisible',
    now(),
    now()
  )

  on conflict (
    user_id
  )

  do update set
    public_lat =
      excluded.public_lat,

    public_lng =
      excluded.public_lng,

    presence_status =
      'online',

    visible =
      excluded.visible,

    last_seen =
      now(),

    updated_at =
      now();

end;

$$;


create or replace function public.get_nearby_profiles(
  p_radius_km integer default 10,
  p_intention text default null,
  p_verified_only boolean default false,
  p_interest_ids bigint[] default null
)
returns table (
  user_id uuid,
  name text,
  avatar_url text,
  age_years integer,
  current_intention text,
  is_verified boolean,
  public_lat double precision,
  public_lng double precision,
  distance_label text,
  presence_status text,
  last_seen timestamptz
)
language plpgsql
security definer
set search_path = public
as $$

declare
  current_user_id uuid;
  my_location geography;
  safe_radius integer;

begin

  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'Not authenticated';
  end if;

  safe_radius :=
    least(
      greatest(
        p_radius_km,
        1
      ),
      30
    );

  select
    upl.location
  into my_location
  from public.user_locations_private upl
  where
    upl.user_id =
      current_user_id;

  if my_location is null then
    raise exception
      'Location unavailable';
  end if;

  return query

  select
    p.id,
    p.name,
    p.avatar_url,

    extract(
      year
      from age(
        current_date,
        p.birth_date
      )
    )::integer,

    p.current_intention,
    p.is_verified,
    up.public_lat,
    up.public_lng,

    case
      when st_distance(
        target_location.location,
        my_location
      ) < 1000
      then 'Menos de 1 km'

      when st_distance(
        target_location.location,
        my_location
      ) < 3000
      then 'Entre 1 e 3 km'

      when st_distance(
        target_location.location,
        my_location
      ) < 5000
      then 'Entre 3 e 5 km'

      when st_distance(
        target_location.location,
        my_location
      ) < 10000
      then 'Entre 5 e 10 km'

      when st_distance(
        target_location.location,
        my_location
      ) < 20000
      then 'Entre 10 e 20 km'

      else 'Mais de 20 km'
    end,

    up.presence_status,
    up.last_seen

  from public.profiles p

  join public.user_presence up
    on up.user_id =
       p.id

  join public.user_locations_private
       target_location
    on target_location.user_id =
       p.id

  where
    p.id <>
      current_user_id

    and
    p.account_status =
      'active'

    and
    up.visible =
      true

    and
    public.can_see_map_presence(
      current_user_id,
      p.id
    )

    and
    up.presence_status
    in (
      'online',
      'away'
    )

    and
    up.last_seen >
      now() -
      interval '20 minutes'

    and
    public.can_socially_interact(
      current_user_id,
      p.id
    )

    and
    st_dwithin(
      target_location.location,
      my_location,
      safe_radius * 1000
    )

    and
    (
      p_intention is null
      or
      p.current_intention =
        p_intention
    )

    and
    (
      p_verified_only =
        false
      or
      p.is_verified =
        true
    )

  order by
    st_distance(
      target_location.location,
      my_location
    )

  limit 200;

end;

$$;


grant execute
on function public.get_nearby_profiles(
  integer,
  text,
  boolean,
  bigint[]
)
to authenticated;


grant execute
on function public.set_my_location(
  double precision,
  double precision,
  double precision
)
to authenticated;
