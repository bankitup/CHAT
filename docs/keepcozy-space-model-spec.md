# KeepCozy Space Model Spec

## Purpose of the Space Model

This document defines the intended top-level operational container for the
shared messaging core as it evolves from CHAT into a reusable foundation for
KeepCozy.

The goal is to make `space` explicit as the durable boundary for:

- access control
- communication context
- operational data ownership
- media/storage tenancy
- future modular reuse across products

This document is architecture-first. It is meant to guide later schema, RLS,
storage, and service-boundary work without forcing risky runtime changes in the
current CHAT product shell.

Related current documents:

- [space-profiles.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-profiles.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [space-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-model.md)
- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)
- [schema-requirements.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-requirements.md)
- [client-strategy.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/client-strategy.md)
- [media-rtc-architecture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/media-rtc-architecture.md)
- [security/e2ee-security-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-security-model.md)

## Design Decisions Locked by This Pass

These decisions should be treated as stable unless later review produces a
strong reason to change them:

- `space` is the operational memory boundary
- `public.conversations.kind` should remain the shell discriminator for `dm`
  and `group`
- richer operational thread semantics should prefer a future companion metadata
  layer keyed by `conversation_id`, not a risky overload of current
  conversation core fields
- operational threads are intended to be auditable and operator-visible by
  policy, not full E2EE-by-default
- private messaging may follow a different trust mode and must not become the
  sole operational system of record for a space
- chat is a major contributor to space memory, but not the only durable source
  of truth

## Definition of a Space

A space is the top-level operational container for one managed property, home,
asset, or equivalent managed object.

In KeepCozy terms, a space is not just a chat folder. It is the durable context
that says:

- which people are allowed into this operational environment
- which communication threads belong to this environment
- which media and records belong to this environment
- which future operational objects are attached to this environment

In current CHAT terms, a space is already the parent scope for conversations
through `public.conversations.space_id`. In target KeepCozy terms, the same
space becomes the primary tenancy and audit boundary for a managed property or
other operational object.

## Why Space Is the Main Operational Container

KeepCozy communication is space-centered rather than person-centered.

That matters because operational communication usually needs:

- multiple participants instead of only pairwise DMs
- role-based access rather than purely social access
- auditability and continuity even when participants change
- persistent context around one property/home/object
- media and records that remain attached to the operation, not to one device

Using space as the main container gives the system one clear outer boundary
before thread-level logic begins. That boundary is the right place to decide:

- who can enter
- what can be listed
- what can be created
- what storage and media belong to the operation
- what future modules can attach to the same context

## What Belongs Inside a Space

The space model should own or scope the following categories.

### Membership and access

- space membership
- space-level role assignment
- invitation and removal eligibility
- the coarse allowlist for every thread and operational object inside the space

### Communication

- direct messages that are intentionally space-scoped
- group threads used for work inside that space
- thread discovery, visibility, and lifecycle inside the space

### Operational context

- property/home/object identity
- operational participants such as contractors, vendors, managers, internal
  operators, and staff
- future workflow or record objects tied to the same managed context

### Storage and media scope

- storage tenancy rules for conversation media within the space
- future operational document/media ownership at the space level
- policy boundaries for who may read, upload, and manage space-scoped media

## What Does Not Belong Inside the Space Model

The space model should not absorb responsibilities that belong to narrower
subsystems.

### Message-level behavior

- message sequencing
- reply linkage
- reaction logic
- per-message render-state rules

These belong to the thread/message layer.

### Local client runtime

- composer draft state
- upload progress state
- local playback state
- local unread cache and optimistic UI state

These belong to client/runtime layers, not the durable space contract.

### Cryptographic/device concerns

- device keys
- message envelopes
- private-key custody
- media decryption runtime

These belong to E2EE/media boundaries, not to the outer operational container.

### RTC/call transport

- live signaling
- peer/session media transport
- call presence and live audio/video runtime

This remains outside the space model and should stay in a dedicated RTC layer.

### Global user identity

- profile identity
- account-level preferences
- cross-space user existence

These are global concerns referenced by spaces, not contained by them.

## Core Entities Related to a Space

The current and target model should be understood as a set of layers.

### 1. `public.spaces`

Primary identity record for the operational container.

Current code already assumes:

- `id`
- `name`
- `created_by`
- timestamps

Target responsibility:

- identify the managed context
- store stable display identity
- hold lifecycle and operational metadata later

### 2. `public.space_members`

Outer membership and coarse authorization boundary.

