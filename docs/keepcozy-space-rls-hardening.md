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

### Enforcement reading order in this pass

The first hardening pass should evaluate the new KeepCozy layers in this
order:

1. preserve the current `dm | group` runtime contract
2. require explicit `space_members` membership
3. require active `conversation_members` membership when the resource is
   conversation-scoped
4. expose companion metadata and timeline rows only inside that already-valid
   parent boundary
5. treat `audience_mode`, `operator_visible_by_policy`, and
   `external_access_requires_assignment` as stored policy inputs, not
   first-pass bypasses or revocations

Hard rule:

- the first hardening pass may prevent new additive tables from widening access
- it must not silently reinterpret existing parent conversation membership on
  its own

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

### 2A. Operational visibility cases in this pass

The table below makes the first-pass enforcement stance explicit.

| Policy case | Final policy intent | First-pass enforcement result | Why this stays conservative |
| --- | --- | --- | --- |
| `internal-only` thread | operator/internal visibility by default; deny owner/resident/external roles by default | no metadata-only widening and no metadata-only revocation; companion metadata remains visible only to already-authorized active conversation members in the same space | current runtime does not yet carry real KeepCozy role truth that can safely override parent conversation membership |
| `restricted-external` thread | external visibility should stay narrower than ordinary client-facing threads | no widening from metadata; authenticated visibility still requires explicit active conversation membership | the repo does not yet have enough role truth to widen or narrow beyond the parent thread boundary safely |
| `restricted-external` plus `external_access_requires_assignment = true` | contractors/suppliers/inspectors should require durable assignment-aware access | no assignment-based allow rule yet; no metadata-only revocation of existing members either | the repo has no assignment table yet, so the flag cannot act as real assignment truth |
| `operator_visible_by_policy = true` | operator oversight should later widen beyond creator/admin semantics | persist and expose the flag only to already-authorized readers; no standalone read bypass | later branches still need a reviewed operator-overview enforcement mechanism |
| `owner` / `resident` in client-facing operational threads | may later see intended client-facing work without broad browse-all | no audience-mode-only browse rule; first pass still relies on explicit thread membership | owner/resident policy is not yet derivable from current generic runtime roles alone |
| `internal_staff` visibility | later narrower than full operator oversight by default | no standalone internal-staff bypass in this pass | the repo cannot yet distinguish `internal_staff` from other generic runtime roles in enforceable SQL |

Practical rule:

- first-pass enforcement is allowed to be narrower than the final KeepCozy
  policy
- it is not allowed to invent broader or differently-targeted visibility
  without the schema truth to support it

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
- treat the flag as future policy input even when the thread is
  `restricted-external`

Why this is safer:

- the repo does not yet have assignment tables
- the policy matrix explicitly says assignment truth must be durable, not
  guessed from metadata alone

### 5. Timeline row visibility

The first timeline hardening pass should stay more conservative than the final
matrix.

The main rule is:

- timeline visibility must be derived from the row's strongest real parent
  policy context
- generic thread participation role alone is not enough
- if the parent policy context cannot yet be enforced safely, the row should
  stay out of ordinary authenticated reads

### 5A. Timeline visibility basis in this pass

Later KeepCozy enforcement will need to distinguish at least three visibility
bases:

| Visibility basis | Typical row shape | Final policy source | First-pass hardening result |
| --- | --- | --- | --- |
| Conversation-derived | `conversation_id` present and no object parent | parent thread policy plus space boundary | allowed if the viewer is an explicit space member and active conversation member |
| Object-derived | `operational_object_type` and `operational_object_id` present | parent object policy, possibly narrower than thread policy | deferred from authenticated reads |
| Space-derived | no conversation parent and no object parent | space-level operational policy | deferred from authenticated reads |

This first pass hardens only the first basis directly.

That is intentional.

It keeps the first SQL policy traceable to real schema truth instead of
guessing at object or space policy before those layers exist.

### 5B. When timeline visibility should follow thread visibility

Timeline visibility should follow thread visibility only when the row is
clearly conversation-derived and does not depend on a narrower object policy.

Safe first-pass examples:

- `thread_created`
- `thread_metadata_attached`
- `status_changed`
- `thread_closed`
- `thread_reopened`

For those rows, authenticated timeline reads should be allowed only when all
of the following are true:

- the row is linked to `conversation_id`
- the viewer is an explicit `space_members` member for `space_id`
- the viewer is an active `conversation_members` member for `conversation_id`
- the parent conversation `space_id` matches the timeline row `space_id`
- the row is not a `manual_admin` visibility case
- the row is not yet object-sensitive in a way the repo cannot safely enforce

In practice, the first SQL draft enforces this by keeping authenticated reads
limited to conversation-derived, non-object-linked, non-`manual_admin` rows.

