# Chat Critical Paths

## Purpose

This document maps the actual runtime paths in this repo for the highest-value messaging actions. It is meant to support narrow hardening branches, not architecture redesign.

## Path Map

### 1. Create DM

UI entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/new-chat-sheet.tsx`

Server action:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/actions.ts#createDmAction`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#findExistingActiveDmConversation`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#createConversationWithMembers`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#restoreConversationForUser`

Failure-prone surfaces:

- duplicate taps and duplicate DM uniqueness races
- active-space mismatch or missing `space_id`
- conversations insert succeeds but member insert fails, requiring cleanup
- redirect-based success path makes slow completion feel inert if no pending UI is visible

### 2. Create Group In Current Space

UI entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/new-chat-sheet.tsx`

Server action:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/actions.ts#createGroupAction`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#createConversationWithMembers`

Policy layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/group-policy.ts`

Failure-prone surfaces:

- no immediate feedback while server action creates conversation and member rows
- missing active space blocks create entirely
- partial failure cleanup if conversation row exists before membership insert fails

### 3. Governed Space Creation And Governed Member Seeding

UI entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/spaces/new/page.tsx`

Server action:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/spaces/actions.ts#createSpaceAction`

Write layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/spaces/write-server.ts#createGovernedSpace`

Related member expansion:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/spaces/actions.ts#addSpaceMembersAction`
- `/Users/danya/IOS - Apps/CHAT/src/modules/spaces/write-server.ts#addMembersToGovernedSpace`

Failure-prone surfaces:

- service-role dependency
- email/user-id resolution for admins and participants
- space row create followed by `space_members` insert
- partial cleanup if membership insert fails after space creation

### 4. Send Plaintext Message

Client entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-composer-runtime.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/plaintext-chat-composer-form.tsx`

Queue/runtime:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/use-conversation-outgoing-queue.ts`

Server action:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts#sendMessageMutationAction`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#sendTextMessage`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#createMessageRecord`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#markConversationRead`

Realtime/update follow-up:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/live-refresh.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/thread-history-sync-events.ts`

Failure-prone surfaces:

- in-memory queue only
- message commit, summary projection, read-state update, and push fanout happen on the same path
- client may show optimistic state before live refresh catches up

### 5. Send Plaintext Attachment, Photo, File, Or Voice

Client entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/composer-attachment-picker.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/plaintext-chat-composer-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/composer-voice-draft-panel.tsx`

Server action:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts#sendMessageMutationAction`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#sendMessageWithAttachment`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#insertCommittedMessageAssetAndLink`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#createMessageRecord`

Storage/contracts:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/media/message-assets.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/media/upload-jobs.ts`

Failure-prone surfaces:

- multi-step write chain
- storage upload and DB asset/link writes are not one transaction
- cleanup is best-effort after failure
- exactly the kind of path that produces “tap did nothing for 1–2 seconds” unless pending state is strong

### 6. Send Encrypted DM Text

Client entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx`

Client prerequisites:

- local device lookup and refresh
- recipient bundle fetch
- prekey encryption

API route:

- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/dm-e2ee/send/route.ts`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#sendEncryptedDmTextMessage`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#commitEncryptedDmMessageShell`

Failure-prone surfaces:

- device staleness
- recipient availability
- bundle soft-failure cooldown
- encryption success but send API failure
- optimistic message needs follow-up sync to become committed

### 7. Send Encrypted DM Text Plus Attachment

Client entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx`

API route:

- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/dm-e2ee/send/route.ts`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#sendEncryptedDmMessageWithAttachment`

Failure-prone surfaces:

- combines E2EE device/bundle/encryption requirements with attachment upload/finalization
- cleanup must remove both uploaded object and committed message shell on failure
- slower than plaintext attachment send, so immediate client acknowledgment is even more important

### 8. Add Members To Group

UI entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/page.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/settings/page.tsx`

Server action:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts#addGroupParticipantsAction`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#addParticipantsToGroupConversation`

Policy layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/group-policy.ts`

Failure-prone surfaces:

- join policy and role checks
- reactivation vs insert split
- no durable optimistic state, so slower updates can feel like no-op

### 9. Remove Member / Leave Group

Server action:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts#removeGroupParticipantAction`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts#leaveGroupAction`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#removeParticipantFromGroupConversation`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#leaveGroupConversation`

Failure-prone surfaces:

- owner/admin role transitions
- owner leave flow promotes next owner before leave
- multiple writes can fail independently

### 10. Update Profile Name And Avatar

UI entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/profile-settings-form.tsx`

Server action:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/actions.ts#updateProfileAction`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#updateCurrentUserProfile`

Supporting profile storage contract:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/profile-avatar.ts`

Failure-prone surfaces:

- local cropper draft and object URL lifecycle
- storage upload followed by profile row write
- old avatar cleanup only after successful new write

### 11. Update Group Title, Avatar, And Join Policy

UI entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/group-chat-settings-form.tsx`

Server action:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts#updateConversationIdentityAction`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#updateConversationIdentity`

Failure-prone surfaces:

- service-role storage dependency for avatar upload
- join-policy schema compatibility branches
- title/avatar/join-policy mixed in one save surface

### 12. Toggle Reactions

UI entry:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-reaction-picker.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-reaction-groups.tsx`

Server action:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts#toggleReactionMutationAction`

Data layer:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#toggleMessageReaction`

Failure-prone surfaces:

- comparatively simple write path
- main risk is live-state drift between server result, thread patching, and realtime updates

### 13. Inbox, Chat, And Settings Loading

Pages:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/page.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/page.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/page.tsx`

Supporting loaders:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#getInboxConversations`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#getInboxConversationsStable`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#getConversationHistorySnapshot`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/inbox-ssr-stability.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/spaces/server.ts`

Failure-prone surfaces:

- active-space resolution
- schema cache fallbacks
- stable-vs-precise inbox loading split
- large SSR fetch surfaces that can make navigation feel stalled

### 14. Realtime Reconnect Behavior

Client runtime:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/inbox-sync.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/active-chat-sync.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/live-refresh.ts`

Failure-prone surfaces:

- subscribe timeout / channel error
- refresh cooldown suppressing recovery
- hidden-tab visibility thresholds
- local optimistic commit and router refresh not converging quickly enough

### 15. Push Registration Lifecycle

Client runtime:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/sdk/notifications.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/notification-readiness.tsx`

API routes:

- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/push-config/route.ts`
- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/push-subscriptions/route.ts`

Server fanout:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/server.ts`

Failure-prone surfaces:

- worker registration
- permission state drift
- subscription persistence
- presence update
- preview-mode handling
- delivery suppression rules that can look like silent failure without metrics

## Current Stability Reading

Most of the repo’s real risk is not in schema shape anymore. It is in action-path completion:

- many core actions are already implemented
- several of them are multi-step and non-transactional by nature
- some paths already contain duplicate-submit or fallback logic, which is good
- the current weak spot is consistent immediate acknowledgment plus clear convergence from optimistic state to committed state

That means stability work should stay focused on:

- action entry
- pending state
- retry safety
- recovery after reconnect or late refresh
- stage-specific diagnostics

It should not expand into feature work.
