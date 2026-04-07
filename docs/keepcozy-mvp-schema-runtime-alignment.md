# KeepCozy MVP Schema And Runtime Alignment

## Purpose

This document aligns the current shared repository runtime with the first
KeepCozy MVP schema slice.

It answers four practical questions:

1. which current pieces already support the MVP direction
2. which current pieces are still chat-first or future-layer scaffolding
3. which schema/runtime surfaces should define the next implementation center
4. which broader domains must remain future-only for now

This is an alignment document, not a broad redesign plan.

Related documents:

- [keepcozy-mvp-boundary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-boundary.md)
- [keepcozy-first-persistence-slice.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-first-persistence-slice.md)
- [keepcozy-mvp-test-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-test-flow.md)
- [keepcozy-chat-shared-vocabulary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-shared-vocabulary.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)
- [2026-04-03-spaces-v1.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql)
- [2026-04-05-conversations-space-id-required.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-05-conversations-space-id-required.sql)
- [2026-04-06-message-assets-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-runtime-align.sql)
- [2026-04-07-conversation-companion-metadata-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-conversation-companion-metadata-foundation.sql)
- [2026-04-07-space-timeline-events-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-space-timeline-events-foundation.sql)

## Decisions Locked By This Pass

- treat shared `space` and `space_members` as the current `home` and
  `home_membership` compatibility seam
- treat `room`, `issue`, `issue_update`, `task`, and `task_update` as the first
  missing first-class MVP schema slice
- keep `conversation_companion_metadata` and `space_timeline_events` as future
  support layers, not the center of the first runtime proof
- keep KeepCozy-first routes (`/home`, `/rooms`, `/issues`, `/tasks`,
  `/activity`) as the visible shell center while dedicated MVP tables are still
  missing
- keep chat and settings routes as secondary support surfaces rather than the
  product definition of KeepCozy
- do not let service requests, work orders, inspections, supplier/procurement
  flows, or intelligence-heavy domains define the current MVP

## 1. Current Pieces That Already Match The MVP Slice

These pieces already support the intended first KeepCozy runtime shape, even if
they still use shared CHAT foundation naming under the hood.

| Current piece | Current source | MVP interpretation |
| --- | --- | --- |
| outer container boundary | `public.spaces` and `public.space_members` from [2026-04-03-spaces-v1.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql) | current compatibility layer for `home` and `home_membership` |
| active space resolution | [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts) and [url.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/url.ts) | current home-selection and home-routing seam |
| home selector screen | [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx) | current product-facing entry for choosing a home context |
| KeepCozy-first route scaffolding | [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx), [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/rooms/page.tsx), [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/page.tsx), [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/page.tsx), [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx) | current UI focus layer for home / room / issue / task / history |
| current home summary | [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/page.tsx) | current product-facing surface for the selected home context |
| minimal committed attachment foundation | `public.message_assets` and `public.message_asset_links` from [2026-04-06-message-assets-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-runtime-align.sql) | reusable narrow attachment pattern for future MVP history surfaces |

Important rule:

- these pieces are aligned because they support the outer home context and
  minimal asset/history needs
- the new KeepCozy-first routes intentionally use focused preview scaffolding
  so the visible app flow no longer reads as chat-first
- they are not proof that room/issue/task runtime already exists

## 2. Current Pieces That Do Not Yet Match The MVP Slice

The following first-class MVP entities still do not have active runtime schema
or code in this repository:

- `homes` as a dedicated physical table separate from shared `spaces`
- `home_memberships` as a dedicated physical table separate from
  `space_members`
- `rooms`
- `issues`
- `issue_updates`
- `tasks`
- `task_updates`

Practical interpretation:

- the first MVP runtime should currently be read as:
  - shared `space` foundation already exists
  - dedicated room/issue/task schema slice does not exist yet

That means the next schema/runtime center of gravity should move toward those
missing entities rather than toward broader future object families.

## 3. Current Pieces That Are Real But Future-Layer Only

These pieces exist in docs, SQL drafts, or helper code, but they should not be
misread as the active KeepCozy MVP center.

| Current piece | Current source | Why it is not the MVP center |
| --- | --- | --- |
| operational thread companion metadata | [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts), [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts), [2026-04-07-conversation-companion-metadata-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-conversation-companion-metadata-foundation.sql) | future conversation/thread enrichment, not required to prove home/room/issue/task runtime |
| unified space timeline foundation | [space-timeline-events.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/space-timeline-events.ts), [2026-04-07-space-timeline-events-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-space-timeline-events-foundation.sql) | future audit/activity layer, not required before issue/task history exists |
| future operational thread and object vocab | [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts) | contains broader future object/thread vocabulary that should not define the first schema slice |

