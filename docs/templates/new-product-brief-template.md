# New Product Brief Template

## Purpose

Use this template before starting a new product inside BWC.

The brief should be short, clear, and product-shaped.
It is not an architecture document.
Its job is to make sure the team can answer what the product is before deciding
what should be shared.

## Template

### 1. Product Name

- Working name:
- Permanent name, if already decided:

### 2. Product Goal

- One-sentence product definition:
- What problem it solves:
- Why this should exist as a separate product inside BWC:

### 3. Target Users

- Primary user:
- Secondary user, if any:
- What daily or weekly workflow this product is meant to support:

### 4. Delivery Shape

- Primary delivery shape:
  - `PWA mobile-first`
  - `iOS-first`
  - `web-admin-first`
  - `mixed`
- Why this shape is the right default:
- What existing BWC delivery assumptions do not apply:

### 5. Product Scope

- Core user-facing surfaces in v1:
- Core workflow in v1:
- Product-specific domain objects, if already known:
- Likely platform foundations reused:
- Likely shared capabilities reused:

### 6. What Success Looks Like

- What users should be able to do reliably in v1:
- What trust promise the product should make in v1:
- What business or product success signal matters first:

### 7. Explicit v1 Non-Goals

- What is not part of v1:
- What tempting reuse or abstraction should wait:
- What future expansions are known but intentionally deferred:

### 8. Boundary Reminder

Document explicitly:

- what must remain product-specific
- what can reuse BWC platform foundation
- what can consume shared capability
- what should not be generalized yet

## Example Prompts

### Messenger example

- Product goal: daily private messaging
- Delivery shape: `PWA mobile-first`
- Likely shared capability: messaging is the main capability
- Must stay product-specific: inbox UX, thread UX, composer behavior, product
  trust and rollout choices

### KeepCozy example

- Product goal: home and operations workflow product
- Delivery shape: `PWA mobile-first`
- Likely shared capability: may consume messaging selectively later
- Must stay product-specific: rooms, issues, tasks, home/ops flow, product
  framing

### Lioka example

- Product goal: separate future product under BWC
- Delivery shape: `iOS-first`
- Likely shared reuse: auth/identity, storage, privacy/security baselines
- Must stay product-specific: native UX model, iOS interaction patterns,
  delivery decisions

## Completion Check

The brief is ready when:

- the product can be explained in one paragraph
- the delivery shape is explicit
- the product boundary is explicit
- the v1 non-goals are explicit
- the product does not read like a vague “shared initiative”
