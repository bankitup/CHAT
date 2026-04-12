# New Product Reuse Checklist

## Purpose

Use this checklist before creating new shared modules or before wiring a new
product deeply into existing BWC code.

The goal is disciplined reuse:

- reuse what is real today
- avoid reusing what only looks convenient
- avoid inventing new abstractions before the product boundary is clear

## What Can Be Reused From BWC Today

These are the main categories that a new product can usually evaluate first:

- auth/session foundations
- request-context and Supabase wiring
- shared identity/profile primitives
- shared spaces/access/governance rules
- shared i18n
- shared runtime preferences where relevant
- shared storage and migration discipline
- minimal guarded submit, recovery, and admin/support patterns
- bounded shared capabilities such as messaging, but only through clear entry
  seams

## What Should Not Be Reused Blindly

Do not reuse these just because they already exist:

- Messenger route UX
- Messenger inbox/thread product state
- KeepCozy home/ops workflow logic
- mixed shell posture decisions
- mixed route files
- broad compatibility facades when narrower seams already exist

Examples:

- Messenger does not define how KeepCozy should present chat
- KeepCozy does not define what platform posture means
- Lioka should not inherit PWA shell assumptions just because Messenger and
  KeepCozy do

## What New Abstractions Are Forbidden Until Proven Necessary

Do not introduce these until reuse is real and clearly justified:

- generic “product engine” layers
- generic cross-product nav/policy registries
- broad “shared ops” modules without a concrete reusable workflow
- platform-wide wrappers around one product’s runtime just to hide ownership
- new shared capability modules created only because one product file is large

## Reuse Decision Checklist

### 1. Is this already active in BWC today

- If no, default to product ownership first.
- Do not create a broad new platform seam just because a future product might
  need it.

### 2. Is it needed by at least two real products

- If no, default to product ownership.
- If yes, continue.

### 3. Is it foundational or domain-specific

- If it is required regardless of product, it may be `platform`.
- If it is a bounded reusable domain, it may be `shared capability`.
- If it is primarily a user-facing workflow, it stays `product`.

### 4. Is product-specific logic pretending to be shared

Warning signs:

- the naming is generic but the behavior is clearly one product’s workflow
- the abstraction mainly exists to reduce imports
- changing one product would break the abstraction immediately

If yes, keep it in the product.

### 5. Is the entry seam already narrow and explicit

- If yes, reuse that seam.
- If no, do not solve this by importing deeper internals from random files.
- Prefer adding a narrow entry point instead of expanding a monolith import.

## Practical Placement Guide

| Question | Likely answer |
| --- | --- |
| Shared auth/session, request context, Supabase wiring? | `platform` |
| Shared identity/profile primitives? | `platform` |
| Spaces/access/governance? | `platform` |
| Messaging transport, media, realtime, E2EE? | `shared capability` |
| Inbox/thread/chat UX? | `product: Messenger` |
| Rooms/issues/tasks/home-ops flows? | `product: KeepCozy` |
| Native mobile UX and client runtime for Lioka? | `product` |

## Example Reuse Reading

### Messenger

Can reuse:

- auth/session foundations
- spaces/access rules
- profile primitives
- i18n
- storage conventions

Must not pretend these are product-owned:

- core auth
- shared identity primitives
- shared access boundaries

Must keep product-specific:

- inbox UX
- thread UX
- composer behavior
- product-facing conversation flows

### KeepCozy

Can reuse:

- auth/session
- spaces/access rules
- profile primitives
- storage conventions
- selective messaging capability use

Must not reuse blindly:

- Messenger inbox/thread route logic
- Messenger shell posture
- messaging internals without a clear adapter seam

Must keep product-specific:

- rooms
- issues
- tasks
- home and operations flow

### Lioka

Can reuse:

- identity/auth foundations where justified
- privacy/security baselines
- storage/migration discipline
- bounded shared capabilities only when product value clearly requires them

Must not reuse blindly:

- current PWA shell assumptions
- Messenger route/runtime assumptions
- KeepCozy workflow assumptions

Must keep product-specific:

- native UX
- client delivery shape
- iOS-specific interaction/runtime choices

## Final Check Before Coding

Confirm all of these:

- the product brief exists
- the architecture note exists
- the product boundary is explicit
- reuse is concrete, not aspirational
- no new abstraction is being introduced only for neatness
- the chosen module placement matches BWC doctrine
