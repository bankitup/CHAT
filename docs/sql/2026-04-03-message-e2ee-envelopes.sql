create table if not exists public.message_e2ee_envelopes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  recipient_device_id uuid not null references public.user_devices(id) on delete cascade,
  envelope_type text not null,
  ciphertext text not null,
  used_one_time_prekey_id integer null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, recipient_device_id)
);

comment on table public.message_e2ee_envelopes is
'Opaque per-recipient-device ciphertext envelopes for DM E2EE messages. The server stores and routes these but must not be able to decrypt them.';

comment on column public.message_e2ee_envelopes.envelope_type is
'Signal-style envelope type: prekey_signal_message for session bootstrap or signal_message for an established session.';

comment on column public.message_e2ee_envelopes.ciphertext is
'Serialized opaque ciphertext envelope produced client-side. Not plaintext, not server-decryptable.';

comment on column public.message_e2ee_envelopes.used_one_time_prekey_id is
'Recipient one-time prekey id consumed by the initial encrypted message, when applicable.';

alter table public.message_e2ee_envelopes
drop constraint if exists message_e2ee_envelopes_type_check;

alter table public.message_e2ee_envelopes
add constraint message_e2ee_envelopes_type_check
check (envelope_type in ('prekey_signal_message', 'signal_message'));

create index if not exists message_e2ee_envelopes_recipient_device_idx
on public.message_e2ee_envelopes (recipient_device_id, created_at desc);

alter table public.message_e2ee_envelopes enable row level security;

drop policy if exists message_e2ee_envelopes_insert_sender on public.message_e2ee_envelopes;
create policy message_e2ee_envelopes_insert_sender
on public.message_e2ee_envelopes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.messages m
    where m.id = message_id
      and m.sender_id = auth.uid()
  )
);

drop policy if exists message_e2ee_envelopes_select_sender_or_recipient on public.message_e2ee_envelopes;
create policy message_e2ee_envelopes_select_sender_or_recipient
on public.message_e2ee_envelopes
for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    where m.id = message_id
      and m.sender_id = auth.uid()
  )
  or exists (
    select 1
    from public.user_devices d
    where d.id = recipient_device_id
      and d.user_id = auth.uid()
      and d.retired_at is null
  )
);
