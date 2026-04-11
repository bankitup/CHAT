# Messaging Capability Boundaries

## Purpose

This document defines how messaging should be treated inside the BWC platform
repo:

- as a shared capability
- with Messenger as its first-class product consumer
- without forcing KeepCozy or future products to depend on Messenger route
  files

This is a boundary document, not a feature plan.

## Capability Ownership

Shared messaging capability owns:

- conversation and message server seams
- membership and read-state server seams
- media and asset server seams
- push, realtime, and E2EE capability seams
- messaging API transport routes

Primary files today:

- [contract/README.md](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/contract/README.md)
- [data/README.md](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/README.md)
- [server/README.md](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/README.md)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
- [route-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/route-context.ts)
- [app/api/messaging/**](/Users/danya/IOS%20-%20Apps/CHAT/app/api/messaging)

Messenger product owns:

- inbox UX
- chat thread UX
- composer UX
- route-local rendering/runtime behavior

Primary files today:

- [app/(app)/inbox/**](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox)
- [app/(app)/chat/[conversationId]/**](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId])

## Current Contract Split

The current split inside `src/modules/messaging` is:

- `contract/` for durable shared messaging contract vocabulary
- `data/` for persistence-facing table/query/mutation logic
- `server/` for access-checked server seams used by product routes

Current first explicit server seam:

- [route-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/route-context.ts)

It now owns:

- active messaging-space resolution for route consumers
- active conversation route resolution for route consumers
- current v1 TEST-space compatibility fallback used by messaging surfaces

Messenger routes now consume that seam instead of owning the full access
resolution flow inline.

## What Other Products May Depend On

KeepCozy and future products may depend on:

- `src/modules/messaging/contract/**`
- `src/modules/messaging/data/**`
- `src/modules/messaging/server/**`
- `app/api/messaging/**`

They should not depend on:

- `app/(app)/inbox/**`
- `app/(app)/chat/[conversationId]/**`
- Messenger-only shell composition details
- Messenger page-local state or rendering helpers

Practical rule:

- depend on messaging capability modules
- do not depend on Messenger route files

## Why This Boundary Matters

Without this split, route pages become the de facto API for messaging
behavior, which makes:

- KeepCozy reuse harder
- server hardening harder
- monolith reduction inside `data/server.ts` slower
- tests and observability harder to attach cleanly

With this split:

- Messenger remains strong as a product
- shared messaging behavior has a reusable home
- later products can consume messaging capability without importing Messenger
  UI/runtime code

## Follow-on Direction

The next safe follow-ons are:

1. continue extracting access-checked messaging server seams from route files
2. keep route composition inside Messenger pages
3. leave low-level persistence in `data/` until there is evidence for smaller
   domain slices

Do not:

- move product rendering into `src/modules/messaging`
- make KeepCozy depend on Messenger route components
- redesign the messaging schema just to fit cleaner boundaries
