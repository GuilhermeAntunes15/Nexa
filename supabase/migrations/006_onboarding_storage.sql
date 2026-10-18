alter table public.profiles
add column if not exists onboarding_completed boolean not null default false;

alter table public.profiles
add column if not exists profile_completed_at timestamptz;

alter table public.profiles
add column if not exists gender_visibility text not null default 'private'
check (gender_visibility in ('public','connections','private'));

alter table public.profiles
add column if not exists occupation text;

alter table public.profiles
add column if not exists languages text[] not null default '{}'::text[];

alter table public.profiles
add column if not exists profile_status text not null default 'available'
check (profile_status in ('available','busy','offline'));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

/*
  A conta protegida pode criar e corrigir os dados de contato
  do próprio vínculo enquanto ele ainda está pendente.
  Ela não pode transformar o vínculo em "verified" por conta própria.
*/
drop policy if exists "guardian_links_minor_insert" on public.guardian_links;
create policy "guardian_links_minor_insert"
on public.guardian_links
for insert
to authenticated
with check (
  minor_user_id = auth.uid()
  and status = 'pending'
);

drop policy if exists "guardian_links_minor_update" on public.guardian_links;
create policy "guardian_links_minor_update"
on public.guardian_links
for update
to authenticated
using (
  minor_user_id = auth.uid()
  and status = 'pending'
)
with check (
  minor_user_id = auth.uid()
  and status = 'pending'
);
