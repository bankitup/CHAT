# KeepCozy and CHAT Integration Seam

## Purpose

This document defines the practical integration seam between the existing CHAT
foundation and the upcoming KeepCozy foundation work.

The goal is to make future KeepCozy implementation start from one explicit
boundary instead of rediscovering:

- who owns which layer
- which names are shared
- how a future test object should attach to the existing CHAT test space
- what must be stable before object-level integration begins

This is an integration handoff guide, not a runtime redesign.

Related documents:

- [space-governance-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-governance-foundation.md)
- [space-profiles.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-profiles.md)
- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [keepcozy-space-backend-thread-object-links.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-backend-thread-object-links.md)
- [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
- [keepcozy-space-policy-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-policy-matrix.md)
- [keepcozy-chat-shared-vocabulary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-shared-vocabulary.md)
- [keepcozy-chat-role-alignment.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-role-alignment.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [space-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-model.md)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)

## Integration Principle

KeepCozy should attach to CHAT as an operational layer around the existing
space and conversation foundation.

That means:

- CHAT remains the communication shell and current runtime
- KeepCozy adds operational meaning, object linkage, and workflow context
- shared identifiers and shared vocabulary stay stable
- future object integration should be additive, not a rename of current
  messaging tables

Important rule:

- KeepCozy should attach to the current CHAT `space` boundary
- it should not introduce a second outer container just to model one test
  property or home

## 1. What KeepCozy Will Own

KeepCozy should own the layers that are operational rather than purely
messaging-oriented.

### Product and domain ownership

KeepCozy should own:

- property/home/object identity as business-domain meaning inside a `space`
- operational object tables introduced later
- business workflow lifecycle such as open, closed, resolved, assigned
- client-facing vs internal operational semantics
- assignment meaning for contractors, suppliers, inspectors, and similar roles
- operator-facing workflow decisions and audited operational visibility rules

### Future runtime ownership

KeepCozy should later own:

- the first real operational object path
- object-linked thread creation wrappers
- operational status transitions
- object-linked timeline emission logic
- product surfaces that present operational threads, objects, and timeline
  views

Important rule:

- KeepCozy should own operational meaning
- it should not take ownership of the low-level message shell, DM E2EE, or
  generic group moderation runtime

## 2. What CHAT Will Own

CHAT should continue owning the generic communication core.

### Current runtime ownership

CHAT owns:

- `public.spaces` and current space selection/runtime routing
- `public.space_members` as the active coarse space boundary
- `public.conversations` as the active communication shell
- `public.conversation_members` as the active thread membership shell
- `public.messages` as user-authored message history
- message/media send, load, visibility, and delivery behavior
- current `dm | group` semantics
- current DM privacy and DM E2EE trust mode
- current archive/hide behavior through `conversation_members.hidden_at`

### Ongoing architectural ownership

CHAT should continue owning:

- the generic messaging service layer
- current message-history loading
- current inbox/activity/chat entry behavior
- the compatibility surfaces that KeepCozy will attach to later

Important rule:

- CHAT remains the communication substrate
- KeepCozy should not require CHAT to rename `conversation` into `thread` in
  active runtime code or to overload `public.conversations.kind`

## 3. Shared Contract Entities

The following entities should be treated as shared contracts between CHAT and
KeepCozy.

| Shared contract | Owned primarily by | Why it is shared |
| --- | --- | --- |
| `space` | CHAT runtime foundation, reused by KeepCozy | outer tenancy, routing, and access boundary |
| `space_members` | CHAT runtime foundation, later interpreted by KeepCozy policy | coarse member allowlist and compatibility role surface |
| `conversation` shell | CHAT runtime foundation | active communication container that future KeepCozy threads attach to |
| companion metadata contract | shared contract layer | carries future operational thread meaning without mutating conversation core |
| operational object ref contract | shared contract layer | lets KeepCozy attach durable objects to conversation shells later |
| space timeline event contract | shared contract layer | lets KeepCozy connect thread/object transitions into one operational history surface |
| shared vocabulary and role alignment | shared docs/contracts | prevents naming and role drift between products |

Practical rule:

- shared contracts should stay product-neutral where possible
- product-specific behavior should be layered on top of them, not written back
  into current CHAT shell concepts

## 4. How KeepCozy Should Attach To The Existing CHAT Test Space

The future KeepCozy foundation should attach to the current default CHAT
`TEST` space rather than introducing a second parallel test container.

### Recommended approach

Use the existing default `TEST` space as the first integration sandbox for
KeepCozy work.

That means:

- reuse the existing `public.spaces` row named `TEST`
- reuse its current `space_id` as the outer boundary for future test-object
  work
- keep new KeepCozy artifacts inside that same `space_id`
- do not rename the existing test space just to make it sound more
  KeepCozy-specific

### Why this is the safest seam

This avoids three unnecessary sources of drift:

1. a second container name for the same outer context
2. a second role vocabulary for the same members
3. a second test sandbox that competes with the current `TEST`-space rollout

### Practical integration rule

When KeepCozy starts its first real object integration:

- select or resolve the current `TEST` space using existing space-selection or
  documented fallback behavior
- create future KeepCozy object rows with that `space_id`
- attach future operational threads to the same `space_id`
- keep companion metadata and timeline rows scoped to the same `space_id`

Important rule:

- the object should attach to the existing `TEST` space
- the space should not be recreated around the object

## 5. How A Future Test Object Should Link Later

The first future KeepCozy test object should attach to the existing test space
through additive links, not through naming rewrites.

### Recommended relationship shape

The later object integration should look like this:

1. one existing `space` remains the outer boundary
2. one future operational object row is created inside that `space_id`
3. one or more existing or newly created conversation shells may attach to
   that object through companion metadata
4. committed timeline rows may later point at both the `space_id` and the
   primary object reference

### Recommended first-pass link path

For the first object integration:

- create the object with a direct `space_id`
- keep the conversation shell in `public.conversations`
- write the primary object reference into companion metadata through:
  - `operational_object_type`
  - `operational_object_id`
- emit future timeline rows that may reference:
  - `space_id`
  - `conversation_id`
  - primary operational object ref

### Why this avoids rework later

This preserves the agreed architecture:

- `space` remains the outer container
- `conversation` remains the communication shell
- object identity remains a first-class business record
- timeline remains structured operational history

No later branch should need to reopen:

- the `space` name
- the role layers
- the `conversation` shell
- the thread-vs-conversation vocabulary split

## 6. What Must Be In Place Before Object-Level Integration Begins

The following should be treated as prerequisites before the first KeepCozy
object is attached to the current CHAT foundation.

### Already-established prerequisites

These are already defined in the current docs/contracts set:

- shared vocabulary reference
- role alignment reference
- companion metadata contract and schema foundation
- backend thread-object linkage seam
- timeline foundation
- policy matrix
- conservative RLS hardening direction

### Practical implementation prerequisites

Before the first object integration branch starts, the following should be
clear:

- which object type is being introduced first
- how that object stores `space_id`
- how object creation and companion-metadata writes will be sequenced
- which thread type and audience mode are expected for the first object flow
- which members in the current `TEST` space are allowed to see the object
- what first-pass timeline events should be emitted for object creation/linking
- what data remains authoritative on the object vs on the thread

Important rule:

- do not begin object work until the object has a clear `space_id`-first
  ownership model
- do not use thread membership alone as a substitute for object ownership or
  assignment truth

## 7. What Should Explicitly Wait Until KeepCozy Foundation Is Ready

The following work should wait until the KeepCozy foundation is ready rather
than being improvised during the first test-object branch.

### Wait on product/UI work

- broad UI relabeling of conversations into threads across current CHAT
- user-facing KeepCozy object dashboards beyond the first narrow test path
- client-side role-specific visibility treatment without backend truth

### Wait on policy and enforcement expansion

- broad assignment-aware external access beyond the first reviewed case
- object-derived visibility widening without real object policy
- operator/support exception handling beyond the documented narrow model

### Wait on schema broadening

- many-to-many object links
- related-object link tables
- generalized storage migration away from current message-media paths
- broad timeline fan-out from every operational or message event

### Wait on trust-mode changes

- any attempt to reinterpret DM privacy as operational oversight
- any attempt to treat private messaging as the operational source of truth for
  a space

## 8. Practical Handoff For The First Test Object

When the first real KeepCozy test object is introduced later, the safest
handoff should be:

1. keep using the existing `TEST` space as the outer sandbox
2. create one first-class object row with a direct `space_id`
3. attach one operational conversation shell through companion metadata
4. keep current CHAT message behavior unchanged inside that conversation
5. add only the minimum object-linked timeline events needed for the first
   workflow
6. avoid reopening naming, role, or outer-container decisions in that branch

Success condition:

- the first KeepCozy object proves that CHAT and KeepCozy can share one
  `space` boundary cleanly
- future work can grow object and UI depth without reworking the naming and
  ownership seam again
