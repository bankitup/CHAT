# KeepCozy Space Schema: Companion Metadata

## Purpose

This document explains the first additive schema draft for future operational
thread companion metadata in KeepCozy.

It is the schema-phase follow-on to the earlier architecture and contract
passes. The goal is to introduce a concrete table shape for richer operational
thread meaning without mutating the current conversation core.

Primary SQL draft:

- [2026-04-07-conversation-companion-metadata-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-conversation-companion-metadata-foundation.sql)

Related documents:

- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)
- [schema-requirements.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-requirements.md)

## Chosen Table Shape

The first schema draft uses one additive companion table:

- `public.conversation_companion_metadata`

The table is intentionally:

- keyed 1:1 by `conversation_id`
- optional per conversation
- scoped by `space_id`
- limited to primary operational thread metadata

Core fields in this first pass:

- `conversation_id`
- `space_id`
- `thread_type`
- `audience_mode`
- `status`
- `operational_object_type`
- `operational_object_id`
- `thread_owner_user_id`
- `operator_visible_by_policy`
- `external_access_requires_assignment`
- `opened_at`
- `closed_at`
- `visibility_scope_notes`
- `created_at`
- `updated_at`

## Why This Is Additive

This table does not replace or mutate the current conversation shell.

Current runtime remains:

- `public.conversations.kind = dm | group`
- `public.conversation_members.role = owner | admin | member`
- `public.conversation_members.hidden_at` continues to mean per-user archive/hide

The companion row is optional. Existing conversations can continue to exist and
behave normally without any row in the new table.

That makes this schema pass additive in three important ways:

1. current conversation creation and rendering can remain unchanged
2. future operational semantics can be added beside the shell, not inside it
3. rollout can happen per thread type and per feature area later

Important current-state note:

- this draft does not yet make the companion table part of the active-runtime
  contract described in `schema-assumptions.md` or `schema-requirements.md`
- those documents should continue to describe only the schema current runtime
  already reads and writes

## Why `space_id` Is Duplicated

The companion table stores `space_id` directly even though the parent
conversation already has `space_id`.

This is intentional for future:

- space-scoped querying
- policy preparation
- search/indexing
- timeline and automation joins

The first draft does not add strict enforcement that companion `space_id` must
match `conversations.space_id`.

That stricter consistency mechanism is deferred so this pass can stay narrow.
Future write paths or a later hardening migration can enforce the match more
strictly if needed.

This is a deliberate tradeoff:

- duplicated `space_id` makes future space-scoped indexing and policy work
  easier
- deferred strict enforcement keeps the first physical pass small and easy to
  review

## Why Primary Object Ref Only In The First Pass

The current SQL draft includes only the primary operational object reference:

- `operational_object_type`
- `operational_object_id`

This is enough to support the main architecture goal:

- one operational thread may point to one primary business record

What is intentionally deferred:

- related-object link tables
- many-to-many object links
- per-link metadata beyond the primary object ref

The TypeScript contract layer still leaves room for related-object links later,
but the first physical schema pass does not need to solve that yet.

## Why `operator_visible_by_policy` Is Persisted

This field is included directly because the KeepCozy docs repeatedly treat
operator visibility as a first-class policy fact, not just an inferred UI rule.

Persisting it now keeps later policy work clearer:

- it avoids forcing visibility inference from `thread_type` alone
- it keeps operational oversight separate from thread moderation roles
- it helps preserve the rule that operator visibility is not DM decrypt
  authority

This field is still future-facing metadata, not active authorization behavior.
Later policy/RLS work can decide whether persistence stays primary or becomes a
derived optimization.

## Closure vs Archive

This draft keeps the architecture rule explicit:

- archive is not the same thing as closure

In the current runtime:

- archive/hide is per-user and lives in `conversation_members.hidden_at`

In the companion metadata draft:

- `status`
- `opened_at`
- `closed_at`

represent operational lifecycle, not personal inbox preference.

## What Was Intentionally Deferred

This first schema pass intentionally does not add:

- RLS or grants for the new table
- write-path integration in current runtime code
- read-path integration in current runtime code
- an `updated_at` trigger
- strict `space_id` equality enforcement against `public.conversations`
- related-object link tables
- invitation and assignment tables
- `space_timeline_events`
- first-class operational object tables
- any mutation of `public.conversations.kind`
- any expansion of current membership role enums

These deferrals are deliberate. They keep this branch reviewable and minimize
risk to current production behavior.

## Current State vs Target State

### Current state

- operational thread meaning is mostly implicit
- `public.conversations` still carries only shell-level meaning
- there is no first-class companion metadata table yet

### Target direction after this draft

- one optional companion row can carry operational thread meaning
- future backend helpers can read/write typed metadata without touching core
  conversation fields
- later branches can add RLS, related-object links, and object/timeline
  integration on top of this additive base

## Why The Table Is Not In Active Runtime Docs Yet

This branch introduces a schema draft, not a runtime dependency.

That means:

- `schema-assumptions.md` should not start presenting
  `public.conversation_companion_metadata` as an active requirement yet
- `schema-requirements.md` should not treat this table as mandatory for current
  chat/voice behavior yet
- the table should move into those documents only after a later branch makes
  production read/write paths depend on it

## Practical Implication For The Next Branches

After this schema draft exists, the next safe follow-ons become:

1. backend helper boundaries for reading companion rows
2. controlled write paths for one operational thread type
3. later RLS/policy work once the policy matrix is ready

This schema draft is therefore not the final model. It is the first durable
physical foothold for the future companion metadata layer.
