# Poisoned DM Cleanup

## Purpose

This note defines the operational difference between hiding a direct message and
truly retiring a poisoned one.

Use it when one DM is broken enough that the local rescue boundary is not a
practical long-term fix and the team needs a clean replacement conversation.

## Hide vs Hard Delete

### Hide from inbox

`hideConversationForUser(...)` is the normal product path.

What it does:

- sets `conversation_members.hidden_at` for the current user
- removes the chat from that user's inbox view
- keeps the conversation id, messages, and attachments intact

What it does **not** do:

- it does not delete the direct conversation
- it does not remove message/media metadata
- it does not prevent `createDmAction(...)` from restoring the same DM later

Use hide when:

- the chat is healthy
- the user only wants it out of the inbox
- reopening the same conversation later is acceptable

### Hard delete for poisoned DM recovery

`deleteDirectConversationForUser(...)` is the explicit operational cleanup path.

What it does:

- removes the DM conversation row
- removes conversation members
- removes messages
- removes reactions
- removes E2EE envelope rows
- removes attachment rows
- removes `message_asset_links`
- removes `message_assets`
- removes related storage objects where present

Use hard delete when:

- the direct chat is poisoned or broken enough to keep reviving bad runtime
  state
- the team wants a truly clean replacement DM
- restoring the old conversation id would be harmful

## Recreate Semantics

`createDmAction(...)` first asks `findExistingActiveDmConversation(...)` whether
an active DM already exists.

That means:

- after **hide only**, creating a DM with the same participant can restore the
  old conversation
- after **hard delete**, creating a DM with the same participant creates a new
  clean conversation instead

This distinction is intentional.

## Recommended Recovery Flow

1. Open the poisoned direct chat settings.
2. Use `Hide from inbox` only if the goal is ordinary inbox cleanup.
3. Use the explicit typed hard-delete confirmation only if the goal is poisoned
   DM retirement.
4. Recreate the DM from inbox after the hard delete completes.

Expected result:

- the old poisoned conversation does not reopen
- the recreated DM gets a fresh conversation id
- the new thread starts without the old poisoned runtime baggage
