# KeepCozy and CHAT Shared Vocabulary

## Purpose

This document defines the shared vocabulary reference between the existing
CHAT foundation and the upcoming KeepCozy product foundation.

The goal is to reduce naming drift before more KeepCozy runtime work lands.
It should help later schema, backend, UI, and policy branches answer two
questions consistently:

1. which names should stay identical across both systems
2. which names need an explicit translation layer because the current CHAT
   runtime and the KeepCozy product model are not the same thing yet

This is a naming and alignment document, not a runtime redesign.

Related documents:

- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-space-policy-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-policy-matrix.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)
- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
- [group-policy.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/group-policy.ts)

## Working Rules

- Use the current CHAT runtime names when talking about active tables, enums,
  and service helpers.
- Use the KeepCozy product names when talking about future operational meaning,
  audience, policy, and workflow.
- Do not pretend a richer KeepCozy concept already exists in current CHAT
  runtime if it still needs a mapping layer.
- Prefer one canonical shared term when the same concept should mean the same
  thing in both systems.

## 1. Concepts Shared Between CHAT and KeepCozy

These concepts should be treated as shared foundations, even if KeepCozy uses
them in a richer operational way later.

| Shared concept | Why it is shared | Current CHAT expression | KeepCozy expression |
| --- | --- | --- | --- |
| `space` | outer tenancy and access boundary | `public.spaces`, `public.space_members`, `conversations.space_id` | top-level operational container |
| `conversation` shell | active communication container in runtime | `public.conversations` with `kind = dm | group` | still the communication shell inside a space |
| `message` | user-authored communication record | `public.messages` | still user-authored thread content |
| `dm` and `group` | current shell discriminator | `public.conversations.kind` | still valid shell kinds; not replaced by KeepCozy thread types |
| membership | coarse access and participant model | `space_members`, `conversation_members` | still foundational, even when policy grows richer |
| archive/hide | per-user visibility preference | `conversation_members.hidden_at` | still personal archive state, not operational closure |
| media/documents inherit parent visibility | storage alone is not policy | message/media access is conversation-bound today | future object/media policy still inherits parent resource boundary |

## 2. Concepts That Are CHAT-Only For Now

These are current CHAT runtime concepts that should not be mislabeled as
KeepCozy operational concepts.

| CHAT-only concept for now | Why it stays CHAT-specific |
| --- | --- |
| `public.conversations.kind = dm | group` as the only shell discriminator | KeepCozy thread purpose must not overload this field |
| `GroupConversationMemberRole = owner | admin | member` | this is a moderation/membership surface, not a business-role model |
| `SpaceRole = owner | admin | member` in [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts) | this is still a lossy runtime role surface, not the KeepCozy role vocabulary |
| `join_policy = open | closed` | this is not the same thing as `audience_mode` |
| DM privacy and DM E2EE trust mode | this is a separate trust model from operational thread visibility |
| message-level render/runtime concepts | loading, playback, optimistic state, and transport diagnostics are not KeepCozy operational terms |

## 3. Concepts That Are KeepCozy-Only For Now

These concepts already exist in the docs and contract layer, but they are not
yet active runtime truth in CHAT.

| KeepCozy-only concept for now | Why it is not yet a CHAT runtime concept |
| --- | --- |
| `thread_type` | lives in future companion metadata, not `public.conversations.kind` |
| `audience_mode` | future operational visibility input, not current `join_policy` |
| KeepCozy operational space roles | `operator`, `contractor`, `supplier`, `resident`, `internal_staff`, `inspector` do not exist in active runtime enums |
| `operator_visible_by_policy` | future policy input, not active moderation or membership truth |
| `external_access_requires_assignment` | future assignment-scoped policy input, not current membership truth |
| primary operational object linkage | future companion metadata/object model, not current conversation core |
| committed `space_timeline_events` | future structured operational history, not chat messages |
| structured operational closure/reopen lifecycle | future companion/object status model, not current archive/hide semantics |

## 4. Terms That Must Stay Identical Across Both Systems

The following terms should keep one meaning in both CHAT and KeepCozy docs,
contracts, and later code.

| Canonical term | Meaning |
| --- | --- |
| `space` | the outer shared container and access boundary |
| `conversation` | the current runtime/schema shell for a communication container |
| `message` | user-authored communication content |
| `dm` | direct-message shell kind |
| `group` | multi-member shell kind |
| `archive` | per-user hide/archive behavior |
| `closure` | operational closed/resolved lifecycle state, not archive |
| `timeline event` | committed structured operational history row |
| `system event` | structured non-user-authored event concept; not the same thing as an ordinary user message |

