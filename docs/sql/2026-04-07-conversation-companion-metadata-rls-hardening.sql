-- First conservative RLS hardening pass for
-- public.conversation_companion_metadata.
--
-- Goals:
-- - keep current dm/group runtime behavior unchanged
-- - make companion metadata readable only to users already inside the
--   parent space and parent conversation boundary
-- - treat operator/assignment flags as policy inputs, not first-pass bypasses
-- - keep ordinary authenticated writes deferred until reviewed operational
--   write paths exist

do $$
begin
  if to_regclass('public.conversation_companion_metadata') is null then
    raise exception
      'Missing public.conversation_companion_metadata. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-07-conversation-companion-metadata-foundation.sql first.';
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

grant select on public.conversation_companion_metadata to authenticated;
revoke insert, update, delete on public.conversation_companion_metadata from authenticated;
grant select, insert, update, delete on public.conversation_companion_metadata to service_role;

alter table public.conversation_companion_metadata enable row level security;

drop policy if exists conversation_companion_metadata_select_space_and_active_members
on public.conversation_companion_metadata;

create policy conversation_companion_metadata_select_space_and_active_members
on public.conversation_companion_metadata
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    join public.space_members sm
      on sm.space_id = c.space_id
     and sm.user_id = auth.uid()
    join public.conversation_members cm
      on cm.conversation_id = c.id
     and cm.user_id = auth.uid()
    where c.id = conversation_companion_metadata.conversation_id
      and c.space_id = conversation_companion_metadata.space_id
      and cm.state = 'active'
  )
);

comment on policy conversation_companion_metadata_select_space_and_active_members
on public.conversation_companion_metadata is
'First-pass conservative authenticated read policy for additive KeepCozy companion metadata. Requires both explicit space membership and active parent-conversation membership. Does not widen access from operator visibility or assignment flags yet.';

notify pgrst, 'reload schema';

-- Intentionally deferred in this first hardening pass:
-- - authenticated insert/update/delete policies
-- - operator-visibility widening beyond current conversation membership
-- - assignment-aware external widening beyond current conversation membership
-- - object-policy-aware redaction for companion metadata projections
-- - audited support/compliance exception paths
