# Space Profiles

## Purpose

This document defines the initial space-profile foundation for the shared CHAT
and KeepCozy repository.

The goal is to make one shared `space` container support different product
surfaces in a clean, implementation-oriented way without splitting the app into
two permanent products, two permanent branches, or two unrelated backends.

This is a foundation document, not a runtime-redesign branch.

Related documents:

- [space-profile-capability-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-profile-capability-matrix.md)
- [keepcozy-chat-shared-vocabulary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-shared-vocabulary.md)
- [keepcozy-chat-role-alignment.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-role-alignment.md)
- [keepcozy-chat-integration-seam.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-integration-seam.md)
- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-space-policy-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-policy-matrix.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [keepcozy-mvp-boundary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-boundary.md)
- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)
- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- [layout.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/layout.tsx)
- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)

## Current Repo Reality

The repository already has one shared `space` foundation:

- `public.spaces` is the outer tenancy and routing boundary
- `public.space_members` is the current coarse membership seam
- `public.conversations`, `public.conversation_members`, and `public.messages`
  remain the shared communication core
- KeepCozy already layers persisted `rooms`, `issues`, `issue_updates`,
  `tasks`, and `task_updates` on top of that shared space boundary
- the app shell already exposes both:
  - KeepCozy-first routes such as `/home`, `/rooms`, `/issues`, `/tasks`, and
    `/activity`
  - chat surfaces such as `/inbox` and `/chat/[conversationId]`

What is missing is a stable product-shaped way to say:

- this space should behave primarily like a messenger space
- this space should behave primarily like a KeepCozy operational space

That is the job of a space profile.

## What a Space Profile Is

A space profile is a narrow product-layer classification attached to one shared
`space`.

It answers:

- which top-level shell should be primary for this space
- which capability bundle should be emphasized in navigation and entry points
- which product language and product defaults should shape the user experience
- which future policy defaults or object wrappers should apply to this space

A space profile is not:

- a second outer container
- a replacement for `space`
- a replacement for `space_members`
- a replacement for `public.conversations.kind`
- a new identity model
- a separate backend or separate app

Practical rule:

- one `space` keeps one shared identity and membership boundary
- the profile decides how that same space presents itself in the product shell

## Why Profiles Are Better Than Separate Products or Branches

Profiles are preferred because they preserve the shared foundation that the
repository already has.

### Product reasons

- one user can move between messenger spaces and operational spaces without
  switching apps or accounts
- one shared shell can later route into the right primary product surface for
  the active space
- trusted tester or friend spaces can stay chat-first while home spaces stay
  operations-first

### Architecture reasons

- `space`, `space_members`, `conversation`, and `message` stay shared instead
  of being cloned into parallel systems
- the current KeepCozy object layer can remain additive on top of the same
  `space_id`
- shared routing, auth, storage, and identity seams stay stable

### Delivery reasons

- one branch can add profile-aware routing without forking the repository
- rollout can stay additive and reversible
- future product modes can be introduced as new profiles instead of reopening
  the whole shared-foundation architecture

Important rule:

- profiles should separate product surfaces, not split the system into
  different products with different infrastructure

## Initial Recommended Profiles

The initial profile set should stay intentionally small.

| Profile | Intended use | Primary shell emphasis | Secondary surfaces |
| --- | --- | --- | --- |
| `messenger_full` | trusted testers, friends, family, and general-purpose communication spaces | inbox/chat-first | KeepCozy-style operational surfaces may exist later but are not the primary promise |
| `keepcozy_ops` | homes, managed objects, and operational spaces where the main loop is room -> issue -> task -> history | KeepCozy home/rooms/issues/tasks/activity | inbox/chat remains available as a supporting communication surface |

Practical rule:

- do not add more profiles until these two are proving distinct value
- most future surface differences should first be expressed as capability
  changes inside these profiles rather than as new profile names

## Profile Intent

### `messenger_full`

This profile is intended for spaces where the primary value is full messaging.

It should be the default posture for spaces used by:

- trusted testers
- friends
- lightweight groups
- general-purpose communication scenarios that do not need the KeepCozy
  object loop as the main product promise

Expected product emphasis:

- `/inbox` and `/chat/[conversationId]` are primary
- chat creation, chat discovery, and message continuity are the main shell
  expectations
- KeepCozy operational surfaces should not drive the top-level experience by
  default

### `keepcozy_ops`

This profile is intended for spaces where the primary value is operational
coordination around a home or managed object.

It should be the default posture for spaces used by:

- homes
- home operators
- resident-facing support spaces
- future managed-object or operational spaces that follow the KeepCozy loop

Expected product emphasis:

- `/home`, `/rooms`, `/issues`, `/tasks`, and `/activity` are primary
- the visible product loop is home -> room -> issue -> task -> history
- chat remains a supporting communication lane, not the default landing

## How Profiles Relate to Capabilities

Profiles should not hard-code every screen directly into policy or schema.

