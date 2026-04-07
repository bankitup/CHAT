# KeepCozy Space Policy Matrix

## Purpose

This document defines the first full policy matrix for KeepCozy operational
communication.

It turns the existing role-layering, companion-metadata, timeline, and
access-mapping groundwork into one explicit policy system that later backend
and RLS work can implement directly.

This is still a policy-definition document, not an enforcement branch.

It must not change current production behavior by itself.

Related documents:

- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-space-access-mapping-prep.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-mapping-prep.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
- [keepcozy-space-timeline-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-runtime-boundaries.md)
- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)

## Status In The Sequence

This document should now be treated as the formal policy-definition layer that
comes after:

- role-layering
- companion-metadata contracts
- companion-metadata schema groundwork
- backend thread-object linkage boundaries
- space timeline foundation
- access-mapping preparation

Recommended exact next branch after this one:

- `feature/space-rls-hardening`

Practical status note:

- this branch should now be treated as the semantic source of truth for later
  enforcement work
- the next branch should translate this matrix into reviewed backend and SQL/RLS
  behavior rather than redefining policy intent

Current runtime intentionally remains unchanged while this matrix is being
defined:

- `public.conversations.kind` still means only `dm | group`
- current space and conversation role enums remain `owner | admin | member`
- DMs keep their existing trust boundary and must not inherit operational
  oversight semantics
- companion metadata and timeline rows are still additive foundation, not
  active authorization truth

## 1. Policy Subjects

This matrix covers three policy subjects.

### Plain DM and plain group runtime behavior

This means current conversations that:

- still rely only on the existing shell and membership model
- do not yet have richer operational policy enforced

### Operational thread behavior

This means conversations that later carry companion metadata such as:

- `thread_type`
- `audience_mode`
- `operator_visible_by_policy`
- `external_access_requires_assignment`
- a primary operational object ref

### Committed space timeline event behavior

This means future structured rows in `public.space_timeline_events`.

These rows are not user messages and must never become a separate implicit
permission system.

## 2. Policy Actors

KeepCozy policy must interpret actors in layers, not as one flattened role.

### Global platform roles

These roles are rare and non-bypassing by default:

- `authenticated_user`
- `platform_admin`
- `support_staff`

Default rule:

- global platform role alone does not grant space, thread, object, or timeline
  visibility

### Space roles

These are the main operational roles:

- `owner`
- `resident`
- `operator`
- `internal_staff`
- `contractor`
- `supplier`
- `inspector`

Default rule:

- operational meaning belongs here first

### Thread participation and moderation roles

These remain generic runtime roles:

- `owner`
- `admin`
- `member`
- DM `member` only

Default rule:

- these roles describe thread membership and moderation only
- they do not encode operational job meaning by themselves

## 3. Policy Inputs and Interpretation Order

Later enforcement should resolve policy in this order:

1. global platform role
2. explicit space membership
3. resolved KeepCozy space role
4. current runtime thread membership and moderation state
5. companion metadata:
   - `thread_type`
   - `audience_mode`
   - `operator_visible_by_policy`
   - `external_access_requires_assignment`
6. operational object linkage
7. timeline parent linkage

Hard rule:

- no later helper or predicate should skip directly to companion metadata and
  ignore the outer space boundary

## 4. Policy Outcome Vocabulary

This document uses the following implementation-oriented outcomes.

| Outcome | Meaning |
| --- | --- |
| `allow_by_current_runtime_membership` | current conversation membership is enough for now |
| `allow_by_operational_policy` | future policy should allow visibility within the space without requiring thread-admin semantics |
| `allow_if_client_party_or_explicit_member` | allowed only when the viewer is the intended client-facing stakeholder or has explicit thread membership |
| `allow_if_assignment_scoped` | allowed only with explicit assignment-aware access |
| `allow_if_audited_exception` | not part of ordinary policy; requires explicit audited override |
| `deny_by_default` | hidden unless a later explicit exception is defined |
| `defer_to_object_policy` | final result depends on the linked operational object policy |

## 5. Global Default Rules

The following rules apply across the whole policy system.

### Defaults do most of the work

