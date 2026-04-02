# CHAT

CHAT is a mobile-first PWA messenger built on a reusable messaging module foundation. The current product shell is a Next.js application deployed through Vercel, with Supabase as the backend source of truth for auth, data, and access control.

This repository should be treated as `messaging-core + current product shell`, not as a one-off chat UI and not as a placeholder for separate native apps.

## Product Direction

The active product path is clear:

- The current Next.js app is the main product shell.
- The primary user experience target is mobile usage through a PWA.
- Deployment is intended for Vercel.
- Desktop and broader web access remain available, but they are secondary to the mobile experience.
- Supabase remains the shared backend truth.

The architecture must stay reusable even while the current delivery path is focused on one product shell.

## Product Vision

CHAT is being built as a durable messaging foundation that can support a real product, not just a single interface. The goal is to create a reusable messaging module with clean boundaries around contracts, data access, auth, and client-facing integration.

That foundation should support:

1. The current mobile-first PWA product.
2. Future embedding into other product surfaces if needed.
3. Continued evolution of the same messaging system without rewriting the backend model.

The current phase does not include separate native iOS or Android applications.

## Current Phase

Phase 1 is foundation and product-shell execution:

- Next.js App Router as the active application shell.
- Mobile-first PWA framing.
- Vercel deployment path.
- Supabase-backed auth and session handling.
- Supabase-backed schema and access patterns.
- Row Level Security strategy.
- Messaging module boundaries that remain reusable outside the current shell.

Current implementation priority is foundation first:

- auth
- schema
- RLS
- messaging domain structure
- mobile-first web shell

## Current Scope

Current scope is chat only. The repository is focused on establishing the base product and architectural layers required for messaging, without expanding into adjacent communication features or speculative client strategies.

## Explicitly Out of Scope

The following are out of scope for the current phase:

- Separate native iOS applications.
- Separate native Android applications.
- Audio calls.
- Video calls.
- Rich media or attachment systems before the foundation is stable.
- Realtime implementation before the core auth and data model are stable.
- Product-specific shortcuts that tightly couple the messaging core to one screen or route structure.

Realtime is planned later through Supabase Broadcast and Presence, but it should be treated as follow-on work rather than part of the current base scaffold.

## Core Architecture Direction

The repository should preserve a clear separation between:

- Messaging core: contracts, persistence-facing logic, reusable client-facing interfaces, and infrastructure boundaries.
- Product shell: routes, layouts, page-level flows, and PWA-specific presentation behavior.

The current Next.js app is the live shell for the product, but it should not absorb responsibilities that belong to the reusable messaging module.

Supabase is the backend truth. It owns:

- authentication state
- persisted data
- authorization boundaries
- long-term backend consistency across client surfaces

## Main Stack

- Next.js App Router for the active product shell
- TypeScript for application and domain code
- Vercel for deployment
- Supabase for auth, database, and future realtime infrastructure
- ESLint for code quality

## Project Structure Overview

The structure should remain modular from the start:

```text
app/                        # Current Next.js product shell
src/
  lib/
    supabase/              # Shared Supabase helpers and SSR integration
  modules/
    messaging/
      contract/            # Domain contracts and shared messaging types
      data/                # Persistence-facing logic and repositories
      sdk/                 # Reusable client-facing integration layer
      realtime/            # Future realtime boundary
      ui/                  # Messaging-specific reusable UI primitives
docs/                      # Product and implementation guidance
```

If a module is not active yet, it should still exist as a minimal placeholder with a clear purpose.

## Product Principles

- Build for the active product path, not for hypothetical clients.
- Optimize the UX for mobile usage first.
- Keep the messaging foundation reusable.
- Treat Supabase as the shared source of truth.
- Keep the current Next.js shell production-minded and deployable.
- Avoid coupling core messaging logic to route-level or page-level implementation details.

## Engineering Principles

- Foundation before feature breadth.
- Clean boundaries between product shell and messaging core.
- Minimal dependencies unless they clearly improve the foundation.
- Vercel-friendly and Supabase-aligned implementation choices.
- Mobile-first execution without turning the codebase into a one-client dead end.

## Development Philosophy

Work in this repository should strengthen the actual shipping path: the current mobile-first PWA on Next.js.

When making changes:

- treat the Next.js app as the active product shell
- optimize flows and structure for mobile-first usage
- keep desktop/web compatibility, but do not optimize for it first
- avoid drifting into native app planning
- preserve reusable messaging boundaries
- keep Supabase-centered auth and data assumptions explicit

## Near-Term Roadmap

1. Stabilize auth, sessions, and protected routing in the current shell.
2. Define the initial Supabase schema and RLS model for messaging.
3. Formalize messaging contracts and data boundaries.
4. Build the minimal inbox and conversation surfaces for the mobile-first PWA.
5. Add realtime through Supabase Broadcast and Presence after the base model is stable.

Attachments, richer messaging flows, and deeper product behavior come after the foundation is working cleanly.

## Long-Term Direction

The long-term direction is a reusable messaging system with a strong current product shell, not a fragmented multi-client strategy from day one.

Over time, the messaging module may support additional surfaces, but current execution should remain centered on:

- the mobile-first PWA
- Vercel deployment
- Supabase-backed backend consistency
- reusable messaging boundaries

Separate native clients are not part of the current phase and should not shape near-term implementation decisions.

## Guidance for AI Agents and Collaborators

Approach this repository as a real product codebase with one active delivery path: the current mobile-first PWA.

- Treat the Next.js app as the active shell, not as a throwaway prototype.
- Keep work aligned with Vercel deployment and Supabase SSR patterns.
- Protect the messaging-core boundary from page-specific coupling.
- Do not invent native client plans or abstractions that are not needed now.
- Prefer execution-focused documentation and code over speculative architecture.
- When in doubt, choose the path that improves the current mobile-first PWA without reducing backend or module reuse.
