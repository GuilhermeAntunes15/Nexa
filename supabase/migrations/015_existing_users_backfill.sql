-- Cria os registros públicos que faltam para contas cadastradas antes da
-- instalação do gatilho on_auth_user_created.

insert into public.profiles (id, name)
select
  users.id,
  nullif(trim(coalesce(users.raw_user_meta_data ->> 'name', '')), '')
from auth.users as users
on conflict (id) do nothing;

insert into public.privacy_settings (user_id)
select profiles.id
from public.profiles as profiles
on conflict (user_id) do nothing;

insert into public.user_presence (user_id, presence_status, visible)
select profiles.id, 'offline', true
from public.profiles as profiles
on conflict (user_id) do nothing;

insert into public.trust_metrics (user_id)
select profiles.id
from public.profiles as profiles
on conflict (user_id) do nothing;
