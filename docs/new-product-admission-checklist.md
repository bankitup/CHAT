# New Product Admission Checklist

## Purpose

Use this checklist before starting a new product inside BWC.

The goal is not to add corporate ceremony.
The goal is to decide, before coding starts:

- what the product is
- what delivery shape it needs
- what it can reuse safely
- what must remain product-specific

## Admission Checklist

### 1. Product definition

Document:

- product name
- one-sentence product definition
- primary user
- core workflow
- what problem it solves

If this cannot be stated clearly, the product is not ready for architecture work.

### 2. Delivery shape

Decide the primary delivery shape:

- PWA mobile-first
- iOS-first
- web-admin-first
- mixed shape with separate client surfaces

This matters because delivery shape changes what can actually be shared.

Do not assume a new product should inherit the current PWA shell just because
two existing products do.

### 3. Product boundary

Document what remains product-specific:

- primary screens
- core workflow logic
- product-specific copy
- product-specific metrics
- product-specific admin or support needs

If everything sounds "shared", the product boundary is probably not clear yet.

### 4. Platform reuse

Decide which platform foundations the product should reuse.

Typical questions:

- does it use platform auth/identity
- does it use shared tenancy or access rules
- does it use shared profile primitives
- does it use shared storage and migration discipline
- does it use shared support/admin patterns

Only reuse what is actually helpful.

### 5. Capability reuse

Decide whether the product needs any bounded shared capabilities.

Typical questions:

- does it need messaging
- does it need files or media handling
- does it need notifications, device registration, or push
- does it need realtime collaboration

If yes, define the intended entry seam.
Do not let the product reach into a capability through broad internal imports by default.

### 6. Product-specific commitments

Explicitly state what should remain product-specific even if some parts look reusable.

Examples:

- product shell decisions
- core workflow decisions
- product-specific onboarding
- product-specific success states
- native-specific delivery decisions for iOS-first products

### 7. Support and operations expectations

Decide whether the product will need:

- support/admin patterns
- internal metrics
- moderation or safety tooling
- operational dashboards
- finance or legal workflow integration

These are not automatic platform features.
They should be named up front so they can be owned deliberately.

### 8. Source-of-truth docs required before coding starts

Before significant coding starts, create or confirm:

- a short product definition doc
- a boundary doc naming platform reuse vs product ownership
- a delivery-shape note
- a data and capability entry note if messaging, files, push, or realtime are involved
- an acceptance or manual verification note if the product changes shared critical paths

If these do not exist, the product is not ready to grow inside the shared repo.

## Minimum Admission Questions

Answer these explicitly:

1. What is the product?
2. What is its delivery shape?
3. What BWC foundations does it reuse?
4. What shared capabilities does it need, if any?
5. What must remain product-specific?
6. Does it require platform auth/identity?
7. Does it require messaging capability?
8. Does it require files/media/push/admin/support patterns?
9. What docs are the source of truth before implementation starts?

## Product Examples

### Messenger

Product definition:

- private messaging product for daily communication

Delivery shape:

- PWA mobile-first

Platform reuse:

- auth/session
- shared shell foundations where appropriate
- shared profile identity foundations
- shared storage and migration discipline
- shared access/space rules

Capability reuse:

- messaging is not just reused, it is the primary product capability
- push/device foundations are relevant
- media and attachment delivery are relevant

Must remain product-specific:

- inbox behavior
- chat thread UX
- thread composer behavior
- message-centric product flows

Docs required:

- product positioning and MVP docs
- messaging capability boundaries
- runtime stability and performance docs

### KeepCozy

Product definition:

- separate home and operations product

Delivery shape:

- PWA mobile-first

Platform reuse:

- auth/session
- shared shell foundations where appropriate
- shared profile identity foundations
- shared storage and migration discipline
- shared access/space rules

Capability reuse:

- messaging may be reused selectively as a bounded capability
- files/media/push may be reused where justified

Must remain product-specific:

- rooms
- issues
- tasks
- home and operations workflow
- KeepCozy product framing and copy

Docs required:

- KeepCozy boundary docs
- capability entry docs when messaging is composed
- product-specific data flow and ownership notes

### Lioka

Product definition:

- separate future product under BWC

Delivery shape:

- iOS-first

Platform reuse:

- auth/identity if justified
- privacy/security baselines
- storage and migration discipline where appropriate
- support/admin patterns where useful

Capability reuse:

- messaging only if product value clearly requires it
- files/media/push only if the native product needs them

Must remain product-specific:

- native UX model
- iOS delivery decisions
- product-specific workflow and interaction patterns

Important admission rule:

- Lioka should align with BWC principles
- Lioka does not need to inherit the PWA shell or PWA route assumptions

Docs required:

- product definition
- native delivery-shape note
- capability reuse note
- boundary note describing which parts are platform-aligned vs product-native

## Rejection Or Delay Signals

Slow down before coding if any of these are true:

- the product cannot explain why it exists separately from an existing product
- the product boundary is mostly "we can decide later"
- delivery shape is unclear
- shared capability reuse is assumed but not defined
- product-specific logic is already being framed as generic platform work

## Operating Rule

Starting a new product inside BWC should become easier over time.
That only works if each product starts with a clear admission decision:

- what it is
- what it reuses
- what it owns
- what docs define it before implementation begins