Current runtime already uses:

- `space_id`
- `user_id`
- `role`

Current roles:

- `owner`
- `admin`
- `member`

Target responsibility:

- decide who is inside the operational container
- define coarse authority over the space
- constrain which threads and operational objects the user can access

### 3. `public.conversations`

Thread shell inside a parent space.

Current runtime already treats:

- `space_id` as required
- `kind` as `dm` or `group`
- DM uniqueness as space-scoped via `space_id + dm_key`

Target responsibility:

- represent communication containers within a space
- remain subordinate to the parent space boundary
- preserve the current shell contract of `kind = 'dm' | 'group'`
- defer richer operational thread meaning to a future companion metadata layer

### 4. `public.conversation_members`

Per-thread participation layer inside the space.

Target responsibility:

- define who participates in a specific thread
- carry thread-level role/state
- never expand access beyond the outer `space_members` boundary

### 5. `public.messages`

Durable history entity within a thread.

Target responsibility:

- message ordering
- sender linkage
- message kind
- summary projection inputs

### 6. `public.message_assets` and `public.message_asset_links`

Committed media layer attached to message rows.

Target responsibility:

- durable media identity
- storage location
- mime/size/duration metadata
- message-to-media linkage

### 7. Future operational objects

The target model should support additional space-scoped records later, such as:

- work orders
- tasks
- maintenance requests
- vendor records
- documents
- property-specific logs or audit events

These should attach to the space as first-class operational records rather than
trying to overload threads to carry all non-message meaning.

Preferred evolution path:

- major operational records should later use first-class tables
- helper reference or search layers may still exist, but they should not become
  the only durable model for operational objects

## Trust Modes Inside a Space

KeepCozy should distinguish between two trust modes even if the same messaging
core supports both.

### Operational thread trust mode

This is the default KeepCozy model for service requests, contractor
coordination, inspections, supplier orders, and internal operator work.

Characteristics:

- auditable by design
- operator-visible by policy
- optimized for continuity when participants change
- not intended to hide operational state from the operating side

### Private messaging trust mode

This is a narrower mode for person-to-person privacy, including current
space-scoped DMs and existing DM E2EE work.

Characteristics:

- may use `dm` shell conversations
- may use `content_mode = 'dm_e2ee_v1'`
- should not be treated as the authoritative operational memory for a space

Important boundary:

- space membership controls who may enter the space
- it does not itself grant DM plaintext access
- operator oversight for operational threads must not be misread as a general
  decrypt-rights model for private messaging

## Space Lifecycle States

Target lifecycle states should be explicit even though the current runtime does
not yet expose a dedicated `spaces.status` column.

Recommended target states:

- `provisioning`
  space record exists but setup is incomplete
- `active`
  normal operational state; threads and membership activity allowed
- `archived`
  historical access remains possible, but normal operational creation is
  restricted or disabled
- `suspended`
  temporarily unavailable due to billing/compliance/operator action
- `deleted`
  terminal lifecycle state handled through explicit retention/deletion policy,
  not as a casual client action

Guidance:

- current CHAT runtime should be treated as operating only on effectively
  `active` spaces
- lifecycle state should later gate both UI behavior and RLS/policy behavior

## Space-Level Access Boundaries

Space is the outer access boundary. Thread access should never exceed it.

Required rules:

- a user must be a valid `space_member` to enter the space
- a user must not be able to list or join conversations outside that space
- a `conversation_member` must also be valid within the parent space
- media/storage access for conversation content should be derivable from the
  space and conversation boundary together

Operational principle:

- `space_members` decides broad eligibility
- `conversation_members` decides thread participation inside that eligibility

Important distinction:

- space access is not the same thing as plaintext access for encrypted DMs
- role in a space must not imply decryption rights for private DM content
- for KeepCozy operational threads, auditability and operator visibility are
  the default product posture, but the access boundary still belongs at the
  space layer

## Relationship Between Space and Threads

Threads live inside spaces. They are not peers of spaces.

Required model rules:

- every conversation belongs to exactly one space
- there are no cross-space conversations
- DMs are space-scoped, not global
- group threads are space-scoped, not global
- thread creation requires an active selected space

Practical implication:

- the same two users may have different communication threads in different
  spaces
- operational meaning comes from the parent space, not only from the thread
  title or participants

Target KeepCozy interpretation:

- most operational communication should use group threads within the space
- private person-to-person messaging may still exist elsewhere in the product,
  but it should not weaken the operational centrality of the space-scoped model

