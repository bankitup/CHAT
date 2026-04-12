# Layer Ownership Rules

## Purpose

This document defines where new logic should live inside BWC.

It is intended to reduce accidental coupling between:

- platform foundation
- shared capabilities
- products
- company and ops concerns
- documentation
- deployment and runtime concerns

## Layer Summary

There are six practical ownership layers:

1. platform
2. shared capability
3. product
4. ops/company layer
5. docs
6. deployment/runtime layer

Each layer has different responsibilities.
Not every shared concern belongs in platform.
Not every reusable helper deserves a capability.

## 1. Platform

### What belongs there

- auth/session foundations
- current-user identity foundations
- privacy and security baselines
- shared access boundaries
- common storage and migration discipline
- shared routing and shell rules that truly apply across products
- common profile primitives
- shared UI/runtime rules that multiple products must obey

### What does not belong there

- Messenger inbox or chat product logic
- KeepCozy home-ops workflow logic
- product-specific copy or product-specific navigation decisions
- domain logic that is only "shared" because one product currently dominates the repo

### Examples

- shared request context helpers
- Supabase server/service wiring
- shared spaces/access rules
- shared profile identity helpers

### Common mistakes

- putting product posture inside a platform module because it is convenient
- treating a shared folder as proof that code is foundational
- moving product-specific code upward too early to make the tree look cleaner

## 2. Shared Capability

### What belongs there

- bounded domain systems reused or intended for reuse by multiple products
- domain-specific persistence and transport logic
- stable domain contracts
- reusable runtime flows inside one real capability

### What does not belong there

- generic platform concerns with no domain boundary
- one product's UX flow pretending to be a reusable service
- product copy, product shell decisions, or product success metrics

### Examples

- messaging
- message assets and delivery
- messaging realtime
- messaging push
- messaging E2EE

### Common mistakes

- treating the first strong capability as the center of the entire platform
- leaking product route behavior directly into capability modules
- broadening a capability because a second product might someday want one tiny part of it

## 3. Product

### What belongs there

- product-specific screens
- product-specific workflows
- product-specific copy
- product-specific decisions about how a capability is presented
- product-specific business logic that does not belong in a reusable domain

### What does not belong there

- shared auth foundations
- shared access rules
- shared storage and migration rules
- company-wide ops concerns
- capability internals that should stay reusable and bounded

### Examples

- Messenger inbox and thread UX
- KeepCozy rooms, issues, tasks, and home flows
- Lioka-specific native product flows

### Common mistakes

- pushing product logic downward into capability folders for convenience
- pushing product logic upward into platform because another product might later want something similar
- confusing route-level reuse with true shared domain ownership

## 4. Ops / Company Layer

### What belongs there

- projects pipeline
- team coordination support
- finance support
- HR support
- legal support
- key metrics and operating visibility
- support and admin operating patterns

### What does not belong there

- product feature logic
- Messenger-specific or KeepCozy-specific business flows
- technical foundation code that has no company-ops meaning

### Examples

- future internal admin/support workflows
- company metrics reporting
- internal operational dashboards

### Common mistakes

- hiding product back-office logic under a vague "ops" label
- pretending an internal tool is platform foundation when it is really one product's workflow
- overbuilding internal systems before the real operating need exists

## 5. Docs

### What belongs there

- source-of-truth doctrine
- architecture rules
- decision records
- operational runbooks
- manual verification notes
- rollout and safety guidance

### What does not belong there

- hidden product decisions that never made it into source-of-truth docs
- branch-specific assumptions presented as permanent doctrine
- documentation that silently conflicts with current runtime ownership

### Examples

- platform doctrine
- ownership rules
- product admission checklist
- architecture acceptance docs

### Common mistakes

- leaving README and doctrine docs out of sync
- letting branch notes override source-of-truth architecture docs
- using documentation to justify code ownership that the runtime does not actually follow

## 6. Deployment / Runtime Layer

### What belongs there

- environment and deployment assumptions
- shared runtime constraints
- storage/runtime delivery rules
- push/device/runtime integration rules
- performance and stability guardrails that affect multiple surfaces

### What does not belong there

- product strategy
- product copy
- company process rules that are not runtime concerns
- domain logic disguised as infrastructure

### Examples

- Supabase environment wiring
- shared attachment delivery routes
- mobile performance guardrails
- deployment conventions

### Common mistakes

- mixing deployment concerns into product docs without clear ownership
- treating infra choices as if they automatically define product semantics
- pushing domain decisions into runtime layers because they are technically shared

## Decision Filter

Use this filter before placing new logic.

### 1. Is this needed by at least two products

- If no, default to product ownership.
- If yes, continue.

### 2. Is it foundational or just convenient

- If it is required regardless of product, it may be platform.
- If it is a reusable domain system, it may be a shared capability.
- If it is only a convenience abstraction, keep it closer to the product until reuse is real.

### 3. Is this product-specific logic pretending to be shared

Warning signs:

- the naming is generic but the behavior clearly serves one product
- the abstraction mostly exists to reduce imports, not to clarify ownership
- changing one product would likely break the abstraction immediately

If any of these are true, it probably still belongs in the product.

### 4. Does this belong in platform, shared capability, or product

Use this shortcut:

- platform if it is foundational across products
- shared capability if it is a bounded reusable domain
- product if it is user-facing workflow or product-specific behavior

If it primarily serves company operations rather than end-user product behavior,
consider the ops/company layer instead.

## Practical Examples

### Example: auth/session viewer lookup

- Needed by multiple products: yes
- Foundational: yes
- Correct layer: platform

### Example: message attachment delivery

- Needed by multiple products: potentially
- Foundational: no
- Bounded domain: yes
- Correct layer: shared capability

### Example: Messenger new-DM flow copy and behavior

- Needed by multiple products: no
- Product-specific: yes
- Correct layer: product

### Example: future internal finance approval workflow

- Product-facing: no
- Company-operational: yes
- Correct layer: ops/company layer

## Default Rule

When in doubt:

- keep foundation thin
- keep capabilities bounded
- keep products product-shaped
- avoid upward moves unless reuse is real and ownership becomes clearer, not blurrier
