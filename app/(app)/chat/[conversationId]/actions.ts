'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  addParticipantsToGroupConversation,
  assertConversationExists,
  assertConversationMembership,
  getConversationForUser,
  getConversationSummaryForUser,
  assertMessageInConversation,
  assertMessageOwnedByUser,
  CHAT_ATTACHMENT_HELP_TEXT,
  CHAT_ATTACHMENT_MAX_SIZE_BYTES,
  editMessage,
  hideConversationForUser,
  isSupportedChatAttachmentType,
  leaveGroupConversation,
  markConversationRead,
  removeParticipantFromGroupConversation,
  softDeleteMessage,
  STARTER_REACTIONS,
  sendMessageWithAttachment,
  sendTextMessage,
  toggleMessageReaction,
  updateConversationIdentity,
  updateConversationNotificationLevel,
  updateConversationTitle,
  type InboxConversationSummarySnapshot,
} from '@/modules/messaging/data/server';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import {
  logControlledUiError,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import { withSpaceParam } from '@/modules/spaces/url';

function readSpaceId(formData: FormData) {
  return String(formData.get('spaceId') ?? '').trim() || null;
}

function readSettingsReturnTarget(formData: FormData) {
  return String(formData.get('returnTo') ?? '').trim() === 'settings-screen'
    ? 'settings-screen'
    : 'settings-overlay';
}

function redirectToInbox(spaceId?: string | null): never {
  redirect(withSpaceParam('/inbox', spaceId));
}

function redirectToChat(
  conversationId: string,
  spaceId?: string | null,
  options?: {
    error?: string | null;
    details?: 'open' | null;
    hash?: string | null;
  },
): never {
  const params = new URLSearchParams();

  if (options?.error?.trim()) {
    params.set('error', options.error.trim());
  }

  if (options?.details === 'open') {
    params.set('details', 'open');
  }

  const baseHref = params.toString()
    ? `/chat/${conversationId}?${params.toString()}`
    : `/chat/${conversationId}`;
  const href = withSpaceParam(baseHref, spaceId);

  redirect(options?.hash ? `${href}${options.hash}` : href);
}

function redirectToChatSettings(
  conversationId: string,
  spaceId?: string | null,
  options?: {
    error?: string | null;
    saved?: boolean;
  },
): never {
  const params = new URLSearchParams();

  if (options?.error?.trim()) {
    params.set('error', options.error.trim());
  }

  if (options?.saved) {
    params.set('saved', '1');
  }

  const baseHref = params.toString()
    ? `/chat/${conversationId}/settings?${params.toString()}`
    : `/chat/${conversationId}/settings`;

  redirect(withSpaceParam(baseHref, spaceId));
}

function getFriendlyChatActionErrorMessage(
  error: unknown,
  fallback: string,
  surface: string,
) {
  const rawMessage = error instanceof Error ? error.message : fallback;

  logControlledUiError({
    fallback,
    rawMessage,
    surface,
  });

  return sanitizeUserFacingErrorMessage({
    fallback,
    language: 'en',
    rawMessage,
  });
}

function redirectWithError(
  conversationId: string,
  message: string,
  spaceId?: string | null,
): never {
  const safeMessage = sanitizeUserFacingErrorMessage({
    fallback: 'Unable to open this chat right now. Please try again.',
    language: 'en',
    rawMessage: message,
  });
  const params = new URLSearchParams({ error: safeMessage });
  redirect(withSpaceParam(`/chat/${conversationId}?${params.toString()}`, spaceId));
}

function redirectWithSettingsError(
  conversationId: string,
  message: string,
  spaceId?: string | null,
  target: 'settings-overlay' | 'settings-screen' = 'settings-overlay',
): never {
  const sanitizedMessage = sanitizeUserFacingErrorMessage({
    fallback: 'Unable to update chat settings right now. Please try again.',
    language: 'en',
    rawMessage: message,
  });

  if (target === 'settings-screen') {
    redirectToChatSettings(conversationId, spaceId, {
      error: sanitizedMessage,
    });
  }

  const params = new URLSearchParams({
    error: sanitizedMessage,
    details: 'open',
  });
  const href = withSpaceParam(`/chat/${conversationId}?${params.toString()}`, spaceId);
  redirect(`${href}#conversation-settings`);
}

function redirectWithSettingsSaved(
  conversationId: string,
  spaceId?: string | null,
  target: 'settings-overlay' | 'settings-screen' = 'settings-overlay',
): never {
  if (target === 'settings-screen') {
    redirectToChatSettings(conversationId, spaceId, {
      saved: true,
    });
  }

  const params = new URLSearchParams({
    saved: '1',
    details: 'open',
  });
  const href = withSpaceParam(`/chat/${conversationId}?${params.toString()}`, spaceId);
  redirect(`${href}#conversation-settings`);
}

type ChatMutationSuccess<T> = {
  data: T;
  ok: true;
};

type ChatMutationFailure = {
  code?: string | null;
  error: string;
  ok: false;
};

type ChatMutationResult<T> = ChatMutationSuccess<T> | ChatMutationFailure;

export type ChatConversationSummaryMutationPayload =
  InboxConversationSummarySnapshot;

export type SendMessageMutationPayload = {
  clientId: string | null;
  conversationId: string;
  lastReadMessageSeq: number | null;
  messageId: string;
  summary: ChatConversationSummaryMutationPayload | null;
  timestamp: string;
};

export type ToggleReactionMutationPayload = {
  conversationId: string;
  emoji: string;
  messageId: string;
  selected: boolean;
};

export type EditMessageMutationPayload = {
  body: string;
  conversationId: string;
  editedAt: string;
  messageId: string;
  summary: ChatConversationSummaryMutationPayload | null;
};

export type MarkConversationReadMutationPayload = {
  conversationId: string;
  lastReadMessageSeq: number | null;
  summary: ChatConversationSummaryMutationPayload | null;
};

function mutationOk<T>(data: T): ChatMutationSuccess<T> {
  return {
    data,
    ok: true,
  };
}

function mutationError(
  fallback: string,
  rawMessage: string,
  surface: string,
  options?: {
    code?: string | null;
  },
): ChatMutationFailure {
  logControlledUiError({
    fallback,
    rawMessage,
    surface,
  });

  return {
    code: options?.code ?? null,
    error: sanitizeUserFacingErrorMessage({
      fallback,
      language: 'en',
      rawMessage,
    }),
    ok: false,
  };
}

export async function sendMessageMutationAction(
  formData: FormData,
): Promise<ChatMutationResult<SendMessageMutationPayload>> {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const clientId = String(formData.get('clientId') ?? '').trim() || undefined;
  const replyToMessageId = String(formData.get('replyToMessageId') ?? '').trim();
  const attachmentEntry = formData.get('attachment');
  const attachment =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;

  if (!conversationId) {
    return {
      error: 'Unable to send that message right now.',
      ok: false,
    };
  }

  if (!body && !attachment) {
    return {
      error: 'Write a message or choose a file.',
      ok: false,
    };
  }

  if (attachment && attachment.size > CHAT_ATTACHMENT_MAX_SIZE_BYTES) {
    return {
      error: 'Attachments can be up to 10 MB in this first version.',
      ok: false,
    };
  }

  if (attachment && !isSupportedChatAttachmentType(attachment.type)) {
    return {
      error: CHAT_ATTACHMENT_HELP_TEXT,
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return {
      error: 'Please log in and try again.',
      ok: false,
    };
  }

  const conversationExists = await assertConversationExists(conversationId);

  if (!conversationExists) {
    return {
      error: 'This chat is no longer available.',
      ok: false,
    };
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    return {
      error: 'You can no longer send messages in this chat.',
      ok: false,
    };
  }

  const conversation = await getConversationForUser(conversationId, user.id);

  if (!conversation) {
    return {
      error: 'This chat is no longer available.',
      ok: false,
    };
  }

  if (conversation.kind === 'dm' && body) {
    if (
      !isDmE2eeEnabledForUser(user.id, user.email ?? null, {
        source: 'chat-send-mutation',
      })
    ) {
      return {
        error: 'Encrypted direct messages are not enabled for this account yet.',
        ok: false,
      };
    }

    return {
      error: 'Direct-message text must use the encrypted client path.',
      ok: false,
    };
  }

  if (replyToMessageId) {
    const replyTargetExists = await assertMessageInConversation(
      replyToMessageId,
      conversationId,
    );

    if (!replyTargetExists) {
      return {
        error: 'Reply target is not available in this conversation.',
        ok: false,
      };
    }
  }

  try {
    const messageResult = attachment
      ? await sendMessageWithAttachment({
          body: body || null,
          clientId,
          conversationId,
          file: attachment,
          replyToMessageId: replyToMessageId || null,
          senderId: user.id,
        })
      : await sendTextMessage({
          body,
          clientId,
          conversationId,
          replyToMessageId: replyToMessageId || null,
          senderId: user.id,
        });

    const readResult = await markConversationRead({
      conversationId,
      userId: user.id,
      lastReadMessageSeq: Number.MAX_SAFE_INTEGER,
    });
    const summary = await getConversationSummaryForUser(conversationId, user.id);

    return mutationOk({
      clientId: messageResult.clientId ?? null,
      conversationId,
      lastReadMessageSeq: readResult.lastReadMessageSeq,
      messageId: messageResult.messageId,
      summary,
      timestamp: messageResult.timestamp,
    });
  } catch (error) {
    return mutationError(
      'Unable to send that message right now.',
      error instanceof Error ? error.message : 'Unable to send that message right now.',
      'chat:send-message-mutation',
    );
  }
}

export async function toggleReactionMutationAction(
  formData: FormData,
): Promise<ChatMutationResult<ToggleReactionMutationPayload>> {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const messageId = String(formData.get('messageId') ?? '').trim();
  const emoji = String(formData.get('emoji') ?? '').trim();

  if (!conversationId || !messageId) {
    return {
      error: 'Unable to update reactions right now.',
      ok: false,
    };
  }

  if (!STARTER_REACTIONS.includes(emoji as (typeof STARTER_REACTIONS)[number])) {
    return {
      error: 'Invalid reaction.',
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return {
      error: 'Please log in and try again.',
      ok: false,
    };
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    return {
      error: 'This chat is no longer available.',
      ok: false,
    };
  }

  const messageExists = await assertMessageInConversation(messageId, conversationId);

  if (!messageExists) {
    return {
      error: 'This message is no longer available.',
      ok: false,
    };
  }

  try {
    const reactionResult = await toggleMessageReaction({
      emoji,
      messageId,
      userId: user.id,
    });

    return mutationOk({
      conversationId,
      emoji,
      messageId,
      selected: reactionResult.selected,
    });
  } catch (error) {
    return mutationError(
      'Unable to update reactions right now.',
      error instanceof Error ? error.message : 'Unable to update reactions right now.',
      'chat:toggle-reaction-mutation',
    );
  }
}

export async function editMessageMutationAction(
  formData: FormData,
): Promise<ChatMutationResult<EditMessageMutationPayload>> {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const messageId = String(formData.get('messageId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!conversationId || !messageId) {
    return {
      error: 'Choose a message to edit.',
      ok: false,
    };
  }

  if (!body) {
    return {
      error: 'Edited message cannot be empty.',
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return {
      error: 'Please log in and try again.',
      ok: false,
    };
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    return {
      error: 'This chat is no longer available.',
      ok: false,
    };
  }

  const isOwner = await assertMessageOwnedByUser(messageId, conversationId, user.id);

  if (!isOwner) {
    return {
      error: 'Only the sender can edit this message.',
      ok: false,
    };
  }

  const messageMetadata = await supabase
    .from('messages')
    .select('content_mode, deleted_at')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('sender_id', user.id)
    .maybeSingle();

  if (messageMetadata.error) {
    return {
      error: 'Unable to load this message right now.',
      ok: false,
    };
  }

  if (messageMetadata.data?.deleted_at) {
    return {
      error: 'This message is no longer available.',
      ok: false,
    };
  }

  if (messageMetadata.data?.content_mode === 'dm_e2ee_v1') {
    return {
      error: 'Editing encrypted direct messages is not available yet.',
      ok: false,
    };
  }

  try {
    const editResult = await editMessage({
      body,
      conversationId,
      messageId,
      senderId: user.id,
    });
    const summary = await getConversationSummaryForUser(conversationId, user.id);

    return mutationOk({
      body: editResult.body,
      conversationId,
      editedAt: editResult.editedAt,
      messageId,
      summary,
    });
  } catch (error) {
    return mutationError(
      'Unable to save that edit right now.',
      error instanceof Error ? error.message : 'Unable to save that edit right now.',
      'chat:edit-message-mutation',
    );
  }
}

export async function markConversationReadMutationAction(input: {
  conversationId: string;
  latestVisibleMessageSeq: number;
}): Promise<ChatMutationResult<MarkConversationReadMutationPayload>> {
  if (!input.conversationId || !Number.isFinite(input.latestVisibleMessageSeq)) {
    return {
      error: 'Unable to update read state right now.',
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return {
      error: 'Please log in and try again.',
      ok: false,
    };
  }

  const isMember = await assertConversationMembership(input.conversationId, user.id);

  if (!isMember) {
    return {
      error: 'This chat is no longer available.',
      ok: false,
    };
  }

  try {
    const readResult = await markConversationRead({
      conversationId: input.conversationId,
      lastReadMessageSeq: input.latestVisibleMessageSeq,
      userId: user.id,
    });
    const summary = await getConversationSummaryForUser(
      input.conversationId,
      user.id,
    );

    return mutationOk({
      conversationId: input.conversationId,
      lastReadMessageSeq: readResult.lastReadMessageSeq,
      summary,
    });
  } catch (error) {
    return mutationError(
      'Unable to update read state right now.',
      error instanceof Error ? error.message : 'Unable to update read state right now.',
      'chat:mark-read-mutation',
    );
  }
}

export async function sendMessageAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const body = String(formData.get('body') ?? '').trim();
  const replyToMessageId = String(formData.get('replyToMessageId') ?? '').trim();
  const attachmentEntry = formData.get('attachment');
  const attachment =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  if (!body && !attachment) {
    redirectWithError(conversationId, 'Write a message or choose a file.', spaceId);
  }

  if (attachment && attachment.size > CHAT_ATTACHMENT_MAX_SIZE_BYTES) {
    redirectWithError(
      conversationId,
      'Attachments can be up to 10 MB in this first version.',
      spaceId,
    );
  }

  if (attachment && !isSupportedChatAttachmentType(attachment.type)) {
    redirectWithError(conversationId, CHAT_ATTACHMENT_HELP_TEXT, spaceId);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithError(conversationId, 'Please log in and try again.', spaceId);
  }

  if (!user.id) {
    redirectWithError(conversationId, 'Please log in and try again.', spaceId);
  }

  const userId = user.id;

  const conversationExists = await assertConversationExists(conversationId);

  if (!conversationExists) {
    redirectWithError(conversationId, 'This chat is no longer available.', spaceId);
  }

  const isMember = await assertConversationMembership(conversationId, userId);

  if (!isMember) {
    redirectWithError(conversationId, 'You can no longer send messages in this chat.', spaceId);
  }

  const conversation = await getConversationForUser(conversationId, userId, {
    spaceId,
  });

  if (!conversation) {
    redirectWithError(conversationId, 'This chat is no longer available.', spaceId);
  }

  if (conversation.kind === 'dm' && body) {
    if (
      !isDmE2eeEnabledForUser(userId, user.email ?? null, {
        source: 'chat-send-action',
      })
    ) {
      redirectWithError(
        conversationId,
        'Encrypted direct messages are not enabled for this account yet.',
        spaceId,
      );
    }

    redirectWithError(
      conversationId,
      'Direct-message text must use the encrypted client path.',
      spaceId,
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
        spaceId,
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

    // Sending your own message should also advance your read position.
    await markConversationRead({
      conversationId,
      userId,
      lastReadMessageSeq: Number.MAX_SAFE_INTEGER,
    });
  } catch (error) {
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to send that message right now.',
      'chat:send-message',
    );

    redirectWithError(conversationId, message, spaceId);
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  redirectToChat(conversationId, spaceId);
}

export async function toggleReactionAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const messageId = String(formData.get('messageId') ?? '').trim();
  const emoji = String(formData.get('emoji') ?? '').trim();

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  if (!messageId || !emoji || !STARTER_REACTIONS.includes(emoji as (typeof STARTER_REACTIONS)[number])) {
    redirectWithError(conversationId, 'Invalid reaction.', spaceId);
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
    redirectToInbox(spaceId);
  }

  const messageExists = await assertMessageInConversation(messageId, conversationId);

  if (!messageExists) {
    redirectToInbox(spaceId);
  }

  try {
    await toggleMessageReaction({
      messageId,
      userId: user.id,
      emoji,
    });
  } catch (error) {
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to update reactions right now.',
      'chat:toggle-reaction',
    );

    redirectWithError(conversationId, message, spaceId);
  }

  revalidatePath(`/chat/${conversationId}`);
  redirectToChat(conversationId, spaceId, {
    hash: `#message-${messageId}`,
  });
}

export async function editMessageAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const messageId = String(formData.get('messageId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  if (!messageId) {
    redirectWithError(conversationId, 'Choose a message to edit.', spaceId);
  }

  if (!body) {
    redirectWithError(conversationId, 'Edited message cannot be empty.', spaceId);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithError(conversationId, 'Please log in and try again.', spaceId);
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirectToInbox(spaceId);
  }

  const isOwner = await assertMessageOwnedByUser(messageId, conversationId, user.id);

  if (!isOwner) {
    redirectWithError(
      conversationId,
      'Only the sender can edit this message.',
    );
  }

  const messageMetadata = await supabase
    .from('messages')
    .select('content_mode, deleted_at')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('sender_id', user.id)
    .maybeSingle();

  if (messageMetadata.error) {
    redirectWithError(conversationId, 'Unable to load this message right now.', spaceId);
  }

  if (messageMetadata.data?.deleted_at) {
    redirectWithError(conversationId, 'This message is no longer available.', spaceId);
  }

  if (messageMetadata.data?.content_mode === 'dm_e2ee_v1') {
    redirectWithError(
      conversationId,
      'Editing encrypted direct messages is not available yet.',
      spaceId,
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
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to save that edit right now.',
      'chat:edit-message',
    );

    redirectWithError(conversationId, message, spaceId);
  }

  revalidatePath(`/chat/${conversationId}`);
  redirectToChat(conversationId, spaceId);
}

export async function deleteMessageAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const messageId = String(formData.get('messageId') ?? '').trim();
  const confirmed = String(formData.get('confirmDelete') ?? '').trim();

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  if (!messageId) {
    redirectWithError(conversationId, 'Choose a message to delete.', spaceId);
  }

  if (confirmed !== 'true') {
    redirectWithError(conversationId, 'Confirm deletion before removing a message.', spaceId);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithError(conversationId, 'Please log in and try again.', spaceId);
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirectToInbox(spaceId);
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
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to delete that message right now.',
      'chat:delete-message',
    );

    redirectWithError(conversationId, message, spaceId);
  }

  revalidatePath(`/chat/${conversationId}`);
  redirectToChat(conversationId, spaceId);
}

export async function updateConversationTitleAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const settingsReturnTarget = readSettingsReturnTarget(formData);
  const title = String(formData.get('title') ?? '').trim();

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  if (!title) {
    redirectWithSettingsError(
      conversationId,
      'Group title cannot be empty.',
      spaceId,
      settingsReturnTarget,
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithSettingsError(
      conversationId,
      'Please log in and try again.',
      spaceId,
      settingsReturnTarget,
    );
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirectToInbox(spaceId);
  }

  try {
    await updateConversationTitle({
      conversationId,
      userId: user.id,
      title,
    });
  } catch (error) {
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to update this group right now.',
      'chat:update-title',
    );

    redirectWithSettingsError(
      conversationId,
      message,
      spaceId,
      settingsReturnTarget,
    );
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat/${conversationId}/settings`);
  redirectWithSettingsSaved(conversationId, spaceId, settingsReturnTarget);
}

export async function updateConversationIdentityAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const settingsReturnTarget = readSettingsReturnTarget(formData);
  const title = String(formData.get('title') ?? '').trim();
  const removeAvatar = String(formData.get('removeAvatar') ?? '').trim() === '1';
  const avatarEntry = formData.get('avatar');
  const avatarFile =
    avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  if (!title) {
    redirectWithSettingsError(
      conversationId,
      'Group title cannot be empty.',
      spaceId,
      settingsReturnTarget,
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithSettingsError(
      conversationId,
      'Please log in and try again.',
      spaceId,
      settingsReturnTarget,
    );
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirectToInbox(spaceId);
  }

  try {
    await updateConversationIdentity({
      conversationId,
      userId: user.id,
      title,
      avatarFile,
      removeAvatar,
    });
  } catch (error) {
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to update chat settings right now.',
      'chat:update-identity',
    );

    redirectWithSettingsError(
      conversationId,
      message,
      spaceId,
      settingsReturnTarget,
    );
  }

  revalidatePath('/inbox');
  revalidatePath('/activity');
  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat/${conversationId}/settings`);
  redirectWithSettingsSaved(conversationId, spaceId, settingsReturnTarget);
}

export async function hideConversationAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const settingsReturnTarget = readSettingsReturnTarget(formData);

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect('/login');
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirectToInbox(spaceId);
  }

  try {
    await hideConversationForUser({
      conversationId,
      userId: user.id,
    });
  } catch (error) {
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to hide this chat right now.',
      'chat:hide-conversation',
    );

    redirectWithSettingsError(
      conversationId,
      message,
      spaceId,
      settingsReturnTarget,
    );
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat/${conversationId}/settings`);
  redirectToInbox(spaceId);
}

export async function deleteDirectConversationAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const settingsReturnTarget = readSettingsReturnTarget(formData);
  const confirmationMode = String(formData.get('confirmationMode') ?? '').trim();
  const confirmationText = String(formData.get('confirmationText') ?? '').trim();

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  if (confirmationMode === 'typed-delete-ru' && confirmationText !== 'Удалить') {
    redirectWithSettingsError(
      conversationId,
      'Type "Удалить" to confirm deleting this chat from your side.',
      spaceId,
      settingsReturnTarget,
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect('/login');
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirectToInbox(spaceId);
  }

  try {
    await hideConversationForUser({
      conversationId,
      userId: user.id,
    });
  } catch (error) {
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to remove this chat from your inbox right now.',
      'chat:delete-direct-conversation',
    );

    redirectWithSettingsError(
      conversationId,
      message,
      spaceId,
      settingsReturnTarget,
    );
  }

  revalidatePath('/inbox');
  revalidatePath('/activity');
  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat/${conversationId}/settings`);
  redirectToInbox(spaceId);
}