Instead, each profile should resolve to a narrow capability posture for a
space.

The first explicit profile-default matrix now lives in
[space-profile-capability-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-profile-capability-matrix.md).

### Shared capabilities across profiles

Every profile still shares:

- active `space` resolution
- `space_members` membership boundary
- user identity and auth
- the conversation/message substrate
- settings and account surfaces
- archived/hidden conversation behavior

### `messenger_full` capability emphasis

The profile should prefer:

- inbox-first entry
- chat-first navigation and create actions
- current plain DM and group behavior as the dominant product posture

### `keepcozy_ops` capability emphasis

The profile should prefer:

- home-first entry
- rooms/issues/tasks/history as the visible product loop
- object-linked operational records as the dominant product posture
- inbox/chat as a secondary but reachable lane

Practical rule:

- profile should shape which capability bundle is primary
- profile should not duplicate the underlying capability implementation if the
  same core service already exists

## How Profiles Relate to Shell Routing

Profiles should become the routing hint for the primary shell of a space.

Recommended first-pass routing contract:

1. resolve the active `space`
2. resolve that space's `profile`
3. choose the default landing route for that profile
4. keep the same `space` query seam and same `space_id`

Recommended initial route posture:

| Profile | Default shell landing |
| --- | --- |
| `messenger_full` | `/inbox?space=...` |
| `keepcozy_ops` | `/home?space=...` |

Important boundaries:

- profile-aware routing should happen after active space resolution, not
  instead of it
- profile should not create separate route trees with different identity seams
- profile should not rename shared containers or rewrite `space` into a
  product-specific term in code

## How Profiles Relate to Policy

Profiles are not themselves the full authorization system.

They should be treated as:

- product intent
- default capability posture
- a future policy input for deciding which wrapper or metadata defaults should
  apply in that space

Profiles must not:

- bypass `space_members`
- replace current conversation membership rules
- replace future KeepCozy policy inputs such as `audience_mode`
- act as a hidden super-role

Recommended policy relationship:

- `messenger_full` should default toward current CHAT messaging behavior unless
  a later feature explicitly opts a thread into richer operational metadata
- `keepcozy_ops` should default toward KeepCozy operational surfaces and later
  operational policy wrappers, while still sharing the same chat substrate

Practical rule:

- profile is a space-level product mode
- profile is not the final per-thread or per-object authorization truth

## What Remains Shared Across All Profiles

The following seams should remain shared regardless of profile:

- `space` as the outer container name and system boundary
- `space_members` as the current outer membership seam
- `conversation` as the current runtime communication shell
- `message` as the current user-authored communication record
- user identity and `profiles`
- shared auth/session model
- shared Supabase project and backend
- shared storage/media inheritance rules
- shared archive semantics
- shared routing seam using `space`

Important rule:

- the repository should continue to look like one product foundation with
  profile-specific shells, not two apps glued together

## What Must Not Drift Between Profiles

The following seams must stay stable across profiles.

### Naming that must stay stable

- `space` remains the canonical outer container term
- `conversation` remains the current runtime schema/service term
- `message` remains the current runtime message term
- `archive` must stay distinct from operational `closure`

### Identity and ownership seams that must stay stable

- `space_id` remains the shared top-level tenancy key
- `space_members` remains the current coarse ownership and membership seam
- current runtime `owner | admin | member` surfaces remain compatibility
  layers unless a reviewed schema change says otherwise
- KeepCozy business-role vocabulary must stay layered, not projected directly
  into current runtime moderation fields

### Communication seams that must stay stable

- `public.conversations.kind` remains `dm | group`
- profile must not become a substitute for conversation kind
- chat core remains reusable across profiles

Practical rule:

- profile may change shell emphasis and product defaults
- profile must not change the meaning of the shared foundation entities

## Initial Implementation Guidance

The first implementation pass after this document should stay narrow.

Recommended sequence:

1. introduce a stable profile vocabulary with only:
   - `messenger_full`
   - `keepcozy_ops`
2. add a profile-resolution seam close to active-space resolution
3. make shell entry/profile routing aware of that resolved value
4. keep capability and policy branching shallow until the routing seam is
   stable

Avoid in the first profile pass:

- creating separate products or separate deploy targets
- forking shared schema into chat-only and KeepCozy-only copies
- introducing profile-specific auth or identity models
- overloading `public.conversations.kind`
- adding more profiles before the first two are proven

## Remaining Ambiguities

The following questions are intentionally left for later narrow branches:

- where the resolved profile should live first:
  - explicit `public.spaces` metadata
  - a companion profile table
  - a temporary resolver/config seam
- whether some spaces should later support a deliberately hybrid shell posture
  without becoming a third profile
- how much of `/inbox` should stay visible in `keepcozy_ops` before chat
  linkage work lands
- whether later profile-aware policy defaults should be expressed as explicit
  capability flags in code rather than only as a profile token
