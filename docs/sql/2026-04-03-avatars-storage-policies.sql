-- Avatar storage policy draft for the `avatars` bucket.
-- Adjust bucket name if NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET differs in production.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy avatars_select_authenticated
on storage.objects
for select
to authenticated
using (bucket_id = 'avatars');

create policy avatars_insert_own_prefix
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and name like auth.uid()::text || '/%'
);

create policy avatars_update_own_prefix
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and name like auth.uid()::text || '/%'
)
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and name like auth.uid()::text || '/%'
);

create policy avatars_delete_own_prefix
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and name like auth.uid()::text || '/%'
);