Important rule:

- these pieces are valid additive groundwork
- they must stay subordinate to the first dedicated room/issue/task runtime

## 4. Current Pieces That Pull Toward Future Or Out-Of-Scope Domains

The repository already contains broader future-domain scaffolding. It is useful
architecture, but it should not define the current MVP direction.

### Future-heavy object and workflow vocabulary

Current examples:

- `service_request`
- `work_order`
- `supplier_order`
- `inspection`
- `incident_resolution`
- `quality_review`
- `procurement_request`
- `vendor_assignment`
- `space_document`

Current sources:

- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)
- [2026-04-07-conversation-companion-metadata-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-conversation-companion-metadata-foundation.sql)
- [2026-04-07-space-timeline-events-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-space-timeline-events-foundation.sql)

Alignment rule:

- keep this vocabulary documented as future architecture
- do not let it replace the first MVP entity set of room/issue/task/history

### Broader policy and external-participant scaffolding

Current examples:

- supplier-specific flows
- contractor assignment scope
- inspection-specific visibility
- richer operator oversight semantics

Current sources:

- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-space-policy-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-policy-matrix.md)
- [keepcozy-space-rls-hardening.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-rls-hardening.md)

Alignment rule:

- keep these as future access architecture
- do not make them the gating requirement for the first home/room/issue/task
  proof

### Broader storage and intelligence direction

Current examples:

- space-aware storage evolution
- broader document/media namespaces
- climate and sensor follow-on thinking
- intelligence and recommendation directions

Current sources:

- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [keepcozy-mvp-boundary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-boundary.md)

Alignment rule:

- keep attachment support narrow and practical
- do not make storage, climate, sensors, or intelligence the current schema
  center of gravity

## 5. Current Runtime Drift

The biggest current runtime drift is not future-domain logic in the UI.

The biggest drift is that the visible app shell still presents the product as a
chat-first shell:

- [public-home-screen.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(public)/public-home-screen.tsx)
- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/page.tsx)
- [README.md](/Users/danya/IOS%20-%20Apps/CHAT/README.md)

Current interpretation after this pass:

- `/spaces` should be treated as the current home selector over the shared
  `space` foundation
- `/settings` currently includes the visible selected-home summary
- `/inbox` and `/activity` remain transitional communication/history surfaces
  until room/issue/task UI exists
- current chat routes must not be mistaken for the full KeepCozy product model

## 6. Schema Slice Guidance For The Next Real MVP Runtime

The first real KeepCozy schema/runtime slice should be centered on:

- shared `space` / `space_members` as current home compatibility layer
- `rooms`
- `issues`
- `issue_updates`
- `tasks`
- `task_updates`
- narrow attachment support only where history actually needs it

Recommended interpretation of `homes` and `home_memberships` in this shared
repo:

- use product language `home` and `home membership`
- keep shared schema/runtime alignment with `space` and `space_members` unless
  a later dedicated schema step proves that physical separation is necessary

Recommended non-goals for the next slice:

- do not start with `service_requests` plus `work_orders` plus `inspections`
  plus `supplier_orders`
- do not make `conversation_companion_metadata` mandatory
- do not make `space_timeline_events` mandatory
- do not block on richer external-assignment or operator-policy layers
- do not widen into climate, sensors, marketplace, or intelligence work

## 7. Runtime Guidance For The Current Shell

Until dedicated room/issue/task screens land:

- visible product copy should prefer `home` where the user is choosing or
  reviewing the shared `space` container
- public product framing should prefer KeepCozy over Chat branding
- current chat surfaces should remain available as shared communication
  infrastructure, not as the product definition

Important rule:

- changing product-facing copy is acceptable where it clarifies MVP direction
- changing shared schema or forcing a route redesign is not required for this
  pass

## 8. Guardrails

- do not rename active shared schema tables away from `space` in runtime code
- do not let future thread/object vocabulary define the first room/issue/task
  schema slice
- do not make unified timeline or companion metadata the prerequisite for MVP
- do not let attachment/media foundations expand into asset-platform scope
- do not let current chat shell inertia redefine the KeepCozy MVP

## 9. Remaining Ambiguities

- whether first-class physical `homes` / `home_memberships` tables will ever be
  needed beyond the shared `space` foundation
- whether minimal MVP attachments should hang directly off issue/task updates or
  pass through a thinner shared asset-link seam
- whether a narrow issue-linked communication lane should exist in the first
  runtime slice or stay fully deferred until after room/issue/task screens land
