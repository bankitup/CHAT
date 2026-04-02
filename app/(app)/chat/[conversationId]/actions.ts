'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  addParticipantsToGroupConversation,
  assertConversationExists,
  assertConversationMembership,
  assertMessageInConversation,
  assertMessageOwnedByUser,
  CHAT_ATTACHMENT_HELP_TEXT,
  CHAT_ATTACHMENT_MAX_SIZE_BYTES,
  editMessage,
  isSupportedChatAttachmentType,
  leaveGroupConversation,
  markConversationRead,
  removeParticipantFromGroupConversation,
  softDeleteMessage,
  STARTER_REACTIONS,
  sendMessageWithAttachment,
  sendTextMessage,
  toggleMessageReaction,
  updateConversationTitle,
} from '@/modules/messaging/data/server';

function redirectWithError(conversationId: string, message: string): never {
  const params = new URLSearchParams({ error: message });
  redirect(`/chat/${conversationId}?${params.toString()}`);
}

export async function sendMessageAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const replyToMessageId = String(formData.get('replyToMessageId') ?? '').trim();
  const attachmentEntry = formData.get('attachment');
  const attachment =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;

  if (!conversationId) {
    redirect('/inbox');
  }

  if (!body && !attachment) {
    redirectWithError(conversationId, 'Write a message or choose a file.');
  }

  if (attachment && attachment.size > CHAT_ATTACHMENT_MAX_SIZE_BYTES) {
    redirectWithError(
      conversationId,
      'Attachments can be up to 10 MB in this first version.',
    );
  }

  if (attachment && !isSupportedChatAttachmentType(attachment.type)) {
    redirectWithError(conversationId, CHAT_ATTACHMENT_HELP_TEXT);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithError(
      conversationId,
      'Message sending debug: no authenticated user found.',
    );
  }

  if (!user.id) {
    redirectWithError(
      conversationId,
      'Message sending debug: authenticated user is missing an ID.',
    );
  }

  const userId = user.id;

  const conversationExists = await assertConversationExists(conversationId);

  if (!conversationExists) {
    redirectWithError(
      conversationId,
      'Message sending debug: conversation does not exist or is not readable.',
    );
  }

  const isMember = await assertConversationMembership(conversationId, userId);

  if (!isMember) {
    redirectWithError(
      conversationId,
      'Message sending debug: authenticated user is not an active member of this conversation.',
    );
  }

  if (replyToMessageId) {
    const replyTargetExists = await assertMessageInConversation(
      replyToMessageId,
      conversationId,
    );

    if (!replyTargetExists) {
      redirectWithError(
        conversationId,
        'Reply target is not available in this conversation.',
      );
    }
  }

  try {
    if (attachment) {
      await sendMessageWithAttachment({
        conversationId,
        body: body || null,
        senderId: userId,
        replyToMessageId: replyToMessageId || null,
        file: attachment,
      });
    } else {
      await sendTextMessage({
        conversationId,
        body,
        senderId: userId,
        replyToMessageId: replyToMessageId || null,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to send message.';

    redirectWithError(conversationId, message);
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  redirect(`/chat/${conversationId}`);
}

export async function toggleReactionAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const messageId = String(formData.get('messageId') ?? '').trim();
  const emoji = String(formData.get('emoji') ?? '').trim();

  if (!conversationId) {
    redirect('/inbox');
  }

  if (!messageId || !emoji || !STARTER_REACTIONS.includes(emoji as (typeof STARTER_REACTIONS)[number])) {
    redirectWithError(conversationId, 'Invalid reaction.');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirect('/inbox');
  }

  const messageExists = await assertMessageInConversation(messageId, conversationId);

  if (!messageExists) {
    redirect('/inbox');
  }

  try {
    await toggleMessageReaction({
      messageId,
      userId: user.id,
      emoji,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update reaction.';

    redirectWithError(conversationId, message);
  }

  revalidatePath(`/chat/${conversationId}`);
  redirect(`/chat/${conversationId}`);
}

export async function editMessageAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const messageId = String(formData.get('messageId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!conversationId) {
    redirect('/inbox');
  }

  if (!messageId) {
    redirectWithError(conversationId, 'Choose a message to edit.');
  }

  if (!body) {
    redirectWithError(conversationId, 'Edited message cannot be empty.');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithError(conversationId, 'Message edit debug: no authenticated user found.');
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirect('/inbox');
  }

  const isOwner = await assertMessageOwnedByUser(messageId, conversationId, user.id);

  if (!isOwner) {
    redirectWithError(
      conversationId,
      'Only the sender can edit this message.',
    );
  }

  try {
    await editMessage({
      messageId,
      conversationId,
      senderId: user.id,
      body,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to edit message.';

    redirectWithError(conversationId, message);
  }

  revalidatePath(`/chat/${conversationId}`);
  redirect(`/chat/${conversationId}`);
}

export async function deleteMessageAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const messageId = String(formData.get('messageId') ?? '').trim();
  const confirmed = String(formData.get('confirmDelete') ?? '').trim();

  if (!conversationId) {
    redirect('/inbox');
  }

  if (!messageId) {
    redirectWithError(conversationId, 'Choose a message to delete.');
  }

  if (confirmed !== 'true') {
    redirectWithError(conversationId, 'Confirm deletion before removing a message.');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithError(
      conversationId,
      'Message delete debug: no authenticated user found.',
    );
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirect('/inbox');
  }

  const isOwner = await assertMessageOwnedByUser(messageId, conversationId, user.id);

  if (!isOwner) {
    redirectWithError(
      conversationId,
      'Only the sender can delete this message.',
    );
  }

  try {
    await softDeleteMessage({
      messageId,
      conversationId,
      senderId: user.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to delete message.';

    redirectWithError(conversationId, message);
  }

  revalidatePath(`/chat/${conversationId}`);
  redirect(`/chat/${conversationId}`);
}

export async function updateConversationTitleAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();

  if (!conversationId) {
    redirect('/inbox');
  }

  if (!title) {
    redirectWithError(conversationId, 'Group title cannot be empty.');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithError(
      conversationId,
      'Conversation settings debug: no authenticated user found.',
    );
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirect('/inbox');
  }

  try {
    await updateConversationTitle({
      conversationId,
      userId: user.id,
      title,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update group title.';

    redirectWithError(conversationId, message);
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  redirect(`/chat/${conversationId}?settings=open#conversation-settings`);
}

export async function markConversationReadAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const latestVisibleMessageSeq = Number(
    String(formData.get('latestVisibleMessageSeq') ?? '').trim(),
  );

  if (!conversationId || !Number.isFinite(latestVisibleMessageSeq)) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return;
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    return;
  }

  try {
    await markConversationRead({
      conversationId,
      userId: user.id,
      lastReadMessageSeq: latestVisibleMessageSeq,
    });
  } catch (error) {
    console.error(
      'markConversationReadAction failed',
      error instanceof Error ? error.message : error,
    );
    return;
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
}

export async function addGroupParticipantsAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const participantUserIds = formData
    .getAll('participantUserIds')
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!conversationId) {
    redirect('/inbox');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithError(
      conversationId,
      'Group management debug: no authenticated user found.',
    );
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirect('/inbox');
  }

  try {
    await addParticipantsToGroupConversation({
      conversationId,
      ownerUserId: user.id,
      participantUserIds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to add participants.';

    redirectWithError(conversationId, message);
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  redirect(`/chat/${conversationId}?settings=open#conversation-settings`);
}

export async function removeGroupParticipantAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const targetUserId = String(formData.get('targetUserId') ?? '').trim();

  if (!conversationId) {
    redirect('/inbox');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithError(
      conversationId,
      'Group management debug: no authenticated user found.',
    );
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirect('/inbox');
  }

  try {
    await removeParticipantFromGroupConversation({
      conversationId,
      ownerUserId: user.id,
      targetUserId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to remove participant.';

    redirectWithError(conversationId, message);
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  redirect(`/chat/${conversationId}?settings=open#conversation-settings`);
}

export async function leaveGroupAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();

  if (!conversationId) {
    redirect('/inbox');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithError(
      conversationId,
      'Group leave debug: no authenticated user found.',
    );
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirect('/inbox');
  }

  try {
    await leaveGroupConversation({
      conversationId,
      userId: user.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to leave this group.';

    redirectWithError(conversationId, message);
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  redirect('/inbox');
}
