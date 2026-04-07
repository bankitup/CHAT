# KeepCozy Space RLS Hardening

## Purpose

This document defines the first enforcement-oriented hardening pass for
KeepCozy operational thread semantics.

It translates the frozen policy matrix into a narrow, reviewable SQL/RLS
direction without broadening current CHAT runtime behavior.

This is the first enforcement bridge, not the final product-complete policy
implementation.

Primary SQL drafts:

- [2026-04-07-conversation-companion-metadata-rls-hardening.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-conversation-companion-metadata-rls-hardening.sql)
- [2026-04-07-space-timeline-events-rls-hardening.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-space-timeline-events-rls-hardening.sql)

Related documents:

- [keepcozy-space-policy-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-policy-matrix.md)
- [keepcozy-space-access-mapping-prep.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-mapping-prep.md)
- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
- [keepcozy-space-timeline-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-runtime-boundaries.md)
- [keepcozy-space-backend-thread-object-links.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-backend-thread-object-links.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
- [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts)
- [space-timeline-events.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/space-timeline-events.ts)
- [visibility.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/visibility.ts)
- [service.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/lib/supabase/service.ts)

## Hardening Goal

The first hardening pass should do three things well:

1. keep current `dm | group` runtime behavior stable
2. make new additive KeepCozy tables safer than plain open-access defaults
3. avoid pretending that unfinished role, assignment, and object-policy models
   already exist

The result should be conservative on purpose.

If the branch cannot enforce a policy case safely from real schema truth, it
should deny or defer rather than inventing a broad allow rule.

## What This Pass Hardens Now

This pass is intentionally limited to the additive KeepCozy layers:

- `public.conversation_companion_metadata`
- `public.space_timeline_events`

It does not rewrite enforcement for:

- `public.conversations`
- `public.conversation_members`
- `public.messages`
- current DM privacy rules
- current group join/runtime behavior

That boundary keeps the branch narrow and preserves current production
assumptions while the new KeepCozy layers are still additive.

## Current Enforcement Baseline

The current repository already has real policy patterns in active runtime:

- conversation access is still effectively bounded by active
  `public.conversation_members`
- archive/hide remains per-user state through
  `conversation_members.hidden_at`
- DM privacy already blocks owner/admin semantics and more-than-two active
  participants
- message assets already use conversation-member-based RLS

The first KeepCozy hardening pass should reuse that baseline instead of
inventing a separate access model too early.

Practical consequence:

- authenticated visibility for the new KeepCozy tables should start from
  current space plus active conversation membership
- companion metadata must not widen access beyond the parent thread
- timeline rows must not widen access beyond the strongest parent resource they
  depend on

## First-Pass Enforcement Rules

### 1. Companion metadata read boundary

Authenticated read access to `public.conversation_companion_metadata` should
require:

- explicit `space_members` membership for the row `space_id`
- active `conversation_members` membership for the row `conversation_id`
- parent conversation `space_id` matching the companion row `space_id`

Why this is the first safe rule:

- it preserves the outer space boundary
- it preserves the current conversation-level allowlist
- it does not guess at future operator widening or external assignment rules

Important rule:

- `operator_visible_by_policy` is not a first-pass read bypass
- `external_access_requires_assignment` is not a first-pass read bypass
- companion metadata stays policy input, not standalone authorization truth

### 2. Operational thread visibility semantics

The first hardening pass should not try to materialize the full policy matrix
directly inside the existing generic runtime role fields.

That means:

- no policy widening from `operator_visible_by_policy` alone
- no external-role visibility widening from `audience_mode` alone
- no attempt to project `contractor`, `supplier`, `resident`, or `operator`
  into current moderation-role columns

First-pass enforcement rule:

- authenticated access to operational-thread metadata stays no broader than the
  current thread member set

This is intentionally narrower than the final KeepCozy target.

It is acceptable because:

- the policy matrix explicitly says companion metadata must not become its own
  permission system
- later branches still need real KeepCozy role truth and assignment truth
  before widening beyond current conversation membership

### 3. Operator visibility semantics

The matrix freezes `operator_visible_by_policy` as a first-class policy fact,
but the first SQL/RLS pass should still treat it conservatively.

First-pass rule:

- persist and expose the flag to already-authorized readers
- do not use it as a standalone reason to bypass thread membership
- do not let it affect DM privacy or decrypt assumptions

This keeps the branch aligned with the matrix:

- operator visibility is real product policy
- but audited enforcement shape still needs a later reviewed mechanism

Examples of later mechanisms that remain deferred:

- policy joins against future KeepCozy role truth
- audited service-side expansion for operator oversight
- materialized operator membership into selected operational threads

### 4. Assignment-scoped external access semantics

`external_access_requires_assignment` should remain a narrowing input, not a
first-pass allow rule.

First-pass rule:

- do not widen visibility for external participants from this flag
- do not infer assignment truth from conversation membership alone
- keep authenticated read access bounded by current conversation membership

Why this is safer:

- the repo does not yet have assignment tables
- the policy matrix explicitly says assignment truth must be durable, not
  guessed from metadata alone

### 5. Timeline row visibility

The first timeline hardening pass should stay more conservative than the final
matrix.

Authenticated timeline reads should be allowed only when all of the following
are true:

- the row is linked to `conversation_id`
- the viewer is an explicit `space_members` member for `space_id`
- the viewer is an active `conversation_members` member for `conversation_id`
- the parent conversation `space_id` matches the timeline row `space_id`
- the row is not a `manual_admin` visibility case
- the row is not yet object-sensitive in a way the repo cannot safely enforce

In practice, the first SQL draft enforces this by keeping authenticated reads
limited to conversation-linked, non-object-linked, non-`manual_admin` rows.

This intentionally defers:

- object-only timeline rows
- space-only timeline rows
- object-linked timeline rows whose visibility would require a real object
  policy
- audited support/admin review rows

That restriction is deliberate.

It preserves the matrix rule that timeline visibility must never be broader
than the strongest parent resource, even before object policy exists.

## Why Object-Linked Timeline Rows Stay Deferred

The policy matrix says object-linked visibility may narrow what a viewer can
see even when the thread shell remains visible.

The repo does not yet have:

- real operational object tables
- audited object-policy predicates
- redaction rules for object-derived timeline detail

So the first hardening pass should not guess.

Safer first-pass rule:

- if a timeline row depends on object visibility, keep it out of ordinary
  authenticated reads until the object-policy layer is real

That is narrower than the final target, but it is semantically correct and
reviewable.

## SQL Draft Shape

### Companion metadata SQL hardening

The companion-metadata SQL draft should do the following:

- enable RLS on `public.conversation_companion_metadata`
- grant authenticated users `select` only
- keep insert/update/delete on a service-side path for now
- require both space membership and active conversation membership for
  authenticated reads
- enforce read-time `space_id` consistency against the parent conversation

### Timeline SQL hardening

The timeline SQL draft should do the following:

- enable RLS on `public.space_timeline_events`
- grant authenticated users `select` only
- keep insert/update/delete on a service-side path for now
- allow authenticated reads only for conversation-linked,
  non-object-linked, non-`manual_admin` rows
- require both space membership and active conversation membership for those
  reads

## Backend Alignment

The current backend seams remain valid.

### Read boundaries

These files are still the right read-side seams:

- [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts)
- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationForUser(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationSummaryForUser(...)`

Important rule:

- the backend helper boundary stays additive
- the SQL layer may now enforce a conservative read ceiling
- later application-level helpers must still not invent broader access outside
  the reviewed policy matrix

### Write boundaries

The first hardening pass intentionally does not add authenticated write
policies for companion metadata or timeline events.

That means later write branches should use one of these reviewed approaches:

- a service-role backed server-side write path using
  [service.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/lib/supabase/service.ts)
- a reviewed `security definer` function layer
- a later authenticated write policy branch once operational-thread creation
  and object workflows are concrete

Important rule:

- do not treat current UI/session-bound writes as ready for direct companion or
  timeline writes just because the tables exist

## What This Pass Intentionally Does Not Enforce Yet

This branch still defers:

- operator visibility widening beyond current thread membership
- assignment-aware external visibility beyond current thread membership
- object-policy-aware visibility for object-linked thread details
- object-only timeline visibility
- space-only timeline visibility
- audited support/compliance exception workflows
- authenticated insert/update/delete policies for the new KeepCozy tables
- conversation/message RLS rewrites for the active CHAT runtime
- any change to current DM trust mode or decryption boundaries

## Current State vs First Hardening Pass vs Later Target

| Area | Current state | First hardening pass | Later target |
| --- | --- | --- | --- |
| Companion metadata read access | table exists only as additive foundation | authenticated reads require explicit space membership plus active conversation membership | policy-aware widening/narrowing can use KeepCozy role truth and assignment truth |
| Companion metadata writes | deferred | service-side only in practice; no ordinary authenticated write policy yet | reviewed operational-thread wrappers own authenticated or privileged write path |
| Operator visibility | policy intent only | no standalone read bypass | audited operator oversight can be implemented once real role truth exists |
| Assignment-scoped external access | policy intent only | no standalone read bypass | explicit assignment truth can narrow/widen external access intentionally |
| Timeline visibility | additive table only | authenticated reads limited to safe conversation-linked rows | thread/object/space-aware filtering can align to full matrix |
| DM semantics | current runtime | unchanged | unchanged unless a later private-message branch reviews them separately |

## Review Guardrails

- do not rewrite current `public.conversations` or `public.messages` access in
  this branch
- do not treat the companion tables as proof that KeepCozy role enforcement is
  already complete
- do not widen object-linked visibility before object policy is real
- do not use `operator_visible_by_policy` as a silent admin/support bypass
- do not use `external_access_requires_assignment` as a substitute for real
  assignment data
- do not collapse business-role semantics into current moderation-role fields

## Practical Handoff

This hardening pass should be read as:

- the first conservative enforcement layer for the additive KeepCozy tables
- the semantic bridge from the policy matrix into SQL/RLS
- not the final product-complete access system

The safest follow-on after this branch is:

- implement one narrow operational object path on top of these reviewed
  enforcement boundaries
- widen object-linked and assignment-aware visibility only when real schema
  truth exists to support it
