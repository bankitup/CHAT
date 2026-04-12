# Broken Thread History Proof

## Purpose

This note documents the current proof-oriented diagnostics for the broken
Messenger thread case where:

- the chat header renders
- the composer renders
- the thread history/body does not render correctly

The goal of this pass is to prove the failing stage instead of guessing.

## Current Interpretation

Given the current route shape, this symptom already narrows the problem:

- route access is alive
- `loadMessengerThreadPageData(...)` is likely completing
- `ThreadPageContent` is mounting
- the failure is most likely inside the history/body subtree

The strongest current code-level suspicion is a render-time failure caused by a
single bad row or a bad row-adjacent payload inside
[thread-history-viewport.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx),
not a full-route loader failure.

Why that is the leading hypothesis:

- the route-level shell can stay alive while the body subtree fails
- the viewport still contains one synchronous row-level throw path for malformed
  encrypted DM server input
- one malformed row, attachment group, voice attachment, or poisoned patch can
  still poison the viewport render

## Added Proof Stages

### 1. Server snapshot proof

When enabled, the server now logs:

- `[broken-thread-history] server:snapshot-loaded`

This proves whether the server loaded the thread payload at all, and includes:

- message count
- attachment group count
- total attachment row count
- voice message count
- voice attachment count
- voice signed-url readiness count
- malformed message count
- malformed attachment count
- attachment message-id mismatch count

If this stage is missing for the broken conversation, the failure happened
before the client viewport render.

### 2. Client hydration/state proof

When enabled, the client viewport now logs:

- `[broken-thread-history] client:initial-snapshot`
- `[broken-thread-history] client:history-state`

These prove:

- what the client initially received
- whether the viewport state normalized successfully
- whether the message list survives into renderable timeline items
- whether the live-state store and patch store are already carrying suspicious
  state

If `messageCount > 0` but the log also shows
`client:message-list-dropped-before-render`, the body is being lost between
payload receipt and render output.

### 3. Bad row proof

The row runtime now logs:

- `[broken-thread-history] client:message-row-issue`

This is emitted only for suspicious rows and includes:

- message id
- kind
- invalid seq
- conversation-id mismatch
- patch type mismatch
- attachment guard drops
- missing voice attachment
- missing voice signed URL
- invalid voice variant metadata

This is the main proof seam for:

- bad item in message list
- bad attachment metadata
- bad voice metadata

### 4. Patch-store proof

The patch store now logs:

- `[broken-thread-history] patch:applied`
- `[broken-thread-history] patch:noop`

and exposes a patch summary used by rescue/error logs.

This proves whether the failing conversation has:

- unexpected patch value types
- unusually large patch state
- patch activity immediately before the body dies

This is the main proof seam for patch-store corruption suspicion.

### 5. Render exception proof

The contained thread-body rescue boundary now captures the actual client render
error and logs:

- `[broken-thread-history] rescue:render-error-captured`
- `[broken-thread-history] rescue:fallback-mounted`

These logs include:

- error name
- error message
- component stack
- last thread hydration snapshot
- last client subtree snapshot
- live-state snapshot
- patch summary

This is the main proof seam for confirming a true render-time exception.

## How To Read The Failure

Use this decision order for the broken conversation:

1. If `server:snapshot-loaded` is absent:
   the payload/load path failed before viewport hydration.
2. If `server:snapshot-loaded` is present but `client:initial-snapshot` is not:
   the client never mounted the viewport normally.
3. If both are present and `client:message-row-issue` appears:
   inspect the listed row/message id first.
4. If `patch:applied` or the rescue logs show invalid patch summary:
   inspect patch-store write callers before changing the server payload shape.
5. If `rescue:render-error-captured` appears:
   treat the captured error message and component stack as the primary failure
   source.

## Most Likely Current Root Cause

Before reproducing with the new proof logs, the most likely remaining root
cause is:

- a specific malformed message row causing a render-time exception inside the
  viewport

The main code reason is that the current viewport still contains a synchronous
throw path for malformed encrypted DM row input, while the surrounding route
shell can stay mounted.

That means the most suspicious first bucket is:

- bad payload item in the message list

More specifically:

- malformed encrypted DM row input
- attachment metadata that leaves one row in a bad render shape
- less likely, but still possible: invalid live patch shape applied to a visible
  message

## Narrow Enablement

The diagnostics are intentionally narrow and can be scoped to one conversation.

Client:

- `NEXT_PUBLIC_CHAT_DEBUG_BROKEN_THREAD_HISTORY=1`
- optional:
  `NEXT_PUBLIC_CHAT_DEBUG_BROKEN_THREAD_HISTORY_CONVERSATION_ID=<conversation-id>`

Server:

- `CHAT_DEBUG_BROKEN_THREAD_HISTORY=1`
- optional:
  `CHAT_DEBUG_BROKEN_THREAD_HISTORY_CONVERSATION_ID=<conversation-id>`

Using the conversation id filter is recommended so the logs stay readable.

## Non-Goals

This pass does not:

- redesign the thread runtime
- change payload shape
- change schema
- attempt a broad render refactor

It only makes the failing stage provable.

## Operational Cleanup Path

If one direct conversation is poisoned badly enough that recovery proof and
local rescue are not sufficient, the supported short-term cleanup path is now:

1. open the DM settings
2. use the direct-chat delete confirmation flow
3. let the app retire the current DM for both participants
4. recreate the DM from inbox when needed

Important:

- hide/archive-only behavior is not enough for this poisoned-DM case
- the inbox create-DM flow restores an existing active DM when one still exists
- a full direct-chat delete is what prevents the old conversation id and its
  history from being revived on the next DM open
- create-DM now also performs a narrow snapshot health check before
  auto-restoring an existing DM, so obviously broken conversations are blocked
  from silent revival

See
[poisoned-dm-cleanup.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/poisoned-dm-cleanup.md)
for the explicit distinction between normal hide-from-inbox behavior and
poisoned-DM hard delete.