export async function updateConversationNotificationLevelAction(
  formData: FormData,
) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const settingsReturnTarget = readSettingsReturnTarget(formData);
  const notificationLevel = String(
    formData.get('notificationLevel') ?? '',
  ).trim();

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  if (notificationLevel !== 'default' && notificationLevel !== 'muted') {
    redirectWithSettingsError(
      conversationId,
      'Choose a valid notification setting.',
      spaceId,
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect('/login');
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirectToInbox(spaceId);
  }

  try {
    await updateConversationNotificationLevel({
      conversationId,
      userId: user.id,
      notificationLevel,
    });
  } catch (error) {
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to update notification settings right now.',
      'chat:update-notifications',
    );

    redirectWithSettingsError(
      conversationId,
      message,
      spaceId,
      settingsReturnTarget,
    );
  }

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat/${conversationId}/settings`);
  redirectWithSettingsSaved(conversationId, spaceId, settingsReturnTarget);
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
  const spaceId = readSpaceId(formData);
  const settingsReturnTarget = readSettingsReturnTarget(formData);
  const participantUserIds = formData
    .getAll('participantUserIds')
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithSettingsError(conversationId, 'Please log in and try again.', spaceId);
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirectToInbox(spaceId);
  }

  try {
    await addParticipantsToGroupConversation({
      conversationId,
      ownerUserId: user.id,
      participantUserIds,
    });
  } catch (error) {
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to add people right now.',
      'chat:add-participants',
    );

    redirectWithSettingsError(
      conversationId,
      message,
      spaceId,
      settingsReturnTarget,
    );
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat/${conversationId}/settings`);
  redirectWithSettingsSaved(conversationId, spaceId, settingsReturnTarget);
}

