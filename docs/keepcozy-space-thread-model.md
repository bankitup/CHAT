# KeepCozy Space Thread Model

## Purpose

This document defines how threads should live inside a KeepCozy space.

It is intended to guide future schema, policy, inbox, and UI work while staying
aligned with the current CHAT messaging core.

This is a specification document. It does not implement runtime thread-type
changes in the current app.

Related documents:

- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [space-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-model.md)
- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)
- [media-rtc-architecture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/media-rtc-architecture.md)
- [security/e2ee-security-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-security-model.md)

## Design Decisions Locked by This Pass

- keep `public.conversations.kind` as the shell discriminator for `dm` and
  `group`
- model richer KeepCozy thread meaning in a future companion metadata layer
  keyed by `conversation_id`
- keep operational system events distinct from user-authored messages
- keep archive separate from closure
- treat operational threads and private messaging as different trust modes

## 1. Why Space-Scoped Threads Are Needed

KeepCozy spaces are operational containers, not single chat rooms.

One managed property/home/object can involve multiple independent work streams:

- a resident issue
- a contractor execution thread
- a supplier order
- an inspection follow-up
- an internal operator review

Putting all of that into one giant group chat would create:

- weak access boundaries
- noisy unread state
- poor auditability
- mixed audiences in the same conversation
- no clean link between communication and operational work items

The right model is:

- one space is the operational container
- many threads live inside that space
- each thread has a specific purpose, audience, and lifecycle

## 1A. Operational Threads vs Private Messaging

KeepCozy should not treat every thread as the same kind of trust boundary.

### Operational threads

Operational threads are the default KeepCozy mode for:

- service requests
- contractor coordination
- supplier work
- inspections
- incident handling
- internal operator coordination

They should be:

- auditable
- operator-visible within policy
- non-E2EE by default
- suitable for structured object and timeline linkage

### Private messaging

Private messaging may continue to exist in the broader platform, including
current space-scoped DMs and DM E2EE work, but it should be treated as a
separate trust mode.

Important rule:

- private messaging must not become the only durable operational record for a
  space
- operator visibility over operational threads must not be misread as a general
  DM decrypt-rights model

## 2. Recommended Thread Types

Current runtime should continue to treat threads as `public.conversations`.
For KeepCozy, thread purpose should be modeled with a separate operational
thread-type concept rather than overloading `public.conversations.kind`.

Recommended initial operational thread types:

| Thread type | Purpose | Typical audience |
| --- | --- | --- |
| `service_request` | Resident/owner issue intake and discussion | resident/owner + operator |
| `job_coordination` | Contractor execution planning and updates | operator + contractor, sometimes owner/resident |
| `supplier_order` | Procurement, order, delivery, and vendor coordination | operator/internal_staff + supplier |
| `incident_resolution` | Time-sensitive issue handling and incident trail | operator + relevant stakeholders |
| `inspection` | Inspection scheduling, findings, and follow-up | operator + inspector + selected stakeholders |
| `quality_review` | Review of completed work, outcomes, or disputes | operator/internal_staff, optionally owner |
| `internal_ops` | Internal-only operator/staff coordination | operator + internal_staff |
| `general_space_coordination` | Optional broad operational thread for low-structure updates | selected space members only |

Guidance:

- not every space needs every thread type
- most important operational activity should happen in typed threads
- thread type should be a first-class metadata field later, not inferred from
  title text
- the preferred next step is a companion metadata layer, not overloading
  `public.conversations.kind`

## 3. Which Thread Types Are External-Facing vs Internal-Only

Recommended audience classification:

| Thread type | Default audience mode |
| --- | --- |
| `service_request` | external-facing |
| `job_coordination` | restricted-external |
| `supplier_order` | restricted-external |
| `incident_resolution` | mixed, policy-driven |
| `inspection` | restricted-external |
| `quality_review` | mixed, usually internal-first |
| `internal_ops` | internal-only |
| `general_space_coordination` | standard, space-scoped |

Audience mode meanings:

- `external-facing`
  intended for client-facing roles such as owner or resident
- `restricted-external`
  includes external participants, but only the specific ones assigned to that
  workflow
- `internal-only`
  visible only to operator-side roles
- `mixed`
  may include both internal and external participants, but must be deliberate

Implementation guidance:

- thread type and audience mode are related, but not identical
- audience policy should remain explicit, even if the thread type suggests a
  common default

## 4. Thread Ownership and Creation Rules

Recommended default creation rules:

| Thread type | Who may create |
| --- | --- |
| `service_request` | owner, resident, operator |
| `job_coordination` | operator, delegated internal_staff |
| `supplier_order` | operator, delegated internal_staff |
| `incident_resolution` | operator; owner/resident may trigger intake that operator triages into one |
| `inspection` | operator, delegated internal_staff |
| `quality_review` | operator, delegated internal_staff |
| `internal_ops` | operator, delegated internal_staff |
| `general_space_coordination` | operator by default |

Ownership guidance:

- every operational thread should have a responsible owner on the operator side
- thread creator is not always the long-term thread owner
- owner should usually be a person or operator role accountable for the work
  stream, not just the first message sender

Recommended later metadata:

- `created_by_user_id`
- `thread_owner_user_id`
- `created_by_space_role`
- `assigned_team_or_scope` if needed later

## 5. Relationship Between Threads and Operational Objects

Operational threads should usually attach to an operational object, not replace it.

Examples:

- a `service_request` thread may attach to a service request record
- a `job_coordination` thread may attach to a work order
- a `supplier_order` thread may attach to a purchase/order record
- an `inspection` thread may attach to an inspection record

Recommended rule:

- operational object is the durable work record
- thread is the communication lane around that object

Why this matters:

- one object may need more than one thread over time
- one thread may contain discussion that should not be the authoritative state
  of the object
- auditability is cleaner when object status and discussion are distinct

## 6. Participant Visibility Rules by Thread Type

Recommended default participant rules:

| Thread type | Default participants |
| --- | --- |
| `service_request` | requester + operator roles + specifically assigned helpers |
| `job_coordination` | operator roles + assigned contractor + optionally owner/resident if client-visible |
| `supplier_order` | operator roles + assigned supplier + optionally internal finance/ops |
| `incident_resolution` | operator roles + only stakeholders necessary for the incident |
| `inspection` | operator roles + assigned inspector + optionally owner/resident |
| `quality_review` | operator roles + optionally owner if outcome must be shared |
| `internal_ops` | operator + internal_staff only |
| `general_space_coordination` | explicitly selected space members only |

Visibility guardrails:

- external participants must not infer space-wide visibility from one assigned
  thread
- adding a contractor or supplier to one thread must not make them a visible
  participant in unrelated threads
- internal-only threads must never rely on client-side hiding alone

## 7. Required Metadata for Operational Threads

Current runtime already relies on generic conversation metadata such as:

- `id`
- `kind`
- `title`
- `space_id`
- `created_by`
- summary projection fields

KeepCozy operational threads should later add or derive at least:

| Metadata | Why it matters |
| --- | --- |
| `thread_type` | distinguishes operational purpose without overloading `kind` |
| `audience_mode` | supports `standard`, `restricted-external`, `internal-only`, or similar |
| `status` | supports open/active/blocked/resolved/closed style workflows |
| `operational_object_type` | links the thread to a service request, work order, inspection, etc. |
| `operational_object_id` | points to the actual work record |
| `thread_owner_user_id` | gives operator-side accountability |
| `opened_at` | distinguishes creation time from workflow open time if needed |
| `closed_at` | supports resolved/closed lifecycle and reporting |
| `visibility_scope_notes` | optional diagnostic/admin surface, not required for UI |

Recommended design rule:

- keep `public.conversations.kind` as the shell discriminator for `dm` vs `group`
- add operational thread classification separately
- prefer a companion metadata layer keyed by `conversation_id` rather than
  assuming all new fields belong directly on `public.conversations`

## 8. System Events vs User Messages