### 5C. When timeline visibility should remain more restricted

Timeline visibility should remain narrower than ordinary parent-thread access
whenever the row depends on a policy context the repo cannot yet enforce
safely.

This intentionally defers:

- object-only timeline rows
- space-only timeline rows
- object-derived timeline rows whose visibility would require a real object
  policy
- audited support/admin review rows

The restriction is deliberate for three reasons:

1. a visible thread shell does not prove that every linked object detail is
   equally visible
2. some committed timeline rows may later derive from object-only or
   space-level transitions rather than one conversation shell
3. audited exception rows should never be exposed by accident through a broad
   conversation-membership rule

### 5D. Why generic thread participation role alone is insufficient

Generic `conversation_members.role` is still part of the safe first-pass
baseline, but it is not enough to decide final timeline visibility by itself.

It does not encode:

- whether the viewer is still inside the outer `space_members` boundary
- which `audience_mode` applies to the parent operational thread
- whether `operator_visible_by_policy` should later widen oversight
- whether `external_access_requires_assignment` should later narrow external
  access
- whether the row is conversation-derived, object-derived, or space-derived
- whether the linked operational object should later redact or hide the row

That is why the first SQL draft treats active conversation membership as a
safe ceiling for conversation-derived rows, not as a complete final policy
system.

### 5E. What stays deferred after this draft

Even after the first hardening pass, later branches still need to add:

- object-aware visibility predicates
- space-only timeline visibility predicates
- redaction rules for object-sensitive `summary_payload` data
- audited exception handling for `manual_admin` or support/compliance review
- service-side emitters that classify rows by visibility basis before insert
- read-side helpers or projections optimized for timeline feeds once the
  policy predicates are stable

Important rule:

- runtime integration and read optimization should follow reviewed visibility
  semantics, not invent a looser shortcut for performance first

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
- allow authenticated reads only for conversation-derived,
  non-object-linked, non-`manual_admin` rows
- require both space membership and active conversation membership for those
  reads
- make the deferred visibility bases explicit in comments:
  - object-derived rows
  - space-derived rows
  - audited exception rows

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

### Concrete backend adoption map

The first enforcement pass should be read together with the existing backend
helper seams, not as a replacement for them.

| Path | Current role | Later enforcement-oriented role | Status in this branch |
| --- | --- | --- | --- |
| [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts) `getConversationForUser(...)` | access-checked base conversation shell read | keep as the base conversation allowlist before any companion-aware interpretation | unchanged |
| [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts) `getConversationOperationalThreadContextForUser(...)` | additive conversation-plus-companion read seam | later policy-aware operational-thread read wrapper can compose here after base conversation access succeeds | unchanged in behavior |
| [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts) `getConversationSummaryForUser(...)` | conversation summary loader | later summary-level policy-aware projection seam for companion metadata | unchanged |
| future timeline read wrapper in `src/modules/spaces` or messaging data service | not implemented yet | later access-checked timeline feed loader that applies reviewed timeline visibility basis rules | deferred |
| [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts) | raw companion-table adapter | stays a low-level row adapter; must not become the place where `audience_mode` or operator/assignment policy is interpreted | unchanged |
| [visibility.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/visibility.ts) | personal archive/hide projection helper | remains per-user archive visibility only; must not absorb operational thread policy | unchanged |
| [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts) | space-membership and active-space resolution | remains the outer space boundary source, not the place where thread/timeline policy is interpreted | unchanged |

Practical rule:

- policy-aware reads should compose existing conversation or space boundary
  checks first
- raw table adapters should stay narrow and policy-agnostic
- read-side interpretation belongs in later service wrappers, not in UI
  entrypoints or generic data-access helpers

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

### Concrete future write seams

The later policy-aware write path should stay just as narrow as the read path.

| Path | Current role | Later enforcement-oriented role | Status in this branch |
| --- | --- | --- | --- |
| [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts) `createConversationWithMembers(...)` | generic shell creator for `dm` and `group` | remain the shell creator only; a later operational wrapper should decide whether companion metadata write is allowed | unchanged |
| [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts) `upsertConversationCompanionMetadataWithoutAccessCheck(...)` | raw low-level upsert helper | later access-checked operational-thread create/update wrapper may call it after policy and ownership checks succeed | unchanged |
| [space-timeline-events.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/space-timeline-events.ts) `buildSpaceTimelineEventRow(...)` | low-level row builder only | later service-side emitters may call it after a committed operational transition is classified as timeline-worthy | unchanged |
| [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts) `sendMessage(...)` and `sendMessageWithAttachment(...)` | ordinary chat send flows | should stay outside early operational enforcement and timeline emission work | intentionally unchanged |