## Relationship Between Space and Operational Objects

The space should become the parent shell for operational records that are not
themselves chats.

Examples:

- maintenance issue records
- work orders
- contractor/vendor assignments
- property documents
- checklists
- inspections
- billing or service-history references

Recommended model rule:

- operational objects belong to the space first
- threads may reference operational objects
- threads should not become the only place where operational state exists

This separation prevents the messaging model from carrying unrelated business
logic and makes the communication core reusable across products.

## Relationship Between Space and Storage/Media

Space should be part of the durable storage tenancy story even where the current
runtime still resolves media through message-linked records.

Current active media runtime already depends on:

- `public.message_assets`
- `public.message_asset_links`
- canonical `message-media` storage bucket

Target model guidance:

- storage/media belongs to a thread and message, but also inherits the parent
  space boundary
- access policy should be explainable as:
  user -> member of space -> participant in conversation -> allowed media access
- inbox/activity must remain blob-free and summary-driven
- media storage should not be designed as a separate cross-space namespace that
  ignores operational tenancy

Recommended future convention:

- space-aware storage paths and/or policy checks should make the parent space
  relationship obvious, even when message id remains part of the path
- future object/document storage should align to the same `space` boundary even
  when it is no longer message-linked

## Future Extensibility Requirements

The space model should remain durable enough to support later expansion without
reworking the core tenancy concept.

It should support:

- multiple spaces per user
- many threads per space
- richer role types later without breaking current owner/admin/member semantics
- a companion metadata layer for operational thread meaning
- future operational objects beyond messaging
- policy differences between private chats and operational group threads
- storage/media controls that remain aligned with the parent space
- reusable SDK/service boundaries for products beyond CHAT

The model should not require:

- rebuilding all communication rules around one-off UI routes
- mixing operational object schema into thread tables
- coupling call runtime to thread or space history queries

## Current State vs Target State

### Current state in this repository

The current codebase already has a real v1 space foundation:

- `public.spaces`
- `public.space_members`
- `public.conversations.space_id`
- selected-space routing for inbox/activity/chat entry
- space-scoped DM lookup and conversation creation
- generic current role models in `space_members` and `conversation_members`
- no separate operational thread metadata layer yet
- no first-class operational object tables yet
- no unified space timeline event layer yet

Current rollout shape:

- existing activity is backfilled into a default `TEST` space
- the active app context is selected by explicit `?space=<space_id>` routing
- current UX is still primarily messaging-first, not full operational-space-first

### Target state for KeepCozy

The target KeepCozy model is stronger than the current CHAT rollout:

- space represents a real managed property/home/object
- most important communication is space-scoped group communication
- operational records live alongside threads inside the same space boundary
- access control and audit semantics are defined first at the space level
- storage/media tenancy becomes visibly aligned with the same parent container
- operational thread meaning is carried by a companion metadata layer rather
  than by overloading `conversation.kind`
- private messaging can continue to exist, but it is not the primary
  operational memory path

### Gap to keep explicit

The current code proves the space boundary exists, but it does not yet mean:

- full operational object modeling already exists
- lifecycle states are implemented
- richer multi-space management is complete
- storage paths are fully space-aware
- operator/audit workflows are implemented at the product level

This document should therefore be read as:

- current runtime foundation plus
- target operational model for future KeepCozy reuse

## Explicit Guardrails and Non-Goals

Guardrails:

- do not treat space as only a UI filter
- do not let thread membership bypass space membership
- do not overload `public.conversations.kind` beyond `dm` and `group` in the
  current runtime
- do not force operational thread semantics into current conversation
  moderation fields
- do not let operational objects live only as chat-message fragments
- do not let media/storage bypass the parent space boundary
- do not let space-level admin rights automatically imply DM plaintext access
- do not treat user-authored messages as a substitute for structured
  operational events
- do not equate archive/hide behavior with operational closure
- do not mix RTC/call transport into space/thread/history contracts

Non-goals for this spec:

- defining exact future SQL for every operational object
- defining full E2EE policy for operational threads
- defining final multi-space UX
- replacing the existing CHAT shell with a new client architecture
- introducing speculative product modules that have no boundary-level value yet

## Working Guidance for Later Schema and Access-Control Work

When implementing future schema or policy changes, prefer the following order of
truth:

1. space boundary
2. thread boundary inside the space
3. message/media boundary inside the thread
4. local client/runtime behavior on top

If a later feature cannot clearly answer “which space owns this?”, it is
probably not modeled at the right level yet.
