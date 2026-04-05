alter table public.conversations
add column if not exists avatar_path text;

comment on column public.conversations.avatar_path is
'Optional managed avatar object path for group chat identity. Stored in the private avatars bucket and resolved through signed URLs.';
