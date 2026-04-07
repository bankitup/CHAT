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

### 7A. Audience-mode matrix

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

### 7B. Operator visibility rules

| Condition | Policy result |
| --- | --- |
| operational thread in same space | `operator` may be visible by policy unless an explicit future exception exists |
| `operator_visible_by_policy = true` | strengthens operator oversight signal; does not grant moderation authority |
| `operator_visible_by_policy = false` | does not automatically hide a thread from all operators; later policy must explain why the exception exists |
| DM or private trust mode | operator visibility does not imply decrypt or plaintext rights |

Operator guardrails:

- do not materialize operator oversight by silently reusing moderation roles as
  business roles
- do not let operator visibility become a hidden support/admin bypass

### 7C. Assignment-scoped external access

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

## 8. Object-Linked Thread Visibility

Operational threads may later link to one primary operational object.

Default rule:

- a viewer must satisfy both:
  - thread visibility policy
  - object visibility policy

Practical implementation rule:

- when thread policy and object policy differ, the narrower one wins

### Object-link cases

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

### 9A. Visibility-basis matrix

| Timeline visibility basis | Default policy |
| --- | --- |
| `conversation_audience` | inherit from the parent operational thread policy |
| `operational_object_policy` | inherit from the parent object policy |
| `space_policy` | use conservative space-role policy; do not assume broad visibility for all members |
| `manual_admin_review` | visible only through explicit audited exception |

### 9B. Timeline audience rules

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

### Future private operational exceptions

- if a future operational thread type is intentionally hidden from ordinary
  operator oversight, that exception must be explicit in policy
- it must not be created accidentally through missing metadata or UI hiding

### Legacy conversations without companion metadata

- absence of companion metadata is not itself an exception
- later enforcement should fall back to the current runtime shell rather than
  inventing audience semantics from missing rows

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
- how exceptional support/compliance access is logged and reviewed
- how batched reads, summaries, and indexes expose policy-filtered results
- how storage policies align with thread/object visibility without leaking data

## 15. Guardrails for Later Branches

- do not mutate current `dm | group` shell semantics in order to fit this
  matrix
- do not write operational job-function roles into current moderation enums
- do not treat companion metadata as standalone authorization truth
- do not let timeline rows become their own permission system
- do not let archive/hide become a substitute for lifecycle policy
- do not widen external participant visibility without assignment-aware truth
- do not let policy-matrix work silently become RLS hardening without separate
  review

## 16. Practical Handoff

This document should be the direct policy input for:

- `feature/space-rls-hardening`

That later branch should translate this matrix into:

- backend enforcement seams
- SQL/RLS predicates
- policy-focused tests
- reviewed exception handling

The matrix should be treated as the product-policy source of truth until a
later reviewed branch intentionally revises it.