export async function removeGroupParticipantAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const settingsReturnTarget = readSettingsReturnTarget(formData);
  const targetUserId = String(formData.get('targetUserId') ?? '').trim();

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithSettingsError(conversationId, 'Please log in and try again.', spaceId);
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirectToInbox(spaceId);
  }

  try {
    await removeParticipantFromGroupConversation({
      conversationId,
      ownerUserId: user.id,
      targetUserId,
    });
  } catch (error) {
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to remove that person right now.',
      'chat:remove-participant',
    );

    redirectWithSettingsError(
      conversationId,
      message,
      spaceId,
      settingsReturnTarget,
    );
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat/${conversationId}/settings`);
  redirectWithSettingsSaved(conversationId, spaceId, settingsReturnTarget);
}

export async function leaveGroupAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const spaceId = readSpaceId(formData);
  const settingsReturnTarget = readSettingsReturnTarget(formData);

  if (!conversationId) {
    redirectToInbox(spaceId);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithSettingsError(conversationId, 'Please log in and try again.', spaceId);
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirectToInbox(spaceId);
  }

  try {
    await leaveGroupConversation({
      conversationId,
      userId: user.id,
    });
  } catch (error) {
    const message = getFriendlyChatActionErrorMessage(
      error,
      'Unable to leave this group right now.',
      'chat:leave-group',
    );

    redirectWithSettingsError(
      conversationId,
      message,
      spaceId,
      settingsReturnTarget,
    );
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat/${conversationId}/settings`);
  redirectToInbox(spaceId);
}