- ordinary visibility should come from explicit defaults tied to space
  boundary, role layer, audience mode, assignment scope, and parent resource
  linkage
- exceptions should be rare, narrow, and auditable
- no later branch should treat “exception” as a shortcut for missing product
  policy

### Space boundary first

- no thread, object, or timeline visibility without satisfying the outer space
  boundary first

### DM trust mode remains separate

- operational oversight does not grant DM plaintext or decrypt authority
- `operator_visible_by_policy` does not apply to DM privacy

### Metadata is advisory until enforcement lands

- companion metadata is policy input
- it is not standalone authorization truth

### Archive is not closure

- `conversation_members.hidden_at` remains per-user archive/hide state
- closure and reopen are operational lifecycle facts

### Timeline cannot widen parent visibility

- a timeline row must never be easier to see than the thread or object that
  produced it

### Media and documents inherit parent policy

- storage location alone must not decide visibility
- file visibility follows the narrower of thread policy and object policy

## 6. Subject Matrix: Plain DM and Plain Group Behavior

This matrix preserves current runtime semantics until later enforcement
explicitly opts into richer operational policy.

| Subject | Default policy | Explicit exceptions | Must stay unchanged on this branch |
| --- | --- | --- | --- |
| plain DM | membership-based only; no operator oversight by policy | only audited support/compliance exception later | no operational role or companion metadata may widen DM plaintext access |
| plain group without companion metadata | current conversation membership remains the baseline allowlist | later operational upgrade may add metadata-aware policy | absence of metadata must not invent internal-only or restricted-external rules |
| archived DM or group | archive affects only the archiving user’s view | none by default | archive must not act like closure or shared access revocation |

Practical rule:

- if a conversation is still only a plain shell, later enforcement should
  preserve current runtime behavior unless the product intentionally upgrades it
  into an operational thread with explicit metadata and policy

## 7. Subject Matrix: Operational Thread Visibility

This is the main matrix for future companion-metadata-aware thread policy.

### 7A. Default audience-mode matrix

| Audience mode | `operator` | `internal_staff` | `owner` / `resident` | `contractor` / `supplier` / `inspector` | `platform_admin` / `support_staff` |
| --- | --- | --- | --- | --- | --- |
| `standard` | `allow_by_operational_policy` | `allow_if_client_party_or_explicit_member` within delegated scope | `allow_if_client_party_or_explicit_member` | `allow_if_assignment_scoped` or explicit membership only | `allow_if_audited_exception` |
| `external-facing` | `allow_by_operational_policy` | `allow_if_client_party_or_explicit_member` within delegated scope | `allow_if_client_party_or_explicit_member` | `allow_if_assignment_scoped` when actually participating; no external browse-all | `allow_if_audited_exception` |
| `restricted-external` | `allow_by_operational_policy` | `allow_by_operational_policy` only within delegated internal scope | `allow_if_client_party_or_explicit_member` only when the workflow is intentionally client-visible | `allow_if_assignment_scoped` | `allow_if_audited_exception` |
| `internal-only` | `allow_by_operational_policy` | `allow_by_operational_policy` within internal scope | `deny_by_default` | `deny_by_default` | `allow_if_audited_exception` |
| `mixed` | `allow_by_operational_policy` | `allow_if_client_party_or_explicit_member` within delegated scope | `allow_if_client_party_or_explicit_member` | `allow_if_assignment_scoped` plus explicit thread/object fit | `allow_if_audited_exception` |

Interpretation notes:

- `allow_by_operational_policy` does not mean thread-admin authority
- `internal_staff` is intentionally narrower than full operator oversight by
  default
- client-facing roles should not automatically browse all threads of a given
  audience mode without being the relevant party or explicit member
- external service roles never gain space-wide browsing through audience mode
  alone

### 7B. Default rule for each audience mode

The table above is the normative default. In plain language:

| Audience mode | Default visibility rule | Default excluded audience |
| --- | --- | --- |
| `standard` | operator-visible by policy; client-facing viewers need to be the relevant party or explicit member; external service roles stay assignment-scoped | no broad browse-all for external roles |
| `external-facing` | operator-visible by policy; owner/resident are the intended client-facing audience; external service roles still need explicit participation or assignment | no space-wide external browsing |
| `restricted-external` | operator-visible by policy; external service roles require explicit assignment; client-facing visibility exists only when the workflow is intentionally client-visible | no unassigned external access |
| `internal-only` | operator and internal-staff only by default | owner, resident, contractor, supplier, inspector |
| `mixed` | operator-visible by policy; everyone else needs explicit client-facing or assignment-based fit | no assumption that mixed means open to all stakeholders |

Hard default rule:

- if audience mode and assignment scope point in different directions, the
  narrower rule wins

### 7C. Operator visibility: default vs exceptional

| Condition | Policy result |
| --- | --- |
| operational thread in same space | default to operator-visible by policy |
| `operator_visible_by_policy = true` | confirms the default oversight expectation for the thread |
| `operator_visible_by_policy = false` | treat as a future explicit exception candidate; do not assume it creates a private operational context by itself |
| DM or private trust mode | operator visibility does not imply decrypt or plaintext rights |

Operator guardrails:

- do not materialize operator oversight by silently reusing moderation roles as
  business roles
- do not let operator visibility become a hidden support/admin bypass

Operator exception rule:

- no ordinary operational thread should become operator-hidden by accident
- any later operator-hidden exception must be:
  - explicit in policy
  - tied to a clearly defined thread or object category
  - auditable
  - still separate from DM/private-message trust mode

### 7D. Assignment-scoped external access

| External role | Default policy |
| --- | --- |
| `contractor` | visible only when explicitly assigned or explicitly included in the relevant thread/object workflow |
| `supplier` | visible only when explicitly assigned or explicitly included in the relevant procurement/logistics workflow |
| `inspector` | visible only when explicitly assigned or explicitly included in the relevant inspection workflow |

Assignment rules:

- space membership alone is not enough for temporary external roles
- thread membership may remain the current runtime baseline, but final policy
  should still require durable assignment truth
- assignment scope should later limit both thread visibility and linked-object
  visibility

Assignment effect on defaults:

- assignment-scoped access narrows audience-mode defaults for external service
  roles
- it does not widen client-facing roles into internal-only work
- it does not create a support/admin exception path

## 8. Object-Linked Thread Visibility

Operational threads may later link to one primary operational object.

Default rule:

- a viewer must satisfy both:
  - thread visibility policy
  - object visibility policy

Practical implementation rule:

- when thread policy and object policy differ, the narrower one wins

### 8A. Primary object-link interpretation

Primary object linkage changes visibility interpretation in a narrow way.

It does not create a second thread shell and it does not widen who can see a
conversation.

Instead, it introduces a second policy parent for object-derived context.

Consistency rules:

- thread policy controls whether the thread shell is visible at all
- object policy controls whether object-derived details are visible
- primary object linkage may narrow visible context
- primary object linkage must never widen hidden context
- if the same viewer can see both parents, thread context and object context
  may be shown together
- if the viewer can see the thread but not the object, the thread may remain
  visible while object-derived details are redacted

Practical effect:

- a primary object link is a narrowing input for operational detail
- it is not a bypass around thread audience rules

### 8B. Object-link cases

| Case | Policy result |
| --- | --- |
| thread visible, object visible | allow full operational thread context |
| thread visible, object hidden | allow only the thread shell and user-authored communication that is still independently visible; hide object-derived details |
| thread hidden, object visible | do not leak the hidden thread through the object link |
| object policy not defined yet | thread policy controls the shell for now, but object-derived details should stay conservative |

Important rule:

- object linkage must not become a backdoor around restricted-external or
  internal-only audience policy

## 9. Timeline Visibility Matrix

Timeline rows are visibility-dependent projections, not a separate permission
system.

### 9A. When thread and timeline visibility should match

Thread visibility and timeline visibility should match when the timeline row is
acting as a stable projection of the same visible operational lane.

Default match cases:

- a timeline row linked to `conversation_id` and based on
  `conversation_audience`
- a `thread_created`, `thread_closed`, or `thread_reopened` event whose
  meaningful parent is the thread itself
- a thread-scoped `status_changed` row when no narrower object policy applies

Practical rule:

- if the timeline row is fundamentally describing thread lifecycle or thread
  metadata, and there is no narrower object-parent rule, the row should use
  the same visibility ceiling as the parent thread

### 9B. When thread and timeline visibility should differ

Thread visibility and timeline visibility should differ when the committed
event is actually narrower than the visible conversation shell, or when the
event belongs to a different parent resource.

Default differ cases:

- a visible thread linked to a hidden primary object:
  the thread shell may remain visible, while object-derived timeline detail is
  hidden or redacted
- a row linked only to `operational_object_*`:
  the row follows object policy even if the viewer is a generic thread member
- a row linked only to durable `space_id` state:
  the row follows conservative space-level policy, not generic thread
  participation
- an audited support/compliance review row:
  the row follows the audited exception model, not ordinary thread visibility

Important rule:

- timeline visibility may be narrower than thread visibility
- it must never be broader than the strongest parent resource it depends on

### 9C. Visibility-basis matrix

| Timeline visibility basis | Default policy |
| --- | --- |
| `conversation_audience` | inherit from the parent operational thread policy |
| `operational_object_policy` | inherit from the parent object policy |
| `space_policy` | use conservative space-role policy; do not assume broad visibility for all members |
| `manual_admin_review` | visible only through explicit audited exception |

### 9D. Timeline audience rules

| Timeline case | Default policy result |
| --- | --- |
| row linked to `conversation_id` | no broader than the parent thread |
| row linked only to `operational_object_*` | no broader than the parent object |
| row linked only to `space_id` operational state | internal-first and policy-filtered by default |
| row for internal-only thread/object | deny client-facing and external roles by default |
| row for restricted-external workflow | show only to the same assignment-scoped audience that can see the parent resource |

Timeline rules:

- timeline rows must not leak thread titles, object identity, or event
  summaries for resources the viewer cannot see
- timeline visibility must remain separate from per-user archive/hide state
- generic thread moderation role is not enough to decide committed timeline
  visibility by itself

### 9E. Why generic thread role is not enough

Later enforcement must not infer timeline visibility from generic thread role
alone.

That role layer is still useful for conversation membership and moderation, but
it does not answer:

- whether the thread is `internal-only`, `restricted-external`, or `mixed`
- whether external visibility is assignment-scoped
- whether operator oversight applies by policy
- whether the row depends on a hidden primary operational object
- whether the row is a thread-scoped event or a space-scoped event

Practical rule:

- generic thread role may contribute to the final answer
- it must not become the only parent policy input for committed timeline rows

## 10. Closure and Archive Policy

Closure and archive must remain distinct.

| Concept | Default policy meaning |
| --- | --- |
| archive / hide | per-user inbox preference only |
| close / reopen | operational lifecycle state |
| `thread_closed` timeline event | visible only to viewers allowed to see the closed thread/object context |
| `thread_reopened` timeline event | same visibility rule as the reopened work lane |

Rules:

- archiving a thread must not remove operational history for other viewers
- closing a thread must not act like per-user hiding
- reopening a thread must not silently re-grant unrelated external visibility;
  parent thread/object policy still controls who sees it

## 11. Document and Media Visibility Implications

Documents, media, and attachments must follow operational policy, not only
chat or storage mechanics.

| Case | Default policy |
| --- | --- |
| attachment on operational thread with no linked object policy | inherit from thread policy |
| document or media linked to both thread and object | inherit from the narrower of thread policy and object policy |
| internal-only thread media | hidden from owner/resident/external roles by default |
| restricted-external thread media | visible only to the same assignment-scoped participants that can see the parent thread/object |
| client-facing thread media | visible to the intended client-facing audience, not automatically to all external roles |
| DM media | remains under existing DM/private-message rules, not operational-thread policy |

Storage guardrail:

- storage bucket or object path must not be treated as the final permission
  source for KeepCozy visibility

## 12. Explicit Default Rules

The following defaults should be treated as baseline policy unless a documented
exception exists:

- explicit space membership is required before any ordinary space/thread/object
  visibility
