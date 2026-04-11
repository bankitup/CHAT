# Space Profile Capability Matrix

## Purpose

This document defines the initial capability matrix for the first two space
profiles in the BWC platform repository:

- `messenger_full`
- `keepcozy_ops`

The goal is to give later routing, shell, and policy branches one explicit
reference for how these profiles should differ without inventing separate
backends, widening platform modules into product policy, or drifting into many
unrelated feature flags.

This is a profile-default document, not final enforcement.

Related documents:

- [space-profiles.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-profiles.md)
- [keepcozy-chat-integration-seam.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-integration-seam.md)
- [keepcozy-space-policy-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-policy-matrix.md)
- [keepcozy-chat-shared-vocabulary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-shared-vocabulary.md)
- [keepcozy-mvp-boundary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-boundary.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [posture.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/posture.ts)
- [access.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/access.ts)
- [shell.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/shell.ts)
- [contract-types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/contract-types.ts)

## Scope of This Matrix

This matrix defines profile defaults for:

- shell emphasis
- expected top-level visibility
- what should be primary versus secondary in the product
- where later policy or wrapper work should attach

This matrix does not:

- replace `space_members`
- replace current conversation membership
- define final RLS or final enforcement
- expand `public.conversations.kind` beyond `dm | group`
- turn every row into a permanent independent feature flag

Practical rule:

- later runtime work should resolve one profile and apply its default posture
- exceptions should be explicit and rare
- route surfaces should consume the shared resolved access contract instead of
  mixing raw profile checks with ad hoc membership booleans

## Shared Baseline Across All Profiles

Regardless of profile, every space still shares:

- the same `space` container and `space_id`
- the same `space_members` outer boundary
- the same conversation/message substrate
- the same archive semantics through `conversation_members.hidden_at`
- the same distinction between archive and closure
- the same shared identity, auth, storage, and backend seams

Important rule:

- profiles change product emphasis
- profiles do not create different meanings for shared core entities

## Interpretation Vocabulary

The matrix uses four default postures:

| Posture | Meaning |
| --- | --- |
| `primary` | this capability should be top-level and expected in the shell for the profile |
| `secondary` | this capability remains available, but it should not define the primary shell or product story |
| `limited` | this capability may exist, but it should be wrapped, narrowed, or de-emphasized for the profile |
| `future-supporting` | this capability belongs to the profile direction, but later implementation work must make it real |

## Initial Capability Matrix

| Capability | `messenger_full` default | `keepcozy_ops` default | Notes |
| --- | --- | --- | --- |
| full inbox access | `primary` | `secondary` | `messenger_full` should land in `/inbox`; `keepcozy_ops` should keep inbox reachable but not shell-defining |
| DM availability | `primary` | `secondary` | DMs stay part of the shared chat core in both profiles; `keepcozy_ops` must not treat DM as the operational system of record |
| free group creation | `primary` | `limited` | `messenger_full` can expose ordinary group creation prominently; `keepcozy_ops` should avoid making ad hoc group creation the main collaboration pattern |
| voice message support | `primary` | `secondary` | Voice remains a chat capability in both profiles, but `keepcozy_ops` should keep structured updates as the primary operational history |
| reactions support | `primary` | `secondary` | Reactions remain part of messaging in both profiles; in `keepcozy_ops` they should support discussion, not replace work-state signals |
| full chat settings visibility | `primary` | `secondary` | Thread settings stay available everywhere, but `messenger_full` should treat them as a first-class chat surface |
| home dashboard visibility | `limited` | `primary` | `messenger_full` should not lead with `/home`; `keepcozy_ops` should use `/home` as the default product entry |
| room/issue/task/activity visibility | `limited` | `primary` | The KeepCozy MVP loop is the defining shell for `keepcozy_ops`, not for `messenger_full` |
| issue-linked discussion | `future-supporting` | `secondary` | The concept belongs primarily to `keepcozy_ops`; it should attach to shared conversation foundations without becoming mandatory for `messenger_full` |
| task-linked discussion | `future-supporting` | `secondary` | Same rule as issue-linked discussion: operationally relevant in `keepcozy_ops`, optional and non-defining in `messenger_full` |
| vendor/home thread support | `limited` | `future-supporting` | `messenger_full` should not promise vendor/home workflow threads; `keepcozy_ops` should reserve this as an operational thread wrapper, not free-form social chat |
| attachment/media expectations | `primary` broad chat media | `primary` narrow operational media | `messenger_full` can assume ordinary chat media use; `keepcozy_ops` should prefer practical, auditable media that supports issues, tasks, and linked discussion |
| archive behavior | `primary` shared chat behavior | `primary` shared chat behavior | Archive remains per-user hide behavior in both profiles and must not become a workflow status |
| closure behavior | `limited` | `primary` | `messenger_full` should not center operational closure; `keepcozy_ops` should center issue/task resolution and later thread/object closure |
| policy visibility expectations | current membership-first chat defaults | space-boundary-first ops defaults | `messenger_full` should preserve ordinary conversation membership as the main product expectation; `keepcozy_ops` should later layer audience/object policy on top of the same outer space boundary |

## Row-by-Row Guidance

### Chat-centered defaults for `messenger_full`

`messenger_full` should behave like a full messenger space by default:

- inbox is the primary landing surface
- DM and group messaging are the expected main actions
- chat media, reactions, settings, and thread continuity are first-class
- KeepCozy operational surfaces may exist later, but they should not dominate
  the shell

Practical rule:

- if a capability is equally possible in both profiles, `messenger_full`
  should treat the chat expression as the primary one

### Ops-centered defaults for `keepcozy_ops`

`keepcozy_ops` should behave like an operational home/object space by default:

- `/home`, `/rooms`, `/issues`, `/tasks`, and `/activity` define the shell
- issue/task history is the main system of record for the MVP loop
- inbox and chat remain supporting collaboration lanes
- linked discussion should attach to issues and tasks over time, not compete
  with them as the main product center

Practical rule:

- if a capability is equally possible in both profiles, `keepcozy_ops` should
  treat the operational expression as the primary one

## Attachment and Media Expectations

Media expectations need different product framing even when they share the
same storage foundations.

### `messenger_full`

Default expectation:

- ordinary chat attachments, voice notes, and media exchange are normal
- media is part of the core product experience

### `keepcozy_ops`

Default expectation:

- attachments should support issue/task progress, proof, and context
- media should stay practical and auditable
- the profile must not widen into storage intelligence, asset intelligence, or
  a broad document platform by default

Important rule:

- shared storage/media foundations remain shared
- the profile changes what kind of media behavior is emphasized

## Archive and Closure Rules

These rules must not drift across profiles.

### Archive

Archive remains:

- per-user hide behavior
- conversation-scoped chat behavior
- distinct from operational lifecycle state

This is shared across both profiles.

### Closure

Closure remains:

- an operational lifecycle fact
- relevant mainly for `keepcozy_ops`
- separate from personal inbox cleanup

Practical rule:

- no profile should collapse archive and closure into one concept

## Policy Visibility Expectations

The profiles should imply different product expectations while preserving one
shared policy foundation.

### `messenger_full`

Expected product posture:

- current conversation membership is the dominant visible rule
- no profile-level expectation of operator oversight or object-linked
  visibility should be inferred

### `keepcozy_ops`

Expected product posture:

- the outer `space` boundary remains first
- later operational thread and object policy may narrow or structure
  visibility within that space
- companion metadata, object linkage, and timeline visibility remain additive
  inputs rather than standalone authorization truth

Important rule:

- profile defaults can shape policy expectations
- profile defaults must not bypass the shared membership boundary

## Recommended First Runtime Uses of This Matrix

Later runtime branches should apply this matrix in the following narrow order:

1. resolve the active space
2. resolve the active space profile
3. choose the default landing route from the profile
4. choose top-level shell emphasis from the profile
5. keep deeper capability branching shallow until the profile-routing seam is
   stable

Recommended first routing posture:

| Profile | Default landing | Top-level emphasis |
| --- | --- | --- |
| `messenger_full` | `/inbox?space=...` | inbox/chat |
| `keepcozy_ops` | `/home?space=...` | home/rooms/issues/tasks/activity |

## Guardrails

- do not treat the matrix as proof that every `future-supporting` row is
  already live
- do not split shared schema or routing seams by profile
- do not use profile to overload `dm | group`
- do not let `keepcozy_ops` silently inherit broad messenger-first defaults
  just because they already exist in current runtime
- do not let `messenger_full` silently promise full operational object flows
  just because the repo contains KeepCozy foundations

## Remaining Ambiguities

- whether `keepcozy_ops` should keep ordinary free group creation reachable in
  the first runtime pass or move more quickly to wrapped operational-thread
  creation
- whether issue-linked and task-linked discussion should appear as explicit
  top-level affordances or only as detail-surface secondary actions
- how much `messenger_full` should expose KeepCozy surfaces for mixed-use
  tester spaces before a deliberate hybrid posture is defined
- whether later code should express a few explicit capability derivatives from
  the profile token for readability, while still keeping profile defaults as
  the main source of truth
