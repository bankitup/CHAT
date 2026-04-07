-- Additive foundation for future operational thread companion metadata.
--
-- Design goals for this first pass:
-- - keep public.conversations.kind unchanged as dm | group
-- - store richer operational meaning beside conversations, not inside them
-- - make the row optional and 1:1 by conversation_id
-- - duplicate space_id intentionally for future space-scoped queries/policy work
-- - cover only the primary operational object ref in this first schema pass
-- - do not introduce secondary related-object link tables yet
-- - defer RLS/policies until the policy matrix and read/write paths are ready

do $$
begin
  if to_regclass('public.conversations') is null then
    raise exception
      'Missing public.conversations. Apply the current messaging schema foundations first.';
  end if;

  if to_regclass('public.spaces') is null then
    raise exception
      'Missing public.spaces. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql first.';
  end if;
end $$;

create table if not exists public.conversation_companion_metadata (
  conversation_id uuid primary key
    references public.conversations (id)
    on delete cascade,
  space_id uuid not null
    references public.spaces (id)
    on delete cascade,
  thread_type text not null
    check (
      thread_type in (
        'service_request',
        'job_coordination',
        'supplier_order',
        'incident_resolution',
        'inspection',
        'quality_review',
        'internal_ops',
        'general_space_coordination'
      )
    ),
  audience_mode text not null
    check (
      audience_mode in (
        'standard',
        'external-facing',
        'restricted-external',
        'internal-only',
        'mixed'
      )
    ),
  status text not null default 'open'
    check (
      status in (
        'open',
        'active',
        'blocked',
        'resolved',
        'closed'
      )
    ),
  operational_object_type text,
  operational_object_id text,
  thread_owner_user_id uuid
    references auth.users (id)
    on delete set null,
  operator_visible_by_policy boolean not null default true,
  external_access_requires_assignment boolean not null default false,
  opened_at timestamptz,
  closed_at timestamptz,
  visibility_scope_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint conversation_companion_metadata_operational_object_ref_check
    check (
      (operational_object_type is null and operational_object_id is null)
      or (operational_object_type is not null and operational_object_id is not null)
    ),
  constraint conversation_companion_metadata_operational_object_type_check
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
  constraint conversation_companion_metadata_closed_at_status_check
    check (
      closed_at is null or status in ('resolved', 'closed')
    ),
  constraint conversation_companion_metadata_lifecycle_window_check
    check (
      opened_at is null or closed_at is null or opened_at <= closed_at
    )
);

comment on table public.conversation_companion_metadata is
'Additive companion metadata for future KeepCozy operational thread semantics. Keeps public.conversations.kind limited to dm/group and keeps archive separate from closure.';

comment on column public.conversation_companion_metadata.conversation_id is
'1:1 parent conversation reference. The companion row is optional; current runtime conversations do not require it.';

comment on column public.conversation_companion_metadata.space_id is
'Duplicated outer space boundary for future space-scoped querying and policy work. Later write paths must keep it aligned with conversations.space_id.';

comment on column public.conversation_companion_metadata.thread_type is
'Operational purpose for the thread. This is additive metadata and must not replace conversations.kind.';

comment on column public.conversation_companion_metadata.audience_mode is
'Operational visibility class such as standard, restricted-external, or internal-only.';

comment on column public.conversation_companion_metadata.status is
'Operational lifecycle state for the thread. Distinct from per-user archive/hide behavior.';

comment on column public.conversation_companion_metadata.operational_object_type is
'Kind of the primary structured work record attached to the thread. Nullable because not every thread needs an object link in the first pass.';

comment on column public.conversation_companion_metadata.operational_object_id is
'Stable identifier for the primary structured work record. Stored as text in the first pass to avoid prematurely forcing one future PK type.';

comment on column public.conversation_companion_metadata.thread_owner_user_id is
'Operator-side accountable owner for the work stream when one is assigned.';

comment on column public.conversation_companion_metadata.operator_visible_by_policy is
'Explicit policy flag for operator oversight. This is separate from DM decryption authority and separate from thread moderation roles.';

comment on column public.conversation_companion_metadata.external_access_requires_assignment is
'Marks whether external participation should remain assignment-scoped instead of being inferred from broad space membership.';

comment on column public.conversation_companion_metadata.opened_at is
'Optional workflow-open timestamp distinct from conversation creation time.';

comment on column public.conversation_companion_metadata.closed_at is
'Optional workflow-close timestamp. Closure remains distinct from conversation_members.hidden_at.';

comment on column public.conversation_companion_metadata.visibility_scope_notes is
'Optional admin/policy note for future diagnostics. Not intended as a primary UI field.';

comment on column public.conversation_companion_metadata.created_at is
'Metadata row creation timestamp. Distinct from conversation creation time so the companion layer can be introduced later without rewriting conversation history.';

comment on column public.conversation_companion_metadata.updated_at is
'Last metadata update timestamp. This first pass does not add an automatic trigger; future write paths should maintain it explicitly until a trigger strategy is chosen.';

create index if not exists conversation_companion_metadata_space_updated_at_idx
  on public.conversation_companion_metadata (space_id, updated_at desc);

create index if not exists conversation_companion_metadata_space_thread_type_status_idx
  on public.conversation_companion_metadata (space_id, thread_type, status);

create index if not exists conversation_companion_metadata_space_audience_mode_status_idx
  on public.conversation_companion_metadata (space_id, audience_mode, status);

create index if not exists conversation_companion_metadata_object_ref_idx
  on public.conversation_companion_metadata (operational_object_type, operational_object_id)
  where operational_object_type is not null and operational_object_id is not null;

create index if not exists conversation_companion_metadata_thread_owner_user_id_idx
  on public.conversation_companion_metadata (thread_owner_user_id)
  where thread_owner_user_id is not null;

-- Intentionally deferred in this first pass:
-- - RLS and grants
-- - triggers to auto-maintain updated_at
-- - repeated or secondary object-ref columns on the companion row
-- - related-object link tables
-- - invitation/assignment tables
-- - timeline event tables
-- - strict cross-table enforcement that space_id must equal conversations.space_id
