# Inbox Layout Regression Proof

## Scope

This note is a diagnostic proof pass for the current broken mobile inbox row
layout.

Observed symptom:

- the inbox row no longer composes as a stable card/list item
- avatar, title, time, and preview appear vertically broken apart
- this looks like layout/style collapse, not a data-loading failure

Inspected files:

- [inbox-filterable-content.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/inbox-filterable-content.tsx)
- [inbox-conversation-live-row.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/inbox-conversation-live-row.tsx)
- [inbox-conversation-static-row.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/inbox-conversation-static-row.tsx)
- [inbox-conversation-row-shared.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/inbox-conversation-row-shared.tsx)
- [inbox/layout.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/layout.tsx)
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css)
- [globals.css](/Users/danya/IOS%20-%20Apps/CHAT/app/globals.css)

## Healthy Row Contract

A healthy inbox row currently depends on this DOM shape:

1. list shell:
   - `section.stack.conversation-list.conversation-list-minimal`
2. row card:
   - `article.conversation-card.conversation-card-minimal[.conversation-card-dm]`
3. row layout wrapper:
   - `div.conversation-row[.conversation-row-dm]`
4. main clickable grid:
   - `a.conversation-row-link[.conversation-row-link-dm]`
5. two-column body:
   - avatar visual
   - `div.stack.conversation-card-copy`
6. copy block:
   - `div.stack.conversation-main-copy`
   - `div.conversation-title-row`
   - `div.conversation-title-meta`
   - preview paragraph
   - optional footer/meta pills

The actual positioning is not encoded in the JSX itself. It depends on CSS
rules such as:

- `.conversation-row { display: grid; grid-template-columns: auto minmax(0, 1fr); }`
- `.conversation-row-link { display: grid; grid-template-columns: auto minmax(0, 1fr); }`
- `.conversation-title-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; }`
- `.conversation-title-meta { display: inline-flex; }`
- `.conversation-preview { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`

Without those rules, the row falls back to ordinary block flow and the symptom
matches production exactly: avatar, title, recency, and preview stop composing
as one horizontal list item.

## What Is Not Broken

### 1. The current row JSX is still structurally intact

Both live and static rows still render the expected wrapper chain:

- [inbox-conversation-live-row.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/inbox-conversation-live-row.tsx)
- [inbox-conversation-static-row.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/inbox-conversation-static-row.tsx)

The recent row split did **not** remove:

- the `article.conversation-card` wrapper
- the `div.conversation-row` wrapper
- the `a.conversation-row-link` clickable grid container
- the `div.conversation-title-meta` alignment container
- the preview block

### 2. The list shell is still present

[inbox-filterable-content.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/inbox-filterable-content.tsx)
still renders the row list inside:

- `conversation-list`
- `conversation-list-minimal`
- `conversation-list-dm` on the primary mobile DM view

So this is not a case of the whole list losing its top-level wrapper.

### 3. The recent inbox row JSX diff is tiny

Comparing the current row files against the earlier inbox split commit
`07a9551` shows that the meaningful row skeleton did not change. The visible
differences are small preview-class cleanup and placeholder preservation, not a
new missing wrapper or a new wrong flex direction.

## What Actually Became Brittle

The high-risk change is the CSS ownership move from
[globals.css](/Users/danya/IOS%20-%20Apps/CHAT/app/globals.css) into
[messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css)
in commit `3a627c0` (`perf/client-i18n-and-global-css-pass`).

That change did three important things at once:

1. moved the inbox row layout selectors out of `app/globals.css`
2. created [inbox/layout.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/layout.tsx)
   as the new CSS ownership seam
3. made `/inbox` depend on route-local Messenger CSS for its core row contract

Current repo evidence:

- `app/globals.css` no longer contains the inbox row layout selectors
- those selectors now exist only in `app/(app)/messenger-route.css`
- `app/(app)/inbox/layout.tsx` is the only place that attaches that stylesheet

This is the first recent change that can explain the exact symptom without any
row-data failure:

- if route-local Messenger CSS does not load, does not apply, or is partially
  missing on the inbox route, the DOM remains intact but the row collapses into
  vertical block stacking

## Most Likely Regression Cause

The regression is best explained as a **style-contract ownership regression**,
not a row-composition regression.

More specifically:

- the healthy inbox row still relies on a set of grid/flex/ellipsis classes
- those classes were recently moved out of guaranteed global scope
- the inbox route now depends on the route-local stylesheet import in
  [inbox/layout.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/layout.tsx)
  for the core row layout contract
- when that contract is absent, the rendered DOM produces the observed broken
  mobile layout exactly

## Practical Fix Direction For The Next Branch

Do **not** start by rewriting inbox row JSX.

Start by verifying the route-local style contract:

1. confirm that `/inbox` always loads the stylesheet from
   [inbox/layout.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/layout.tsx)
2. confirm that the row selectors in
   [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css)
   are actually present and active on the broken mobile path
3. only if that contract is healthy should the next branch inspect finer JSX
   wrapper issues

## Conclusion

No convincing JSX-level wrapper regression was found in the current inbox row
split.

The strongest proof is that:

- row DOM shape is still healthy
- list shell is still healthy
- the recent meaningful ownership change was moving the inbox row layout rules
  out of global CSS and into a route-local Messenger stylesheet

That CSS ownership move is the real regression candidate the next branch should
target first.
