-- Avatar storage setup for the `avatars` bucket.
-- Current app path format: <auth.uid()>/<random>-<sanitized-file-name>
-- If production intentionally uses a different bucket name, keep code and SQL aligned.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists avatars_select_own_prefix on storage.objects;
drop policy if exists avatars_select_own on storage.objects;
drop policy if exists avatars_read_own_prefix on storage.objects;
drop policy if exists avatars_select_authenticated on storage.objects;
create policy avatars_select_authenticated
on storage.objects
for select
to authenticated
using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own_prefix on storage.objects;
create policy avatars_insert_own_prefix
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_update_own_prefix on storage.objects;
create policy avatars_update_own_prefix
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

drop policy if exists avatars_delete_own_prefix on storage.objects;
create policy avatars_delete_own_prefix
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