Hard rule:

- raw write helpers may build or persist rows
- they must not decide operational visibility, assignment scope, operator
  widening, or audited exception behavior on their own

### Where interpretation should live

Enforcement interpretation should live in later access-checked service
wrappers that already own a durable operational transition or a reviewed
conversation/timeline read.

Recommended homes later:

- messaging data service wrappers above `getConversationForUser(...)` and
  `getConversationSummaryForUser(...)`
- reviewed operational-thread create/update wrappers above
  `createConversationWithMembers(...)`
- later timeline feed readers and emitters in the spaces module

Raw data access should continue living in:

- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
- a later direct timeline table adapter beside
  [space-timeline-events.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/space-timeline-events.ts)
- current generic visibility helpers such as
  [visibility.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/visibility.ts)

Important distinction:

- SQL/RLS sets the conservative read ceiling for the additive KeepCozy tables
- service wrappers decide how and when those rows are composed into later
  runtime reads and writes
- UI/server-action entrypoints should stay thin and should not interpret the
  policy matrix directly

### Existing paths that should remain unchanged on this branch

The following paths should stay out of scope for this enforcement pass:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationHistorySnapshot(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `markConversationRead(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `sendMessage(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `sendMessageWithAttachment(...)`
- [visibility.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/visibility.ts)
  archive/hide projection behavior
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
  active-space and membership lookup behavior

Reason:

- those paths currently own ordinary chat behavior, read-state, personal
  archive state, or outer space resolution
- coupling early operational enforcement into them would widen the branch far
  beyond the additive KeepCozy tables

### What must wait for later runtime-integration and UI work

Even after this first hardening pass, the following should wait for a later
runtime-adoption branch:

- conversation detail payloads that surface companion metadata by default
- inbox or thread-list summaries that surface policy-aware operational badges
- timeline feed queries exposed to page or server-action entrypoints
- UI behavior that distinguishes `internal-only`, `restricted-external`, or
  assignment-scoped visibility in product surfaces
- any user-facing operator-overview or audited exception affordance

Important rule:

- this branch may define the reviewed enforcement ceiling
- a later runtime/UI branch must still choose deliberately where to consume
  that ceiling in actual product reads

## What This Pass Intentionally Does Not Enforce Yet

This branch still defers:

- role-aware denial of already-present non-internal members on an
  `internal-only` thread
- operator visibility widening beyond current thread membership
- assignment-aware external visibility beyond current thread membership
- owner/resident client-facing browse rules beyond current thread membership
- internal-staff delegated visibility beyond current thread membership
- object-policy-aware visibility for object-linked thread details
- object-only timeline visibility
- space-only timeline visibility
- basis-aware timeline projections or materialized read models
- optimization-oriented denormalization before the allow/deny semantics are
  frozen
- audited support/compliance exception workflows
- authenticated insert/update/delete policies for the new KeepCozy tables
- conversation/message RLS rewrites for the active CHAT runtime
- any change to current DM trust mode or decryption boundaries

## Current State vs First Hardening Pass vs Later Target

| Area | Current state | First hardening pass | Later target |
| --- | --- | --- | --- |
| Companion metadata read access | table exists only as additive foundation | authenticated reads require explicit space membership plus active conversation membership | policy-aware widening/narrowing can use KeepCozy role truth and assignment truth |
| Companion metadata writes | deferred | service-side only in practice; no ordinary authenticated write policy yet | reviewed operational-thread wrappers own authenticated or privileged write path |
| `internal-only` / `restricted-external` semantics | policy intent only | stored and readable inside the already-authorized parent thread boundary; no standalone SQL bypass or deny override yet | audience-mode-aware enforcement can narrow or widen only once real KeepCozy role truth exists |
| Operator visibility | policy intent only | no standalone read bypass | audited operator oversight can be implemented once real role truth exists |
| Assignment-scoped external access | policy intent only | no standalone read bypass | explicit assignment truth can narrow/widen external access intentionally |
| Owner/resident/internal-staff boundaries | policy intent only | no standalone audience-mode or role-based browse rule | role-aware enforcement can land once real KeepCozy role truth exists |
| Timeline visibility | additive table only | authenticated reads limited to safe conversation-derived rows with explicit space membership plus active conversation membership | thread/object/space-aware filtering can align to full matrix |
| DM semantics | current runtime | unchanged | unchanged unless a later private-message branch reviews them separately |

## Review Guardrails

- do not rewrite current `public.conversations` or `public.messages` access in
  this branch
- do not treat the companion tables as proof that KeepCozy role enforcement is
  already complete
- do not mistake stored `internal-only`, `restricted-external`, or
  assignment-scoped metadata for fully-enforced runtime access truth
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