Operational threads need more than user-authored free text. They also need
durable event semantics such as:

- status changed
- contractor assigned
- supplier removed
- inspection scheduled
- work order closed
- thread marked internal-only

Recommended rule:

- system events should be represented distinctly from normal user messages

Why:

- user messages are authored communication
- system events are structured history/audit records

Current-state note:

- current message runtime only assumes `messages.kind = text | attachment | voice`
- there is no first-class operational system-event message kind in the active
  runtime

Recommended target direction:

- keep user messages in `public.messages`
- add a separate structured event concept later, either as:
  - a dedicated event table tied to conversation timeline rendering, or
  - a future non-user message layer if the product needs timeline co-rendering

Guardrail:

- do not add broad operational meaning to `messages.kind` in the current
  runtime just to simulate a missing event model

Do not fake durable operational events as ordinary user-authored text long term.

## 9. Archive and Closure Behavior

Two separate lifecycle ideas should remain distinct.

### Archive

Archive is a visibility action.

Current runtime already has:

- `conversation_members.hidden_at`

That is useful for:

- per-user hide/archive behavior
- clearing noisy surfaces without deleting history

### Closure

Closure is an operational state.

Recommended target meaning:

- the work stream is resolved, completed, cancelled, or otherwise inactive
- the thread remains readable for audit/history
- new posting rules may tighten after closure depending on policy

Recommended rule:

- do not equate `hidden_at` with closed
- closure should be thread/object status, not personal inbox preference

## 10. Future Compatibility With Policy Modes and Notifications

The thread model should be compatible with both current and future policy layers.

### Policy compatibility

Current runtime already has seeds for future policy work:

- `conversation_members.notification_level`
- `conversation_members.visible_from_seq`
- `conversations.join_policy`

Recommended future additions:

- `audience_mode` for thread visibility class
- `thread_type` for operational purpose
- `status` for workflow lifecycle

### Notification compatibility

Notifications should later be able to vary by thread type and audience, for
example:

- service request notifications for requester-facing threads
- muted supplier logistics noise for non-participants
- internal-only escalation notifications for operator roles

Important rule:

- notification behavior should derive from committed thread metadata and
  membership, not from blob/media inspection or ad hoc client inference

## Current State vs Target State

### Current state in this repository

Current active thread model is intentionally simple:

- threads are `public.conversations`
- `public.conversations.kind` is only `dm` or `group`
- thread membership is `public.conversation_members`
- current thread participation and moderation roles remain generic
  `owner/admin/member`
- message kinds are `text`, `attachment`, and `voice`
- inbox/activity are summary-driven from `last_message_*` projections
- group audience control is limited to `join_policy = open | closed`
- there is no current companion metadata layer for thread type, audience mode,
  or object linkage

This is enough for a messaging product shell, but not yet enough for full
KeepCozy operational threading.

### Target state for KeepCozy

KeepCozy needs a richer thread layer inside a space:

- many context-specific operational threads inside one space
- explicit thread type
- explicit audience mode
- explicit relationship to operational objects
- structured system events
- clear closure semantics beyond personal archive/hide
- operational threads that are operator-visible by policy and auditable by
  default
- private messaging that may remain separate and should not be the primary
  operational system of record

### Key design constraint

The target model should extend the current shell instead of fighting it.

Recommended approach:

- keep `conversation.kind` for shell-level `dm` vs `group`
- add operational thread metadata separately
- prefer a companion metadata layer first, then decide later which fields, if
  any, should be promoted onto `public.conversations`
- keep inbox summary architecture lightweight
- keep thread timeline rendering centered on committed thread/message/event data

## Working Guidance

When later schema or UI work asks “what kind of thread is this?”, answer in two
steps:

1. shell kind
   `dm` or `group`
2. operational thread type and audience
   `service_request`, `job_coordination`, `internal_ops`, and so on, carried by
   the future companion metadata layer

If a future proposal tries to put all operational meaning into `title`,
participant guesswork, or message text alone, it is not modeling threads at the
right level.
