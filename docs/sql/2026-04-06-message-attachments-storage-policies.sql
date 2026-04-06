-- Chat attachment storage setup for the `message-media` bucket.
-- Current app path format: <conversation_id>/<message_id>/(voice|files)/<stamp>-<sanitized-file-name>
-- If production intentionally uses a different bucket name, keep code and SQL aligned.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-media',
  'message-media',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/x-wav',
    'audio/aac',
    'audio/mp3',
    'audio/m4a'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists message_attachments_select_conversation_member on storage.objects;
create policy message_attachments_select_conversation_member
on storage.objects
for select
to authenticated
using (
  bucket_id = 'message-media'
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
      and cm.state = 'active'
  )
);

drop policy if exists message_attachments_insert_conversation_member on storage.objects;
create policy message_attachments_insert_conversation_member
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-media'
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
      and cm.state = 'active'
  )
);

drop policy if exists message_attachments_update_conversation_member on storage.objects;
create policy message_attachments_update_conversation_member
on storage.objects
for update
to authenticated
using (
  bucket_id = 'message-media'
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
      and cm.state = 'active'
  )
)
with check (
  bucket_id = 'message-media'
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
      and cm.state = 'active'
  )
);

drop policy if exists message_attachments_delete_conversation_member on storage.objects;
create policy message_attachments_delete_conversation_member
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'message-media'
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
      and cm.state = 'active'
  )
);
