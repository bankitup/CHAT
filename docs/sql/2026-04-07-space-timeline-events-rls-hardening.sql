-- First conservative RLS hardening pass for public.space_timeline_events.
--
-- Goals:
-- - keep timeline rows from becoming broader than the strongest parent resource
-- - allow authenticated reads only for the safest first-pass visibility basis:
--   conversation-derived, non-object-linked, non-manual-admin rows
-- - keep internal-only/restricted-external meaning bounded by existing parent
--   conversation membership until real role and assignment truth exists
-- - keep object-derived, object-only, space-only, and manual-admin cases
--   deferred until real policy truth exists
-- - keep ordinary authenticated writes deferred until reviewed emitters exist

do $$
begin
  if to_regclass('public.space_timeline_events') is null then
    raise exception
      'Missing public.space_timeline_events. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-07-space-timeline-events-foundation.sql first.';
  end if;

  if to_regclass('public.conversations') is null then
    raise exception
      'Missing public.conversations. Apply the current messaging schema foundations first.';
  end if;

  if to_regclass('public.conversation_members') is null then
    raise exception
      'Missing public.conversation_members. Apply the current messaging membership schema first.';
  end if;

  if to_regclass('public.space_members') is null then
    raise exception
      'Missing public.space_members. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql first.';
  end if;
end $$;

grant select on public.space_timeline_events to authenticated;
revoke insert, update, delete on public.space_timeline_events from authenticated;
grant select, insert, update, delete on public.space_timeline_events to service_role;

alter table public.space_timeline_events enable row level security;

drop policy if exists space_timeline_events_select_safe_conversation_scope
on public.space_timeline_events;

create policy space_timeline_events_select_safe_conversation_scope
on public.space_timeline_events
for select
to authenticated
using (
  conversation_id is not null
  and operational_object_type is null
  and operational_object_id is null
  and source_kind <> 'manual_admin'
  and exists (
    select 1
    from public.conversations c
    join public.space_members sm
      on sm.space_id = c.space_id
     and sm.user_id = auth.uid()
    join public.conversation_members cm
      on cm.conversation_id = c.id
     and cm.user_id = auth.uid()
    where c.id = space_timeline_events.conversation_id
      and c.space_id = space_timeline_events.space_id
      and cm.state = 'active'
  )
);

comment on policy space_timeline_events_select_safe_conversation_scope
on public.space_timeline_events is
'First-pass conservative authenticated read policy for KeepCozy timeline rows. Allows only conversation-derived, non-object-linked, non-manual-admin rows to already-authorized space and conversation members. Keeps timeline visibility aligned to the parent conversation ceiling for those safe rows, while deferring object-derived, space-derived, assignment-aware, operator-widened, and audited-exception cases until later policy truth exists.';

notify pgrst, 'reload schema';

-- Intentionally deferred in this first hardening pass:
-- - authenticated insert/update/delete policies
-- - object-derived timeline visibility for authenticated users
-- - space-only timeline visibility for authenticated users
-- - manual_admin/audited exception handling
-- - assignment-aware or operator-visibility widening
-- - role-aware timeline filtering beyond existing parent conversation
--   membership
-- - basis-aware read projections or optimization-oriented denormalization
-- - final redaction logic for object-sensitive summary payloads
