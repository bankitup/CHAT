alter table public.messages
add column if not exists content_mode text not null default 'plaintext';

comment on column public.messages.content_mode is
'Storage mode for message content. plaintext means server-readable body. dm_e2ee_v1 means DM ciphertext lives in message_e2ee_envelopes and body must be null.';

alter table public.messages
drop constraint if exists messages_content_mode_check;

alter table public.messages
add constraint messages_content_mode_check
check (content_mode in ('plaintext', 'dm_e2ee_v1'));

alter table public.messages
add column if not exists sender_device_id uuid null references public.user_devices(id) on delete set null;

comment on column public.messages.sender_device_id is
'Sending device for DM E2EE messages. Null for legacy/plaintext flows.';

alter table public.messages
drop constraint if exists messages_dm_e2ee_body_null_check;

alter table public.messages
add constraint messages_dm_e2ee_body_null_check
check (
  content_mode <> 'dm_e2ee_v1'
  or body is null
);

create index if not exists messages_conversation_content_mode_idx
on public.messages (conversation_id, content_mode, seq desc);
