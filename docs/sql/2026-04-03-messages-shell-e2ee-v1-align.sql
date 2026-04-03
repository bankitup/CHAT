-- Operational alignment for partial E2EE schema rollout.
-- Goal: unblock chat loading paths that now read E2EE-aware message shell fields.
-- This script is intentionally idempotent and safe for partially migrated production.

alter table public.messages
add column if not exists content_mode text;

update public.messages
set content_mode = 'plaintext'
where content_mode is null;

alter table public.messages
alter column content_mode set default 'plaintext';

alter table public.messages
alter column content_mode set not null;

alter table public.messages
drop constraint if exists messages_content_mode_check;

alter table public.messages
add constraint messages_content_mode_check
check (content_mode in ('plaintext', 'dm_e2ee_v1'));

alter table public.messages
add column if not exists sender_device_id uuid;

do $$
begin
  if to_regclass('public.user_devices') is not null and not exists (
    select 1
    from pg_constraint
    where conname = 'messages_sender_device_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
    add constraint messages_sender_device_id_fkey
    foreign key (sender_device_id)
    references public.user_devices (id)
    on delete set null;
  end if;
end $$;

comment on column public.messages.content_mode is
'Storage mode for message content. plaintext means server-readable body. dm_e2ee_v1 means DM ciphertext lives in message_e2ee_envelopes and body must be null.';

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

-- Envelope table is not required for baseline chat shell loading because
-- runtime decrypt/envelope reads degrade gracefully when absent. Keep envelope
-- schema migration separate:
-- /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-03-message-e2ee-envelopes.sql
