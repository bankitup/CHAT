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

### 4a. Thread Runtime Sanity

- In an active Messenger thread:
  - scroll older history and confirm the viewport still loads older messages
  - if reactions are already present, confirm reaction groups and picker still
    render normally
  - if a voice message is already present in the environment, confirm the voice
    row still renders and local playback controls still appear where expected

### 4b. Conversation Runtime Recovery

- Run the focused matrix in
  [conversation-runtime-manual-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/conversation-runtime-manual-matrix.md)
  when the branch touches:
  - broken thread recovery
  - voice playback runtime
  - image attachment preview

### 4c. Realtime Recovery

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
