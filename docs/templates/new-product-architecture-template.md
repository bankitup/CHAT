# New Product Architecture Template

## Purpose

Use this template after the product brief is clear and before substantial coding
starts.

This document should explain how the new product fits into BWC without
pretending that everything important belongs in platform.

## Template

### 1. Product Name

- Product:
- Delivery shape:
- Product brief:

### 2. Architecture Summary

- What the product reuses from BWC:
- What bounded capabilities it consumes:
- What remains fully product-specific:
- What this product does not need from BWC:

### 3. What Belongs To Platform

List the platform foundations this product will use.

Typical examples:

- auth/session
- request context
- shared identity/profile primitives
- shared space/access/governance rules
- shared storage and migration discipline
- shared i18n/runtime preference rules
- minimal shared admin/recovery patterns

For each reused platform area, document:

- module or entry seam
- why it is reused
- whether any product-specific wrapper is needed

### 4. What Belongs To Shared Capability

List the shared capabilities this product will consume.

Typical examples:

- messaging
- file/media delivery patterns
- push/device registration
- realtime collaboration

For each capability, document:

- capability name
- entry seam
- which parts are actually needed
- what the product must not import directly

### 5. What Belongs To The Product

Document what must remain product-owned:

- primary routes/screens
- core workflows
- product-specific copy
- product-specific metrics
- product-specific rollout decisions
- product-specific support/admin needs

### 6. Reusable Pieces Consumed

Document concrete reuse, not abstract hope.

| Reused piece | Layer | Entry point | Why reused | Notes |
| --- | --- | --- | --- | --- |
| Example: request viewer resolution | platform | `src/lib/request-context/server.ts` | Shared authenticated server work | Real existing foundation |

### 7. What Must Remain Product-Specific

Be explicit about what should not be pushed into platform or capability just
because it might be useful later.

Examples:

- product shell policy
- onboarding
- primary workflow state
- product-specific moderation or trust rules
- native interaction patterns

### 8. Auth / Data / Media / Push / Support Assumptions

#### Auth and identity

- Does the product use BWC auth/session?
- Does it need shared profile identity?
- Does it need new product-specific identity rules?

#### Data and persistence

- What tables or domain objects are product-specific?
- What shared storage/migration conventions apply?
- What should not be shared yet?

#### Media and files

- Does the product need uploads or attachment delivery?
- Can it reuse existing media patterns?
- What delivery assumptions do not apply?

#### Push and devices

- Does the product need push or device registration?
- Is current messaging push enough, or is product-specific behavior required?

#### Support/admin/recovery

- What support or recovery patterns are needed in v1?
- Can shared guarded submit/error/recovery patterns be reused?
- What should remain product-specific?

### 9. Source-Of-Truth Docs

List the docs that must exist before deeper implementation:

- product brief
- boundary note
- delivery-shape note
- capability reuse note, if any
- verification or acceptance note for shared critical paths

### 10. Explicit Non-Goals

List what this product architecture will not try to do:

- no premature capability extraction
- no forced reuse just to make the tree look cleaner
- no speculative platform module unless reuse is already real

## Example Notes

### Messenger

- Platform use: auth/session, spaces access, i18n, shared profile primitives
- Shared capability: messaging is the main capability
- Product-owned: inbox, thread UX, composer flows, product-specific trust path

### KeepCozy

- Platform use: auth/session, spaces access, i18n, profile primitives
- Shared capability: may consume messaging selectively through a product-owned
  adapter seam
- Product-owned: rooms, issues, tasks, home/ops flows

### Lioka

- Platform use: identity, privacy/security baselines, storage discipline where
  justified
- Shared capability: only if product value clearly requires it
- Product-owned: native delivery shape, mobile interaction model, iOS-specific
  runtime decisions

## Completion Check

This template is ready when:

- platform reuse is concrete
- shared capability use is bounded
- product-specific ownership is explicit
- auth/data/media/push/support assumptions are named
- the document reads like a plan for one product, not a generic platform pitch