Important rule:

- `archive` and `closure` must never collapse into one term
- `timeline event` and `system event` must never be used as synonyms for
  `message`

## 5. Terms That Need An Explicit Translation Layer

These terms are related, but they are not interchangeable yet.

| Product term | Current runtime term | Translation rule |
| --- | --- | --- |
| `thread` | `conversation` | use `thread` in product/policy/UX docs; use `conversation` when referring to active schema, service helpers, or current payloads |
| managed `property/home/object` | `space` | a space is the shared system/container name; property/home/object are business descriptors of what the space represents |
| KeepCozy operational `space role` | current generic `SpaceRole` | translate through the documented compatibility layer; do not write operational roles directly into current runtime enums |
| KeepCozy thread participation expectations | `GroupConversationMemberRole` | current moderation roles stay generic and thread-local; they do not carry operational job meaning |
| `audience_mode` | `join_policy` | both affect who can participate, but they are different layers and must not be conflated |
| committed `timeline event` | no current message-kind equivalent | timeline rows should stay a separate structured layer, not a rename of messages |
| `system event` inside a thread | no first-class current runtime model | future system events may be rendered beside messages, but they should not be forced into `messages.kind` |

## 6. Source-Of-Truth Naming Reference

This section answers which name should be treated as the source-of-truth term
for common cross-product concepts.

| Concept | Source-of-truth name | Rule |
| --- | --- | --- |
| space | `space` | always use `space` as the shared system/container term |
| property / home / object | business descriptor of a `space` | use these as domain descriptions, not as a replacement for the shared container name |
| thread | `thread` for product meaning | use `thread` for future product/UX/policy language; translate to `conversation` when touching current runtime/schema |
| conversation | `conversation` for current runtime meaning | use this when referring to current tables, service helpers, APIs, and shell-level runtime behavior |
| operator | `operator` | KeepCozy operational space-role term; do not translate this to `admin` in product or policy docs |
| contractor | `contractor` | KeepCozy operational space-role term; do not treat as equivalent to generic `member` |
| supplier | `supplier` | KeepCozy operational space-role term; do not treat as equivalent to generic `member` |
| owner / resident | `owner` and `resident` | KeepCozy client-facing operational roles; do not collapse `resident` into `owner` or into current runtime `owner` moderation semantics |
| internal staff | `internal_staff` in contracts, “internal staff” in prose | keep the contract token and the display phrase aligned |
| timeline event | `timeline event` | reserved for committed structured space history |
| system event | `system event` | reserved for structured non-user-authored event semantics, often thread-local or projected |
| archive | `archive` | per-user hide/archive behavior; current runtime source of truth is `conversation_members.hidden_at` |
| closure | `closure` or `closed/resolved status` | operational lifecycle fact; never a synonym for archive |

## 7. Practical Guidance For Later Branches

When writing docs or code in future KeepCozy branches:

- say `conversation` when you mean the current runtime shell or active table
- say `thread` when you mean the user-facing operational communication lane
- say `space role` when you mean KeepCozy business/operational role
- say `thread participation role` or `moderation role` when you mean current
  `owner | admin | member`
- say `timeline event` only for committed structured space history
- say `system event` only for structured non-user-authored event behavior
- say `archive` only for per-user visibility preference
- say `closure` only for operational lifecycle state

## 8. Guardrails

- do not rename `public.conversations` to “threads” in code that touches the
  current runtime schema
- do not rename KeepCozy operational roles into generic moderation terms just
  because the current runtime enums are smaller
- do not use `property`, `home`, or `object` as alternate schema/container
  names when the actual shared container is `space`
- do not call every structured event a `timeline event`
- do not call every hidden or inactive thread “closed”
- do not use `archive` as if it were a shared operational workflow status

## 9. Remaining Ambiguities

The following naming questions are still open enough to deserve later review:

- whether some future KeepCozy UI surfaces should say `thread` everywhere or
  deliberately keep `conversation` in developer-facing/admin tooling
- whether `owner` and `resident` need distinct product-copy guidance in all
  client-facing surfaces or only in policy/backend work
- whether future private-thread or private-context work needs a separate
  vocabulary reference beyond the current DM/private-message trust boundary
- whether thread-local structured system events should eventually get a
  distinct persisted runtime name beyond the generic `system event` term
