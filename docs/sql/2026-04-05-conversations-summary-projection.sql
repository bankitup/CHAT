alter table public.conversations
  add column if not exists last_message_id uuid,
  add column if not exists last_message_seq bigint,
  add column if not exists last_message_sender_id uuid,
  add column if not exists last_message_kind text,
  add column if not exists last_message_content_mode text,
  add column if not exists last_message_deleted_at timestamptz,
  add column if not exists last_message_body text;

create index if not exists messages_conversation_id_seq_desc_idx
  on public.messages (conversation_id, seq desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_last_message_id_fkey'
  ) then
    alter table public.conversations
      add constraint conversations_last_message_id_fkey
      foreign key (last_message_id)
      references public.messages (id)
      on delete set null;
  end if;
end
$$;

with latest_message as (
  select distinct on (m.conversation_id)
    m.conversation_id,
    m.id,
    m.seq,
    m.sender_id,
    m.kind,
    m.content_mode,
    m.deleted_at,
    m.body,
    m.created_at
  from public.messages m
  order by m.conversation_id, m.seq desc
)
update public.conversations c
set
  last_message_at = lm.created_at,
  last_message_id = lm.id,
  last_message_seq = lm.seq,
  last_message_sender_id = lm.sender_id,
  last_message_kind = lm.kind,
  last_message_content_mode = lm.content_mode,
  last_message_deleted_at = lm.deleted_at,
  last_message_body = lm.body
from latest_message lm
where c.id = lm.conversation_id;

update public.conversations c
set
  last_message_at = null,
  last_message_id = null,
  last_message_seq = null,
  last_message_sender_id = null,
  last_message_kind = null,
  last_message_content_mode = null,
  last_message_deleted_at = null,
  last_message_body = null
where not exists (
  select 1
  from public.messages m
  where m.conversation_id = c.id
);
