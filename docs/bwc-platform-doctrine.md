# BWC Platform Doctrine

## Purpose

This document defines how BWC should be understood in this repository and how
future work should be evaluated.

It is not a claim that the platform is already large or finished.
It is a practical doctrine for keeping the repo legible while multiple products
and operating functions grow on top of the same foundation.

## What BWC Is

BWC is the platform layer and operating company layer above the products in
this repository.

In practical terms, BWC is responsible for:

- maintaining the shared technical foundation
- providing reusable capabilities where reuse is real
- absorbing selected operating functions so product teams do not each recreate
  finance, support, legal, workflow, or internal coordination patterns
- making future products faster and cheaper to launch

BWC is not a single product.
Messenger is not BWC.
KeepCozy is not BWC.
Lioka will not be BWC.

## Core Reading

Read the stack in this order:

1. BWC company and platform layer
2. BWC technical foundation
3. reusable shared capabilities
4. separate products on top

This order matters because it prevents two common mistakes:

- treating the first product as the center of the whole repo
- turning every reusable helper into premature platform infrastructure

## Simple Stack Diagram

```text
BWC company + platform direction
|- projects pipeline
|- teams
|- key metrics
|- operations
|- finance
|- HR
|- legal
|
|- BWC technical foundation
|  |- auth / identity
|  |- privacy / security
|  |- architecture standards
|  |- database / storage / migrations
|  |- support / admin patterns
|  |- notifications / devices / push
|  |- shared UI / runtime rules
|  |- AI agents and automation direction
|
|- Shared capabilities
|  |- messaging
|  |- future bounded reusable services where justified
|
|- Products
   |- Messenger (PWA mobile-first)
   |- KeepCozy (PWA mobile-first)
   |- Lioka (iOS-first)
```

## What Counts As Platform

Platform means shared foundation that should remain valid regardless of which
product is active.

Platform usually includes:

- auth and current-user identity foundations
- request and session context
- privacy and security baselines
- shared storage and migration discipline
- deployment and runtime rules
- common support/admin patterns
- shared shell rules only where they are truly cross-product
- platform-wide routing, access, and tenancy foundations

Platform is not just "anything in a shared folder".
Platform should be thin, strong, and durable.

## What Counts As Shared Capability

A shared capability is a bounded domain system that may be used by more than
one product, but is not the same thing as platform foundation.

Current example:

- messaging

Messaging is a shared capability because it owns a real domain:

- conversations
- messages
- attachments
- realtime
- push
- E2EE

That does not make messaging the center of the whole repo.
It means messaging should stay bounded and reusable without redefining the
platform around itself.

## What Counts As Product

A product is a user-facing business surface with its own value proposition,
workflow, and delivery shape.

Products in current doctrine:

- Messenger
- KeepCozy
- Lioka

Products can reuse platform and capability layers, but they should still own:

- product-specific UX
- product-specific workflow logic
- product-specific success metrics
- product-specific rollout decisions

## Why Messenger And KeepCozy Are Separate Products

Messenger and KeepCozy may live in the same repository and may share
infrastructure, but they are not the same product.

Messenger is:

- a private messaging product
- PWA mobile-first
- the primary current consumer of the messaging capability

KeepCozy is:

- a separate product domain
- PWA mobile-first
- focused on home and operations workflows, not message-centric product
  identity

KeepCozy may consume messaging later as a bounded capability where that creates
clear product value.
That should be read as "KeepCozy reuses messaging", not "KeepCozy is a mode on
top of Messenger".

## How Lioka Fits

Lioka is planned as a separate product.

Lioka should be compatible with BWC platform principles:

- clear product boundary
- reuse real platform foundations where they help
- reuse shared capabilities only when justified

Lioka does not need to share the same delivery shape as Messenger and
KeepCozy.

Important distinction:

- Messenger and KeepCozy are currently PWA mobile-first inside one shared Next.js
  codebase
- Lioka is expected to be iOS-first

That means Lioka should align with BWC infrastructure principles without being
forced into the same app-shell or frontend delivery model as the PWA products.

## Operating Functions BWC Absorbs

BWC should absorb certain company and operating roles at the platform/company
level so product development becomes simpler.

These functions include:

- projects pipeline
- teams and coordination
- key metrics
- operations
- finance
- HR
- legal
- support patterns

This does not mean all of those domains are already active software domains in
the repo.
It means ownership for those concerns should sit above product code, not inside
Messenger or KeepCozy by default.

## Active Now Vs Planned Later

### Active now

These platform directions are already active in repo terms:

- shared auth/session foundations
- shared app shell and route framing
- shared profile and identity foundations
- shared storage and migration discipline
- shared spaces and access boundaries
- messaging as a bounded reusable capability
- Messenger as a product
- KeepCozy as a product

### Planned later

These are future platform or ops domains, not active platform products yet:

- full projects pipeline tooling
- formal team operations tooling
- company metrics systems
- finance workflows
- HR workflows
- legal workflows
- broader support/admin systems
- AI agent orchestration as a mature platform layer
- Lioka production implementation

The rule is simple:

- active now should influence current code ownership
- planned later should influence direction, naming, and boundary discipline
- planned later should not justify premature generic systems

## Practical Platform Principles

### Thin strong foundation first

Build only the platform foundation that multiple products truly need.
Keep it stable, explicit, and boring.

### Reusable capability second

Promote a domain into a shared capability only when it already behaves like a
real bounded system or clearly needs to.

### Separate products on top

Products should remain product-shaped.
They can reuse foundation and capability layers without losing their own
identity.

### Do not over-generalize too early

Convenient reuse is not enough reason to create a generic platform subsystem.

If the abstraction is mostly there to make one product look "cleaner", it
probably still belongs to the product.

## Practical Doctrine For Development Decisions

When deciding where new work belongs:

1. Put true cross-product foundations in platform.
2. Put bounded reusable domains in shared capabilities.
3. Keep product workflows inside the product.
4. Keep company and operating concerns at the BWC/company layer, not inside a
   product by accident.
5. Treat "planned later" as guidance, not permission to overbuild now.

## Short Operational Conclusion

The repo should be read as:

- BWC platform and operating foundation at the top
- reusable capabilities where they are real
- Messenger, KeepCozy, and later Lioka as separate products

The platform exists to make future product work faster and cheaper.
It should not collapse every product into one giant generic system, and it
should not let the first strong capability define the whole company.
