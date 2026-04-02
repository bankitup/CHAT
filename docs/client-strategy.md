# Client Strategy

## Current Delivery Path

The current delivery path for CHAT is the existing Next.js application as a mobile-first PWA. This is the active product shell and the primary experience the repository is meant to support.

The immediate goal is not to branch into multiple client implementations. The goal is to ship a strong, focused messaging product through the current shell while keeping the backend and module boundaries reusable.

## Primary Client Priority

The primary UX priority is mobile usage.

That means:

- flows should be designed with mobile interaction in mind first
- layouts should remain usable on desktop, but desktop is secondary
- the PWA should be treated as the real product surface, not as a temporary stopgap

Desktop and broader browser access remain available, but they are not the main optimization target for the current phase.

## Deployment Path

The active deployment target is Vercel.

Implementation choices should assume:

- the current Next.js app is the product shell being deployed
- the PWA is the shipping client
- server-side auth and routing behavior should align with Next.js and Vercel conventions

## Backend Truth

Supabase remains the backend truth for the system.

It is responsible for:

- authentication
- persisted data
- authorization and RLS boundaries
- long-term backend consistency for the messaging product

The client strategy does not change that foundation. The mobile-first PWA should sit on top of reusable backend and messaging-module boundaries rather than bypass them.

## Messaging Module Boundaries

Even though the current client path is singular, the architecture must remain reusable.

Core boundaries should stay clear between:

- product shell concerns
- messaging contracts
- data access and repositories
- future realtime integration boundaries

The current Next.js shell can evolve quickly, but it should not absorb responsibilities that belong to the reusable messaging module.

## Explicitly Out of Scope

The following are not part of the current phase:

- separate native iOS development
- separate native Android development
- client planning centered on native apps
- speculative multi-client abstractions with no current execution need

If future native clients ever become relevant, they should be built on top of the existing reusable backend and messaging boundaries. They should not shape the present phase.

## Working Guidance

When making product or architecture decisions in this repository:

- optimize for the current mobile-first PWA
- preserve reusable messaging-core boundaries
- keep the Next.js app production-minded and deployable on Vercel
- treat desktop/web as secondary, not primary
- avoid introducing native-client-driven complexity into current work
