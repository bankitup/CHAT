-- Additive foundation for future KeepCozy unified space timeline events.
--
-- Design goals for this first pass:
-- - keep user-authored messages in public.messages
-- - introduce a separate structured space-scoped event layer
-- - keep the table append-oriented and audit-friendly
-- - include only stable first-pass operational transitions, not broad chat mirroring
-- - allow optional linkage to conversation, message, and primary object refs
-- - use compact summary payloads for event-local render details only
-- - defer RLS, grants, and write-path integration until later branches

do $$
begin
  if to_regclass('public.spaces') is null then
    raise exception
      'Missing public.spaces. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql first.';
  end if;

  if to_regclass('public.conversations') is null then
    raise exception
      'Missing public.conversations. Apply the current messaging schema foundations first.';
  end if;

  if to_regclass('public.messages') is null then
    raise exception
      'Missing public.messages. Apply the current messaging schema foundations first.';
  end if;
end $$;

create table if not exists public.space_timeline_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null
    references public.spaces (id)
    on delete cascade,
  conversation_id uuid
    references public.conversations (id)
    on delete set null,
  message_id uuid
    references public.messages (id)
    on delete set null,
  operational_object_type text,
  operational_object_id text,
  actor_user_id uuid
    references auth.users (id)
    on delete set null,
  event_type text not null
    check (
      event_type in (
        'thread_created',
        'thread_metadata_attached',
        'primary_object_linked',
        'status_changed',
        'thread_closed',
        'thread_reopened'
      )
    ),
  source_kind text not null
    check (
      source_kind in (
        'conversation',
        'conversation_companion_metadata',
        'operational_object',
        'message_asset',
        'system_process',
        'manual_admin'
      )
    ),
  occurred_at timestamptz not null default timezone('utc', now()),
  summary_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint space_timeline_events_operational_object_ref_check
    check (
      (operational_object_type is null and operational_object_id is null)
      or (operational_object_type is not null and operational_object_id is not null)
    ),
  constraint space_timeline_events_operational_object_type_check
    check (
      operational_object_type is null
      or operational_object_type in (
        'service_request',
        'work_order',
        'inspection',
        'procurement_request',
        'issue_case',
        'vendor_assignment',
        'quality_review',
        'space_document'
      )
    ),
  constraint space_timeline_events_summary_payload_object_check
    check (jsonb_typeof(summary_payload) = 'object')
);

comment on table public.space_timeline_events is
'Additive structured event layer for future KeepCozy space-wide operational history. Distinct from public.messages and intended for space-scoped audit/activity views.';

comment on column public.space_timeline_events.space_id is
'Outer operational memory boundary. Every timeline row belongs to exactly one space.';

comment on column public.space_timeline_events.conversation_id is
'Optional thread shell linkage. Nullable because not every space-level event belongs to one conversation.';

comment on column public.space_timeline_events.message_id is
'Optional message-shell correlation. This does not make timeline events the same thing as user-authored messages.';

comment on column public.space_timeline_events.operational_object_type is
'Optional primary structured object kind linked to the event.';

comment on column public.space_timeline_events.operational_object_id is
'Optional primary structured object id linked to the event. Stored as text to avoid prematurely forcing one PK type across future operational tables.';

comment on column public.space_timeline_events.actor_user_id is
'Optional acting user for auditability. Nullable for system-emitted or integration-emitted events.';

comment on column public.space_timeline_events.event_type is
'Structured operational event category used for timeline rendering, routing, and later automation. The first pass is intentionally limited to stable thread/object state transitions.';

comment on column public.space_timeline_events.source_kind is
'Emitter/source classification for the event row. This is separate from authorization and separate from business-record ownership.';

comment on column public.space_timeline_events.occurred_at is
'Business/event occurrence timestamp used for timeline ordering.';

comment on column public.space_timeline_events.summary_payload is
'Compact event-local render details. Not a replacement for message bodies or first-class operational object state.';

comment on column public.space_timeline_events.created_at is
'Row creation timestamp for the structured event record.';

create index if not exists space_timeline_events_space_occurred_at_idx
  on public.space_timeline_events (space_id, occurred_at desc, id desc);

create index if not exists space_timeline_events_space_event_type_occurred_at_idx
  on public.space_timeline_events (space_id, event_type, occurred_at desc, id desc);

create index if not exists space_timeline_events_conversation_occurred_at_idx
  on public.space_timeline_events (conversation_id, occurred_at desc, id desc)
  where conversation_id is not null;

create index if not exists space_timeline_events_message_id_idx
  on public.space_timeline_events (message_id)
  where message_id is not null;

create index if not exists space_timeline_events_object_ref_occurred_at_idx
  on public.space_timeline_events (operational_object_type, operational_object_id, occurred_at desc, id desc)
  where operational_object_type is not null and operational_object_id is not null;

create index if not exists space_timeline_events_actor_occurred_at_idx
  on public.space_timeline_events (actor_user_id, occurred_at desc, id desc)
  where actor_user_id is not null;

-- Intentionally deferred in this first pass:
-- - RLS and grants
-- - write-path integration in current runtime code
-- - dedupe or idempotency keys
-- - automatic mirroring of ordinary user messages into space history
-- - message- or asset-specific foreign keys beyond optional message_id
-- - assignment/invitation enforcement
-- - notification and automation fan-out
-- - event co-rendering inside thread history