- `operator` has operational oversight inside the space by default
- `internal_staff` has narrower delegated internal visibility by default
- `owner` and `resident` do not see internal-only work by default
- `contractor`, `supplier`, and `inspector` are assignment-scoped by default
- operational-thread policy does not change DM trust mode
- timeline visibility inherits from the parent resource
- documents/media inherit from the parent resource
- archive remains user-scoped and separate from closure

## 13. Explicit Exception Rules

Exceptions must be rare, explicit, and auditable.

### Platform-admin and support exceptions

- `platform_admin` and `support_staff` do not get implicit space visibility
- any exceptional read path must be:
  - explicit
  - audited
  - time-bounded where possible
  - narrower than a blanket policy bypass
  - read-oriented by default unless a separately reviewed write path is
    justified later

Allowed shape:

- case-specific operational support or compliance review may later exist
- there is no general emergency override model defined by this matrix
- urgency alone is not an exception mechanism

### Private-thread or private-context exceptions

- if a future operational thread type is intentionally hidden from ordinary
  operator oversight, that exception must be explicit in policy
- it must not be created accidentally through missing metadata or UI hiding
- no general private operational thread category is allowed by default in this
  matrix
- until a later reviewed product rule exists, true private contexts remain DM
  or private-message trust modes, not ordinary operational threads

### Legacy conversations without companion metadata

- absence of companion metadata is not itself an exception
- later enforcement should fall back to the current runtime shell rather than
  inventing audience semantics from missing rows

### What is not an exception mechanism yet

The following must not be treated as policy exceptions by later branches:

- `join_policy`
- `conversation_members.hidden_at`
- current moderation role alone
- missing companion metadata
- storage bucket or object path
- UI-only hiding or labeling
- operator visibility assumptions carried over from DM/private-message trust
  mode
- urgency or support need without explicit audited review

## 14. What Must Wait for Final RLS Hardening

This matrix intentionally stops before final enforcement details.

The later `feature/space-rls-hardening` branch should still decide:

- the exact SQL/RLS predicates for:
  - operational thread visibility
  - assignment-scoped external access
  - object-linked thread visibility
  - timeline visibility
  - document/media visibility
- whether operator oversight is implemented through policy joins,
  materialized membership, or another audited server-side mechanism
- how assignment truth is stored and joined
- how object-derived redaction works when thread shell visibility and object
  visibility diverge
- how conversation-linked vs object-linked vs space-linked timeline rows are
  filtered in one consistent predicate set
- how exceptional support/compliance access is logged and reviewed
- how batched reads, summaries, and indexes expose policy-filtered results
- how storage policies align with thread/object visibility without leaking data

## 15. Guardrails for Later Branches

- do not treat this branch as final RLS or backend enforcement
- do not mutate current `dm | group` shell semantics in order to fit this
  matrix
- do not write operational job-function roles into current moderation enums
- do not treat companion metadata as standalone authorization truth
- do not let timeline rows become their own permission system
- do not assume timeline visibility is always identical to parent thread
  visibility when object-linked or space-scoped policy is narrower
- do not let archive/hide become a substitute for lifecycle policy
- do not widen external participant visibility without assignment-aware truth
- do not invent broad `platform_admin` or `support_staff` overrides without
  explicit audited reasoning
- do not let policy-matrix work silently become RLS hardening without separate
  review

## 16. Non-Goals Of This Branch

This branch must not:

- define the final SQL/RLS predicates that enforce these policies
- change active production `dm` or `group` behavior while freezing policy
  meaning
- collapse business-role semantics into current moderation-role fields
- treat companion metadata as the only source of access truth without space
  boundary, runtime membership, and parent-resource context
- flatten all committed timeline visibility into simple thread visibility when
  object-linked or space-scoped policy is narrower
- create a general platform-admin or support bypass model without case-based
  audit reasoning

Practical reading rule:

- this document defines policy intent and semantic targets
- the later RLS branch must still decide how that intent becomes reviewed
  predicates, joins, redaction behavior, and audited exception handling

## 17. Practical Handoff

This document should be the direct policy input for:

- `feature/space-rls-hardening`

That later branch should translate this matrix into:

- backend enforcement seams
- SQL/RLS predicates
- policy-focused tests
- reviewed exception handling

The matrix should be treated as the product-policy source of truth until a
later reviewed branch intentionally revises it.
