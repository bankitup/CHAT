# Architecture Manual Verification

## Purpose

Use this checklist after platform/product boundary changes to confirm the repo
still behaves like one BWC platform hosting separate Messenger and KeepCozy
products.

This is a manual sanity checklist, not a feature-expansion script.

Focused conversation-runtime recovery checks also live in
[conversation-runtime-manual-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/conversation-runtime-manual-matrix.md).

Fast architecture-drift review checks for shared or mixed seams live in
[architecture-drift-pr-checklist.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/architecture-drift-pr-checklist.md).

## Preconditions

- valid login credentials exist
- at least one Messenger-profile space exists
- at least one KeepCozy-profile space exists
- if linked thread behavior is currently present in the test environment, there
  is at least one issue/task/conversation combination to inspect

## Checklist

### 1. Login

- Log in successfully from [login/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/login/page.tsx).
- Confirm the app resolves into the shared authenticated shell instead of
  falling into a product-specific dead end.
- Confirm invalid or missing space context still routes to the shared
  [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx)
  selection surface when appropriate.

### 2. Enter Messenger Surfaces

- Open a Messenger-profile space from
  [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx).
- Confirm the default landing stays Messenger-first:
  - inbox is reachable
  - chat routes open normally
  - Messenger bottom-nav posture appears chat-first
- Confirm [inbox/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/page.tsx)
  still loads conversations for the active space.

### 3. Enter KeepCozy Surfaces

- Open a KeepCozy-profile space from
  [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx).
- Confirm the default landing stays KeepCozy-first:
  - home loads
  - rooms/issues/tasks/activity are reachable
  - the shell posture feels operations-first rather than inbox-first
- Confirm Messenger surfaces remain reachable as supporting capability, not as
  the primary shell.

### 4. Basic Chat Flow

- In a Messenger-profile space:
  - open inbox
  - open an existing conversation or create one through the normal flow
  - send a basic message
  - verify the thread loads and the inbox preview updates
- if a known-problem conversation is available in the environment, confirm the
  thread body now shows a contained recovery state with retry, back-to-chats,
  and info escape paths instead of leaving the route dead or blank
- open thread settings and confirm the route loads without breaking the chat
  shell
- Confirm no KeepCozy route is required for this flow.

### 4a. Messenger Layout Sanity

- On a narrow mobile-width viewport, open
  [inbox/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/page.tsx)
  and confirm each conversation item still reads as one coherent row/card:
  - avatar area on the left
  - primary copy in the center
  - time/unread/meta aligned as a compact rail instead of dropping into block
    stacking
  - preview text staying inside the content column
- Open
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/page.tsx)
  and confirm the mobile shell still resolves into three clear layers:
  - header card
  - message body/thread
  - composer area
- In the same thread, confirm the composer still behaves like one unified
  product control:
  - attachment entry stays inside the shell instead of appearing as a loose
    browser control
  - voice button stays attached to the action cluster
  - send button stays attached to the same cluster
  - no raw native file input is visible by default
- Confirm message rows still read as one attached unit:
  - message body and attachments stay visually attached
  - timestamp and status/checkmarks stay attached to the correct message block
  - voice rows stay inside the same message-column contract instead of
    floating as separate cards
- Open
  [settings/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/page.tsx)
  and confirm:
  - profile top row stays aligned
  - status top row stays aligned
  - space-summary action button does not overlap or squeeze the content column
- With Messenger shell navigation visible, confirm the bottom nav still fits as
  one compact mobile control:
  - shell stays centered and within the viewport width
  - labels remain truncated instead of wrapping into taller broken pills
  - active Messenger nav state does not distort adjacent tabs

### 4b. Thread Runtime Sanity

- In an active Messenger thread:
  - scroll older history and confirm the viewport still loads older messages
  - if reactions are already present, confirm reaction groups and picker still
    render normally
  - if a voice message is already present in the environment, confirm the voice
    row still renders and local playback controls still appear where expected

### 4c. Conversation Runtime Recovery

- Run the focused matrix in
  [conversation-runtime-manual-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/conversation-runtime-manual-matrix.md)
  when the branch touches:
  - broken thread recovery
  - voice playback runtime
  - image attachment preview

### 4d. Realtime Recovery

- When the branch touches Messenger live ownership, reconnect behavior, or
  catch-up logic, run the focused realtime rows in
  [manual-test-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/stability/manual-test-matrix.md):
  - thread live update arrival
  - inbox summary live update arrival
  - thread background -> foreground recovery
  - inbox background -> foreground recovery
  - reconnect recovery
- Confirm the mounted route heals in place. Do not accept "leave and re-enter
  the route" as the primary recovery mechanism.
- Confirm presence/typing still look helpful, but do not become the reason the
  thread or inbox appears fresh.

### 4e. Messenger UX Quick Pass

- In a Messenger thread, send one short text message and confirm:
  - first tap shows immediate acknowledgment
  - the optimistic row settles into a committed row without a visible dead gap
  - the message does not flash through an "unavailable" state during normal
    send/load
- In the same thread, record and send one voice note, then replay it and
  confirm:
  - progress starts from zero instead of looking partially filled before real
    playback
  - replay after end starts cleanly
  - pause/resume does not leave the row looking half-loaded
- On a narrow mobile-width viewport, open
  [inbox/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/page.tsx)
  and confirm:
  - rows still read as light list items instead of heavy isolated cards
  - avatar, title, preview, and time/meta stay in one coherent row
- On the same viewport, open
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/page.tsx)
  and confirm:
  - the participant title looks visually centered between the back button and
    avatar
  - the header feels balanced rather than offset by a hidden spacer

### 5. KeepCozy Flow Still Working

- In a KeepCozy-profile space:
  - open home
  - open activity
  - confirm operational surfaces still load
  - confirm the activity page still shows messaging-backed activity where
    currently expected
- Confirm KeepCozy messaging-related behavior works without needing Messenger
  shell navigation to set it up first.

### 6. Governance and Membership Sanity

- In a space where the tester is a space admin:
  - confirm member-management entry is still available
- In a space where the tester is a non-admin member:
  - confirm member-management entry is not shown
- Confirm this rule behaves the same regardless of whether the active space is
  Messenger-primary or KeepCozy-primary.

### 7. Linked Thread Behavior

- If issue/task-linked thread behavior is currently present in the environment:
  - open the KeepCozy object surface
  - open its linked discussion surface
  - confirm the linked thread still resolves
  - confirm the route does not depend on Messenger shell navigation to work

## Expected Outcome

The check passes when:

- login still enters the shared app safely
- Messenger surfaces behave like Messenger
- KeepCozy surfaces behave like KeepCozy
- governance/membership gates still behave consistently across both products
- messaging remains reusable capability instead of dragging KeepCozy through
  Messenger shell internals
- realtime recovery remains route-scoped and stronger in place than route
  re-entry

## Escalate If

- Messenger and KeepCozy nav feel collapsed back into one mixed shell
- KeepCozy route behavior only works after entering Messenger surfaces first
- member-management visibility differs by product posture instead of shared
  governance
- linked thread behavior depends on Messenger route-local setup instead of the
  bounded integration seam
