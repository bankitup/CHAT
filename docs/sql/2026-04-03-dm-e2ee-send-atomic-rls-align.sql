-- Operational alignment patch for encrypted DM send reliability.
-- Problem addressed:
-- - send_dm_e2ee_message_atomic previously ran as SECURITY INVOKER
-- - recipient one-time prekey claim could fail under RLS/policy constraints
-- This patch hardens the function to run as SECURITY DEFINER while validating
-- the sender, conversation membership, and allowed recipient devices.

create or replace function public.send_dm_e2ee_message_atomic(
  p_conversation_id uuid,
  p_reply_to_message_id uuid,
  p_client_id uuid,
  p_sender_device_id uuid,
  p_envelopes jsonb
)
returns table (
  message_id uuid,
  created_at timestamptz,
  client_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid;
  v_counterpart_id uuid;
  v_message_id uuid := gen_random_uuid();
  v_now timestamptz := timezone('utc', now());
  v_envelope jsonb;
  v_recipient_device_id uuid;
  v_claimed_prekey uuid;
begin
  v_sender_id := auth.uid();

  if v_sender_id is null then
    raise exception 'dm_e2ee_unauthorized';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = p_conversation_id
      and cm.user_id = v_sender_id
      and cm.state = 'active'
      and c.kind = 'dm'
  ) then
    raise exception 'dm_e2ee_conversation_unavailable';
  end if;

  select cm.user_id
  into v_counterpart_id
  from public.conversation_members cm
  where cm.conversation_id = p_conversation_id
    and cm.state = 'active'
    and cm.user_id <> v_sender_id
  order by cm.user_id asc
  limit 1;

  if v_counterpart_id is null then
    raise exception 'dm_e2ee_recipient_unavailable';
  end if;

  if not exists (
    select 1
    from public.user_devices d
    where d.id = p_sender_device_id
      and d.user_id = v_sender_id
      and d.retired_at is null
  ) then
    raise exception 'dm_e2ee_sender_device_stale';
  end if;

  if jsonb_typeof(p_envelopes) <> 'array' or jsonb_array_length(p_envelopes) = 0 then
    raise exception 'dm_e2ee_missing_envelopes';
  end if;

  for v_envelope in
    select value
    from jsonb_array_elements(p_envelopes)
  loop
    v_recipient_device_id := (v_envelope ->> 'recipientDeviceRecordId')::uuid;

    if not exists (
      select 1
      from public.user_devices d
      where d.id = v_recipient_device_id
        and d.retired_at is null
        and d.user_id in (v_sender_id, v_counterpart_id)
    ) then
      raise exception 'dm_e2ee_recipient_unavailable';
    end if;

    if (v_envelope ->> 'usedOneTimePrekeyId') is null then
      continue;
    end if;

    update public.device_one_time_prekeys
    set claimed_at = v_now
    where device_id = v_recipient_device_id
      and prekey_id = (v_envelope ->> 'usedOneTimePrekeyId')::integer
      and claimed_at is null
    returning id into v_claimed_prekey;

    if v_claimed_prekey is null then
      raise exception 'dm_e2ee_prekey_conflict';
    end if;

    v_claimed_prekey := null;
  end loop;

  insert into public.messages (
    id,
    conversation_id,
    sender_id,
    sender_device_id,
    reply_to_message_id,
    kind,
    client_id,
    body,
    content_mode
  )
  values (
    v_message_id,
    p_conversation_id,
    v_sender_id,
    p_sender_device_id,
    p_reply_to_message_id,
    'text',
    p_client_id,
    null,
    'dm_e2ee_v1'
  );

  insert into public.message_e2ee_envelopes (
    message_id,
    recipient_device_id,
    envelope_type,
    ciphertext,
    used_one_time_prekey_id
  )
  select
    v_message_id,
    (value ->> 'recipientDeviceRecordId')::uuid,
    value ->> 'envelopeType',
    value ->> 'ciphertext',
    nullif(value ->> 'usedOneTimePrekeyId', '')::integer
  from jsonb_array_elements(p_envelopes);

  update public.conversations
  set last_message_at = v_now
  where id = p_conversation_id;

  return query
  select v_message_id, v_now, p_client_id;
end;
$$;

comment on function public.send_dm_e2ee_message_atomic(uuid, uuid, uuid, uuid, jsonb) is
'Atomically claims recipient one-time prekeys, inserts encrypted DM message shell/envelopes, and updates conversation recency. Runs as SECURITY DEFINER with explicit sender/recipient validation. This function must not receive plaintext.';

grant execute on function public.send_dm_e2ee_message_atomic(uuid, uuid, uuid, uuid, jsonb) to authenticated;
