import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  formatMemberCount,
  formatPersonFallbackLabel,
  getLocaleForLanguage,
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getAvailableUsers,
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_ATTACHMENT_HELP_TEXT,
  CHAT_ATTACHMENT_MAX_SIZE_BYTES,
  getConversationDisplayName,
  getDirectMessageDisplayName,
  getCurrentUserDmE2eeEnvelopesForMessages,
  getConversationForUser,
  getConversationMessages,
  getConversationMemberReadStates,
  getConversationParticipants,
  getConversationReadState,
  getMessageAttachments,
  getMessageSenderProfiles,
  getGroupedReactionsForMessages,
  STARTER_REACTIONS,
} from '@/modules/messaging/data/server';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import { ActiveChatRealtimeSync } from '@/modules/messaging/realtime/active-chat-sync';
import {
  resolveV1TestSpaceFallback,
  resolveActiveSpaceForUser,
  isSpaceMembersSchemaCacheErrorMessage,
} from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';
import {
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/messaging/ui/identity';
import { resolvePublicIdentityLabel } from '@/modules/messaging/ui/identity-label';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  addGroupParticipantsAction,
  deleteMessageAction,
  deleteDirectConversationAction,
  editMessageAction,
  hideConversationAction,
  leaveGroupAction,
  removeGroupParticipantAction,
  sendMessageAction,
  toggleReactionAction,
  updateConversationNotificationLevelAction,
} from './actions';
import { AutoGrowTextarea } from './auto-grow-textarea';
import { AutoScrollToLatest } from './auto-scroll-to-latest';
import { ConversationPresenceStatus } from './conversation-presence-status';
import { ConversationPresenceProvider } from './conversation-presence-provider';
import { ComposerTypingTextarea } from './composer-typing-textarea';
import { ComposerKeyboardOffset } from './composer-keyboard-offset';
import { ComposerAttachmentPicker } from './composer-attachment-picker';
import { MarkConversationRead } from './mark-conversation-read';
import { TypingIndicator } from './typing-indicator';
import { EncryptedDmComposerForm } from './encrypted-dm-composer-form';
import { EncryptedDmMessageBody } from './encrypted-dm-message-body';
import { GroupChatSettingsForm } from './group-chat-settings-form';
import { LiveOutgoingMessageStatus } from './live-outgoing-message-status';
import { MessageStatusIndicator } from './message-status-indicator';
import { OptimisticThreadMessages } from './optimistic-thread-messages';
import { GuardedServerActionForm } from '../../guarded-server-action-form';
import { PendingSubmitButton } from '../../pending-submit-button';

type ChatPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    details?: string;
    replyToMessageId?: string;
    editMessageId?: string;
    deleteMessageId?: string;
    actionMessageId?: string;
    settings?: string;
    space?: string;
  }>;
};

function formatMessageTimestamp(value: string | null, language: AppLanguage) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function getCalendarDayKey(value: string | null) {
  if (!value) {
    return 'unknown';
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDaySeparatorLabel(
  value: string | null,
  language: AppLanguage,
  t: ReturnType<typeof getTranslations>,
) {
  if (!value) {
    return t.chat.earlier;
  }

  const targetDate = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const compareDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );

  if (compareDate.getTime() === today.getTime()) {
    return t.chat.today;
  }

  if (compareDate.getTime() === yesterday.getTime()) {
    return t.chat.yesterday;
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    month: 'short',
    day: 'numeric',
    year:
      targetDate.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(targetDate);
}

function formatLongDate(value: string | null, language: AppLanguage, t: ReturnType<typeof getTranslations>) {
  if (!value) {
    return t.chat.unknown;
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getMessageSnippet(
  value: string | null,
  t: ReturnType<typeof getTranslations>,
  maxLength = 90,
) {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return t.chat.emptyMessage;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function formatAttachmentSize(value: number | null) {
  if (!value || Number.isNaN(value)) {
    return null;
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isEditedMessage(value: { edited_at: string | null; deleted_at: string | null }) {
  return Boolean(value.edited_at && !value.deleted_at);
}

function getMessageSeq(value: number | string) {
  return typeof value === 'number' ? value : Number(value);
}

function normalizeComparableMessageSeq(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === 'bigint') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function logMessageStatusDiagnostics(
  stage: string,
  details: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_MESSAGE_STATUS !== '1') {
    return;
  }

  console.info('[message-status]', stage, details);
}

function getOutgoingMessageStatus(input: {
  conversationId: string;
  isOwnMessage: boolean;
  isDeletedMessage: boolean;
  messageId: string;
  messageSeq: unknown;
  otherParticipantReadSeq: unknown;
}) {
  if (!input.isOwnMessage || input.isDeletedMessage) {
    return null;
  }

  const normalizedMessageSeq = normalizeComparableMessageSeq(input.messageSeq);
  const normalizedReadSeq = normalizeComparableMessageSeq(
    input.otherParticipantReadSeq,
  );

  if (normalizedMessageSeq === null) {
    logMessageStatusDiagnostics('fallback:invalid-message-seq', {
      conversationId: input.conversationId,
      messageId: input.messageId,
      rawMessageSeq: input.messageSeq ?? null,
      rawReadSeq: input.otherParticipantReadSeq ?? null,
      resolvedStatus: 'sent',
    });
    return 'sent' as const;
  }

  if (normalizedReadSeq !== null && normalizedReadSeq >= normalizedMessageSeq) {
    return 'seen' as const;
  }

  if (normalizedReadSeq === null && input.otherParticipantReadSeq !== null) {
    logMessageStatusDiagnostics('fallback:invalid-read-seq', {
      conversationId: input.conversationId,
      messageId: input.messageId,
      rawMessageSeq: input.messageSeq ?? null,
      rawReadSeq: input.otherParticipantReadSeq ?? null,
      resolvedStatus: 'sent',
    });
  }

  return 'sent' as const;
}

function isEncryptedDmTextMessage(value: {
  kind: string | null;
  content_mode?: string | null;
  deleted_at?: string | null;
}) {
  return (
    value.kind === 'text' &&
    value.content_mode === 'dm_e2ee_v1' &&
    !value.deleted_at
  );
}

function canRenderEncryptedDmBody(input: {
  clientId: string | null | undefined;
  envelopePresent: boolean;
}) {
  return Boolean(input.clientId?.trim() && input.envelopePresent);
}

function formatGroupMemberSummary(
  participantIds: string[],
  currentUserId: string,
  displayNames: Map<string, string | null>,
  language: AppLanguage,
  t: ReturnType<typeof getTranslations>,
) {
  const fallbackNames = new Map<string, string>();

  const labels = participantIds.map((participantId) => {
    if (participantId === currentUserId) {
      return t.chat.you;
    }

    const displayName = displayNames.get(participantId)?.trim();

    if (displayName) {
      return displayName;
    }

    const existing = fallbackNames.get(participantId);

    if (existing) {
      return existing;
    }

    const nextLabel = formatPersonFallbackLabel(language, fallbackNames.size + 1);
    fallbackNames.set(participantId, nextLabel);

    return nextLabel;
  });

  const otherLabels = labels.filter((label) => label !== t.chat.you);
  const previewNames = otherLabels.slice(0, 2);
  const remainingCount = Math.max(0, otherLabels.length - previewNames.length);
  const memberLabel = formatMemberCount(language, participantIds.length);

  if (previewNames.length === 0) {
    return memberLabel;
  }

  return `${memberLabel} · ${previewNames.join(', ')}${
    remainingCount > 0 ? ` +${remainingCount}` : ''
  }`;
}

function formatParticipantRoleLabel(
  role: string | null,
  t: ReturnType<typeof getTranslations>,
) {
  if (role === 'owner') {
    return t.chat.owner;
  }

  if (role === 'admin') {
    return t.chat.admin;
  }

  return t.chat.member;
}

function buildChatHref(input: {
  conversationId: string;
  spaceId: string;
  actionMessageId?: string | null;
  deleteMessageId?: string | null;
  editMessageId?: string | null;
  error?: string | null;
  saved?: string | null;
  replyToMessageId?: string | null;
  details?: string | null;
  hash?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.actionMessageId?.trim()) {
    params.set('actionMessageId', input.actionMessageId.trim());
  }

  if (input.deleteMessageId?.trim()) {
    params.set('deleteMessageId', input.deleteMessageId.trim());
  }

  if (input.editMessageId?.trim()) {
    params.set('editMessageId', input.editMessageId.trim());
  }

  if (input.error?.trim()) {
    params.set('error', input.error.trim());
  }

  if (input.saved?.trim()) {
    params.set('saved', input.saved.trim());
  }

  if (input.replyToMessageId?.trim()) {
    params.set('replyToMessageId', input.replyToMessageId.trim());
  }

  if (input.details?.trim()) {
    params.set('details', input.details.trim());
  }

  const search = params.toString();
  const baseHref = search
    ? `/chat/${input.conversationId}?${search}`
    : `/chat/${input.conversationId}`;
  const href = withSpaceParam(baseHref, input.spaceId);

  return input.hash ? `${href}${input.hash}` : href;
}

export default async function ChatPage({
  params,
  searchParams,
}: ChatPageProps) {
  const { conversationId } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const languagePromise = getRequestLanguage();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }
  let activeSpaceId: string | null = null;
  let conversation = null as Awaited<ReturnType<typeof getConversationForUser>> | null;
  let isV1TestBypass = false;
  const requestedSpaceId = query.space?.trim() || null;

  if (requestedSpaceId) {
    const explicitV1TestSpace = await resolveV1TestSpaceFallback({
      requestedSpaceId,
      source: 'chat-page-explicit-v1-test-bypass',
    });

    if (explicitV1TestSpace) {
      // Temporary v1 unblocker: bypass fragile space_members SSR path for explicit TEST-space entry.
      // Remove once membership resolution via space_members is stable again.
      activeSpaceId = explicitV1TestSpace.id;
      isV1TestBypass = true;
      conversation = await getConversationForUser(conversationId, user.id, {
        spaceId: activeSpaceId,
      });
    } else {
      conversation = await getConversationForUser(conversationId, user.id, {
        spaceId: requestedSpaceId,
      });

      if (conversation) {
        activeSpaceId = requestedSpaceId;
      }
    }
  }

  if (!conversation || !activeSpaceId) {
    const baseConversation =
      conversation ?? (await getConversationForUser(conversationId, user.id));

    if (!baseConversation) {
      notFound();
    }

    if (!baseConversation.spaceId) {
      throw new Error(
        'Active space routing requires public.conversations.space_id.',
      );
    }

    const fallbackRequestedSpaceId = requestedSpaceId || baseConversation.spaceId;
    const explicitV1TestSpace = await resolveV1TestSpaceFallback({
      requestedSpaceId: fallbackRequestedSpaceId,
      source: 'chat-page-explicit-v1-test-bypass',
    });
    isV1TestBypass = Boolean(explicitV1TestSpace);

    if (explicitV1TestSpace) {
      activeSpaceId = explicitV1TestSpace.id;
    } else {
      let activeSpaceState: Awaited<
        ReturnType<typeof resolveActiveSpaceForUser>
      > | null = null;
      try {
        activeSpaceState = await resolveActiveSpaceForUser({
          userId: user.id,
          requestedSpaceId: fallbackRequestedSpaceId,
          source: 'chat-page',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (isSpaceMembersSchemaCacheErrorMessage(message)) {
          const fallbackSpace = await resolveV1TestSpaceFallback({
            requestedSpaceId: fallbackRequestedSpaceId,
            source: 'chat-page',
          });

          if (!fallbackSpace) {
            redirect('/spaces');
          }

          activeSpaceId = fallbackSpace.id;
        } else {
          throw error;
        }
      }

      if (!activeSpaceId) {
        if (
          !activeSpaceState?.activeSpace ||
          activeSpaceState.requestedSpaceWasInvalid
        ) {
          notFound();
        }

        activeSpaceId = activeSpaceState.activeSpace.id;
      }
    }

    if (!activeSpaceId) {
      redirect('/spaces');
    }

    if (!query.space || query.space !== activeSpaceId) {
      redirect(
        buildChatHref({
          conversationId,
          spaceId: activeSpaceId,
          actionMessageId: query.actionMessageId ?? null,
          deleteMessageId: query.deleteMessageId ?? null,
          editMessageId: query.editMessageId ?? null,
          error: query.error ?? null,
          replyToMessageId: query.replyToMessageId ?? null,
          details: query.details ?? query.settings ?? null,
        }),
      );
    }

    conversation = await getConversationForUser(conversationId, user.id, {
      spaceId: activeSpaceId,
    });

    if (!conversation) {
      notFound();
    }
  }

  const language = await languagePromise;
  const t = getTranslations(language);
  const visibleRouteError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'chat'),
        language,
        rawMessage: query.error,
      })
    : null;
  const visibleSettingsError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'chat-settings'),
        language,
        rawMessage: query.error,
      })
    : null;
  const encryptedDmEnabled = isDmE2eeEnabledForUser(
    user.id,
    user.email ?? null,
    {
      source: 'chat-page',
    },
  );

  const isSettingsOpen =
    query.details === 'open' || query.settings === 'open';
  const hasSettingsSavedState = query.saved === '1';
  const [messages, readState, memberReadStates, participants] =
    await Promise.all([
      getConversationMessages(conversationId),
      getConversationReadState(conversationId, user.id),
      getConversationMemberReadStates(conversationId),
      getConversationParticipants(conversationId),
    ]);
  // Temporary v1 unblocker: do not trigger space_members-backed available user lookup in TEST bypass flow.
  const availableUsers =
    conversation.kind === 'group' && isSettingsOpen && !isV1TestBypass
      ? await getAvailableUsers(user.id, { spaceId: activeSpaceId })
      : [];
  const messageIds = messages.map((message) => message.id);
  const encryptedMessageIds = messages
    .filter((message) => isEncryptedDmTextMessage(message))
    .map((message) => message.id);
  const senderProfileIds = Array.from(
    new Set([
      ...messages.map((message) => message.sender_id ?? ''),
      ...participants.map((participant) => participant.userId),
      ...availableUsers.map((availableUser) => availableUser.userId),
    ]),
  );
  const [
    senderProfiles,
    reactionsByMessage,
    attachmentsByMessage,
    e2eeEnvelopesByMessage,
  ] = await Promise.all([
    getMessageSenderProfiles(senderProfileIds),
    getGroupedReactionsForMessages(messageIds, user.id),
    getMessageAttachments(messageIds),
    getCurrentUserDmE2eeEnvelopesForMessages({
      userId: user.id,
      messageIds: encryptedMessageIds,
    }),
  ]);
  if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' && encryptedMessageIds.length > 0) {
    const missingEnvelopeMessageIds = encryptedMessageIds.filter(
      (messageId) => !e2eeEnvelopesByMessage.has(messageId),
    );
    console.info('[dm-e2ee-history]', 'thread:envelope-availability', {
      conversationId,
      currentUserId: user.id,
      encryptedMessageCount: encryptedMessageIds.length,
      envelopeCount: e2eeEnvelopesByMessage.size,
      missingEnvelopeCount: missingEnvelopeMessageIds.length,
      missingEnvelopeMessageIds,
    });
  }
  const senderNames = new Map<string, string>(
    senderProfiles.map((profile) => [
      profile.userId,
      resolvePublicIdentityLabel(profile, t.chat.unknownUser),
    ] as const),
  );
  const senderIdentities = new Map<string, (typeof senderProfiles)[number]>(
    senderProfiles.map((profile) => [profile.userId, profile] as const),
  );
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const otherParticipants = participants.filter(
    (participant) => participant.userId !== user.id,
  );
  const otherParticipantLabels = otherParticipants.map((participant) =>
    resolvePublicIdentityLabel(
      senderIdentities.get(participant.userId),
      t.chat.unknownUser,
    ),
  );
  const directParticipantIdentity = otherParticipants[0]
    ? senderIdentities.get(otherParticipants[0].userId)
    : null;
  const conversationDisplayTitle = getConversationDisplayName({
    kind: conversation.kind === 'group' ? conversation.kind : null,
    title: conversation.title,
    participantLabels:
      conversation.kind === 'group' ? otherParticipantLabels : [],
    fallbackTitles: {
      group: language === 'ru' ? 'Новая группа' : 'New group',
    },
  });
  const directConversationDisplayTitle =
    conversation.kind === 'dm'
      ? getDirectMessageDisplayName(otherParticipantLabels, t.chat.unknownUser)
      : conversationDisplayTitle;
  const currentUserDisplayLabel = resolvePublicIdentityLabel(
    senderIdentities.get(user.id),
    t.chat.unknownUser,
  );
  const groupMemberSummary =
    conversation.kind === 'group'
      ? formatGroupMemberSummary(
          participants.map((participant) => participant.userId),
          user.id,
          senderNames,
          language,
          t,
        )
      : null;
  const attachmentHelpText =
    language === 'ru'
      ? 'Поддерживаются JPG, PNG, WEBP, GIF, PDF и TXT до 10 МБ.'
      : CHAT_ATTACHMENT_HELP_TEXT;
  const attachmentMaxSizeLabel = language === 'ru' ? 'До 10 МБ' : 'Up to 10 MB';
  const activeReplyTarget = query.replyToMessageId
    ? messagesById.get(query.replyToMessageId) ?? null
    : null;
  const activeEditMessageId = query.editMessageId?.trim() || null;
  const activeDeleteMessageId = query.deleteMessageId?.trim() || null;
  const activeActionMessageId = query.actionMessageId?.trim() || null;
  const activeActionMessage =
    activeActionMessageId && !activeEditMessageId && !activeDeleteMessageId
      ? messagesById.get(activeActionMessageId) ?? null
      : null;
  const canEditGroupTitle =
    conversation.kind === 'group' && conversation.createdBy === user.id;
  const canManageGroupParticipants =
    conversation.kind === 'group' &&
    participants.some(
      (participant) => participant.userId === user.id && participant.role === 'owner',
    );
  const participantItems = participants.map((participant) => {
    const identity = senderIdentities.get(participant.userId);
    const label = resolvePublicIdentityLabel(identity, t.chat.unknownUser);

    return {
      userId: participant.userId,
      identity,
      label,
      isCurrentUser: participant.userId === user.id,
      role: participant.role ?? 'member',
      roleLabel: formatParticipantRoleLabel(participant.role ?? 'member', t),
    };
  });
  const mentionParticipants =
    conversation.kind === 'group'
      ? participantItems
          .filter((participant) => !participant.isCurrentUser)
          .map((participant) => ({
            userId: participant.userId,
            label: participant.label,
          }))
      : [];
  const activeParticipantUserIds = new Set(participants.map((participant) => participant.userId));
  const availableParticipantsToAdd = availableUsers
    .filter((availableUser) => !activeParticipantUserIds.has(availableUser.userId))
    .map((availableUser) => ({
      ...availableUser,
      label: resolvePublicIdentityLabel(
        senderIdentities.get(availableUser.userId) ?? availableUser,
        t.chat.unknownUser,
      ),
    }));
  const latestVisibleMessageSeq =
    messages.length > 0
      ? getMessageSeq(messages[messages.length - 1]?.seq ?? 0)
      : null;
  const otherParticipantReadState =
    conversation.kind === 'dm'
      ? memberReadStates.find((state) => state.userId !== user.id) ?? null
      : null;
  const otherParticipantUserId =
    conversation.kind === 'dm' ? otherParticipants[0]?.userId ?? null : null;
  const activeActionMessageSenderLabel = activeActionMessage
    ? senderNames.get(activeActionMessage.sender_id ?? '') || t.chat.unknownUser
    : null;
  const activeActionMessageIsOwn =
    activeActionMessage?.sender_id === user.id && !activeActionMessage.deleted_at;
  const activeActionReactions = activeActionMessage
    ? reactionsByMessage.get(activeActionMessage.id) ?? []
    : [];
  const timelineItems = messages.flatMap((message, index) => {
    const previousMessage = messages[index - 1];
    const currentDayKey = getCalendarDayKey(message.created_at);
    const previousDayKey = previousMessage
      ? getCalendarDayKey(previousMessage.created_at)
      : null;
    const items: Array<
      | { type: 'separator'; key: string; label: string }
      | { type: 'unread'; key: string; label: string }
      | { type: 'message'; key: string; message: (typeof messages)[number] }
    > = [];

    if (currentDayKey !== previousDayKey) {
      items.push({
        type: 'separator',
        key: `day-${currentDayKey}-${message.id}`,
        label: formatDaySeparatorLabel(message.created_at, language, t),
      });
    }

    const messageSeq = getMessageSeq(message.seq);
    const previousSeq = previousMessage
      ? getMessageSeq(previousMessage.seq)
      : null;
    const hasUnreadBoundary =
      readState.lastReadMessageSeq !== null &&
      Number.isFinite(messageSeq) &&
      messageSeq > readState.lastReadMessageSeq &&
      (previousSeq === null || previousSeq <= readState.lastReadMessageSeq);

    if (hasUnreadBoundary) {
      items.push({
        type: 'unread',
        key: `unread-${message.id}`,
        label: t.chat.unreadMessages,
      });
    }

    items.push({
      type: 'message',
      key: message.id,
      message,
    });

    return items;
  });

  return (
    <section className="stack chat-screen">
      <ActiveChatRealtimeSync
        conversationId={conversationId}
        messageIds={messages.map((message) => message.id)}
      />
      <ComposerKeyboardOffset />

      <section className="stack chat-header-stack" id="chat-header-shell">
        <Link
          aria-label={t.chat.backToChats}
          className="back-arrow-link conversation-back"
          href={withSpaceParam('/inbox', activeSpaceId)}
          prefetch
        >
          <span aria-hidden="true">←</span>
        </Link>

        <Link
          aria-label={t.chat.openInfoAria(directConversationDisplayTitle)}
          className="card chat-header-card chat-header-link"
          href={buildChatHref({
            conversationId,
            details: 'open',
            spaceId: activeSpaceId,
          })}
        >
          <div className="chat-header-identity">
            {conversation.kind === 'group' ? (
              <GroupIdentityAvatar
                avatarPath={conversation.avatarPath}
                label={directConversationDisplayTitle}
                size="lg"
              />
            ) : (
              <IdentityAvatar
                diagnosticsSurface="chat:header"
                identity={directParticipantIdentity}
                label={directConversationDisplayTitle}
                size="lg"
              />
            )}

            <div className="stack chat-header-copy">
              <h1 className="conversation-screen-title">
                {directConversationDisplayTitle}
              </h1>
              {conversation.kind === 'group' ? (
                <p className="muted chat-member-summary">{groupMemberSummary}</p>
              ) : otherParticipants[0] ? (
                <ConversationPresenceStatus
                  conversationId={conversationId}
                  currentUserId={user.id}
                  language={language}
                  otherUserId={otherParticipants[0].userId}
                />
              ) : null}
            </div>
          </div>
          <span className="chat-header-chevron" aria-hidden="true">
            ›
          </span>
        </Link>
      </section>

      {visibleRouteError && !isSettingsOpen ? (
        <p className="notice notice-error">{visibleRouteError}</p>
      ) : null}

      <section className="chat-main">
        <section className="message-thread" id="message-thread-scroll">
          <AutoScrollToLatest
            bottomSentinelId="message-thread-bottom-sentinel"
            conversationId={conversationId}
            latestVisibleMessageSeq={latestVisibleMessageSeq}
            targetId="message-thread-scroll"
          />
          {messages.length === 0 ? (
            <div className="chat-empty-state" aria-label={t.chat.noMessagesYet}>
              <span className="chat-empty-state-label">{t.chat.noMessagesYet}</span>
            </div>
          ) : otherParticipantUserId ? (
            <ConversationPresenceProvider
              conversationId={conversationId}
              currentUserId={user.id}
              otherUserId={otherParticipantUserId}
            >
              {timelineItems.map((item) => {
                if (item.type === 'separator') {
                  return (
                    <div
                      key={item.key}
                      className="message-day-separator"
                      aria-label={item.label}
                    >
                      <span className="message-day-label">{item.label}</span>
                    </div>
                  );
                }

                if (item.type === 'unread') {
                  return (
                    <div
                      key={item.key}
                      className="message-unread-separator"
                      aria-label={item.label}
                    >
                      <span className="message-unread-label">{item.label}</span>
                    </div>
                  );
                }

                const { message } = item;
                const isOwnMessage = message.sender_id === user.id;
                const isDeletedMessage = Boolean(message.deleted_at);
                const messageSeq = getMessageSeq(message.seq);
                const isLatestConversationMessage =
                  latestVisibleMessageSeq !== null &&
                  Number.isFinite(messageSeq) &&
                  messageSeq === latestVisibleMessageSeq;
                const isMessageInEditMode =
                  activeEditMessageId === message.id &&
                  isOwnMessage &&
                  !isDeletedMessage &&
                  !isEncryptedDmTextMessage(message);
                const isMessageInDeleteMode =
                  activeDeleteMessageId === message.id && isOwnMessage && !isDeletedMessage;
                const messageAttachments = attachmentsByMessage.get(message.id) ?? [];
                const encryptedEnvelope =
                  e2eeEnvelopesByMessage.get(message.id) ?? null;
                const canAttemptEncryptedRender = canRenderEncryptedDmBody({
                  clientId: message.client_id,
                  envelopePresent: Boolean(encryptedEnvelope),
                });
                const otherParticipantReadSeq =
                  otherParticipantReadState?.lastReadMessageSeq ?? null;
                const outgoingMessageStatus = getOutgoingMessageStatus({
                  conversationId,
                  isOwnMessage,
                  isDeletedMessage,
                  messageId: message.id,
                  messageSeq: message.seq,
                  otherParticipantReadSeq:
                    conversation.kind === 'dm' ? otherParticipantReadSeq : null,
                });
                const isMessageActionActive = activeActionMessage?.id === message.id;

                return (
                  <article
                    key={item.key}
                    className={isOwnMessage ? 'message-row message-row-own' : 'message-row'}
                  >
                    <div
                      className={
                        isDeletedMessage
                          ? isOwnMessage
                            ? 'message-card message-card-own message-card-deleted'
                            : 'message-card message-card-deleted'
                          : isOwnMessage
                            ? 'message-card message-card-own'
                            : 'message-card'
                      }
                      id={`message-${message.id}`}
                    >
                      {!isDeletedMessage ? (
                        <div
                          className={
                            isOwnMessage
                              ? 'message-header message-header-own'
                              : 'message-header'
                          }
                        >
                          <div className="message-header-side">
                            {!isDeletedMessage ? (
                              <Link
                                aria-label={t.chat.openMessageActions}
                                className={
                                  isMessageActionActive
                                    ? 'message-actions-trigger message-actions-trigger-active'
                                    : 'message-actions-trigger'
                                }
                                href={buildChatHref({
                                  actionMessageId: message.id,
                                  conversationId,
                                  hash: `#message-${message.id}`,
                                  spaceId: activeSpaceId,
                                })}
                              >
                                <span aria-hidden="true">⋯</span>
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      <div
                        className={
                          isOwnMessage
                            ? 'message-bubble message-bubble-own'
                            : 'message-bubble'
                        }
                      >
                        {message.reply_to_message_id && !isDeletedMessage ? (
                          <div className="message-reply-reference">
                            <span className="message-reply-sender">
                              {(() => {
                                const repliedMessage = messagesById.get(
                                  message.reply_to_message_id,
                                );

                                if (!repliedMessage) {
                                  return t.chat.earlierMessage;
                                }

                                if (repliedMessage.deleted_at) {
                                  return t.chat.deletedMessage;
                                }

                                return (
                                  senderNames.get(repliedMessage.sender_id ?? '') ||
                                  t.chat.unknownUser
                                );
                              })()}
                            </span>
                            <span className="message-reply-snippet">
                              {(() => {
                                const repliedMessage = messagesById.get(
                                  message.reply_to_message_id,
                                );

                                if (repliedMessage?.deleted_at) {
                                  return t.chat.messageDeleted;
                                }

                                if (repliedMessage?.kind === 'voice') {
                                  return t.chat.voiceMessage;
                                }

                                if (repliedMessage && isEncryptedDmTextMessage(repliedMessage)) {
                                  return t.chat.replyToEncryptedMessage;
                                }

                                return getMessageSnippet(
                                  repliedMessage?.body ?? null,
                                  t,
                                  72,
                                );
                              })()}
                            </span>
                          </div>
                        ) : null}
                        {isDeletedMessage ? (
                          <p className="message-deleted-text">{t.chat.messageDeleted}</p>
                        ) : isMessageInEditMode ? (
                          <form action={editMessageAction} className="stack message-edit-form">
                            <input
                              name="conversationId"
                              type="hidden"
                              value={conversationId}
                            />
                            <input name="messageId" type="hidden" value={message.id} />
                            <label className="field">
                              <span className="sr-only">{t.chat.edit}</span>
                              <AutoGrowTextarea
                                className="input textarea"
                                defaultValue={
                                  isEncryptedDmTextMessage(message)
                                    ? ''
                                    : message.body?.trim() ?? ''
                                }
                                maxHeight={160}
                                name="body"
                                required
                                rows={2}
                              />
                            </label>
                            <div className="message-edit-actions">
                              <button className="button button-compact" type="submit">
                                {t.chat.save}
                              </button>
                              <Link
                                className="pill message-edit-cancel"
                                href={buildChatHref({
                                  conversationId,
                                  hash: `#message-${message.id}`,
                                  spaceId: activeSpaceId,
                                })}
                              >
                                {t.chat.cancel}
                              </Link>
                            </div>
                          </form>
                        ) : activeEditMessageId === message.id &&
                          isOwnMessage &&
                          isEncryptedDmTextMessage(message) ? (
                          <div className="message-edit-unavailable">
                            <p className="message-edit-unavailable-copy">
                              {t.chat.encryptedEditUnavailable}
                            </p>
                            <div className="message-edit-actions">
                              <Link
                                className="pill message-edit-cancel"
                                href={buildChatHref({
                                  conversationId,
                                  hash: `#message-${message.id}`,
                                  spaceId: activeSpaceId,
                                })}
                              >
                                {t.chat.cancel}
                              </Link>
                            </div>
                          </div>
                        ) : isEncryptedDmTextMessage(message) ? (
                          canAttemptEncryptedRender ? (
                            <EncryptedDmMessageBody
                              clientId={message.client_id}
                              conversationId={conversationId}
                              currentUserId={user.id}
                              envelope={encryptedEnvelope}
                              fallbackLabel={t.chat.encryptedMessage}
                              refreshSetupLabel={t.chat.refreshEncryptedSetup}
                              reloadConversationLabel={t.chat.reloadConversation}
                              retryLabel={t.chat.retryEncryptedAction}
                              setupUnavailableLabel={t.chat.encryptedMessageSetupUnavailable}
                              unavailableLabel={t.chat.encryptedMessageUnavailable}
                              messageId={message.id}
                              messageCreatedAt={message.created_at}
                              shouldCachePreview={
                                conversation.kind === 'dm' && isLatestConversationMessage
                              }
                            />
                          ) : (
                            <div className="message-encryption-state">
                              <p className="message-body">
                                {t.chat.encryptedMessageUnavailable}
                              </p>
                            </div>
                          )
                        ) : message.body?.trim() ? (
                          <p className="message-body">{message.body.trim()}</p>
                        ) : !messageAttachments.length ? (
                          <p className="message-body">{t.chat.emptyMessage}</p>
                        ) : null}
                        {messageAttachments.length && !isDeletedMessage ? (
                          <div className="message-attachments">
                            {messageAttachments.map((attachment) => {
                              const attachmentContent = (
                                <>
                                  {attachment.isImage && attachment.signedUrl ? (
                                    <span
                                      aria-hidden="true"
                                      className="message-attachment-preview"
                                      style={{
                                        backgroundImage: `url("${attachment.signedUrl}")`,
                                      }}
                                    />
                                  ) : (
                                    <span
                                      aria-hidden="true"
                                      className="message-attachment-file"
                                    >
                                      {attachment.isAudio ? t.chat.audio : t.chat.file}
                                    </span>
                                  )}
                                  <span className="message-attachment-copy">
                                    <span className="message-attachment-name">
                                      {attachment.fileName}
                                    </span>
                                    <span className="message-attachment-meta">
                                      {attachment.isVoiceMessage
                                        ? t.chat.voiceMessage
                                        : attachment.isAudio
                                          ? t.chat.audio
                                          : attachment.isImage
                                            ? t.chat.image
                                            : t.chat.attachment}
                                      {formatAttachmentSize(attachment.sizeBytes)
                                        ? ` · ${formatAttachmentSize(
                                            attachment.sizeBytes,
                                          )}`
                                        : ''}
                                      {!attachment.signedUrl
                                        ? ` · ${t.chat.unavailableRightNow}`
                                        : ''}
                                    </span>
                                  </span>
                                </>
                              );

                              if (!attachment.signedUrl) {
                                return (
                                  <div
                                    key={attachment.id}
                                    className="message-attachment-card message-attachment-card-unavailable"
                                  >
                                    {attachmentContent}
                                  </div>
                                );
                              }

                              if (attachment.isAudio) {
                                return (
                                  <div
                                    key={attachment.id}
                                    className="message-attachment-card message-attachment-card-audio"
                                  >
                                    {attachmentContent}
                                    <audio
                                      className="message-attachment-audio"
                                      controls
                                      preload="metadata"
                                      src={attachment.signedUrl}
                                    />
                                  </div>
                                );
                              }

                              return (
                                <a
                                  key={attachment.id}
                                  className="message-attachment-card"
                                  href={attachment.signedUrl}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {attachmentContent}
                                </a>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={
                          isOwnMessage
                            ? 'message-meta message-meta-own'
                            : 'message-meta'
                        }
                      >
                        <span>{formatMessageTimestamp(message.created_at, language) || t.chat.justNow}</span>
                        {isEditedMessage(message) ? (
                          <span className="message-edited" aria-label={t.chat.edited}>
                            {t.chat.edited}
                          </span>
                        ) : null}
                        {isOwnMessage && outgoingMessageStatus ? (
                          <LiveOutgoingMessageStatus
                            labels={{
                              delivered: t.chat.delivered,
                              seen: t.chat.seen,
                              sent: t.chat.sent,
                            }}
                            status={outgoingMessageStatus}
                          />
                        ) : null}
                      </span>

                      {reactionsByMessage.get(message.id)?.length && !isDeletedMessage ? (
                        <div
                          className={
                            isOwnMessage
                              ? 'reaction-groups reaction-groups-own'
                              : 'reaction-groups'
                          }
                          aria-label={t.chat.messageReactions}
                        >
                          {reactionsByMessage.get(message.id)?.map((reaction) => (
                            <form
                              key={`${message.id}-${reaction.emoji}`}
                              action={toggleReactionAction}
                            >
                              <input
                                name="conversationId"
                                type="hidden"
                                value={conversationId}
                              />
                              <input
                                name="messageId"
                                type="hidden"
                                value={message.id}
                              />
                              <input name="emoji" type="hidden" value={reaction.emoji} />
                              <button
                                className={
                                  reaction.selectedByCurrentUser
                                    ? 'reaction-pill reaction-pill-selected'
                                    : 'reaction-pill'
                                }
                                type="submit"
                              >
                                <span>{reaction.emoji}</span>
                                <span>{reaction.count}</span>
                              </button>
                            </form>
                          ))}
                        </div>
                      ) : null}

                      {isMessageInDeleteMode ? (
                        <form action={deleteMessageAction} className="message-delete-form">
                          <input
                            name="conversationId"
                            type="hidden"
                            value={conversationId}
                          />
                          <input name="messageId" type="hidden" value={message.id} />
                          <span className="message-delete-confirmation">
                            {t.chat.deleteConfirm}
                          </span>
                          <div className="message-delete-actions">
                            <button className="button button-danger button-compact" type="submit">
                              {t.chat.delete}
                            </button>
                            <Link
                              className="pill message-delete-cancel"
                              href={buildChatHref({
                                conversationId,
                                hash: `#message-${message.id}`,
                                spaceId: activeSpaceId,
                              })}
                            >
                              {t.chat.cancel}
                            </Link>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </ConversationPresenceProvider>
          ) : (
            timelineItems.map((item) => {
              if (item.type === 'separator') {
                return (
                  <div
                    key={item.key}
                    className="message-day-separator"
                    aria-label={item.label}
                  >
                    <span className="message-day-label">{item.label}</span>
                  </div>
                );
              }

              if (item.type === 'unread') {
                return (
                  <div
                    key={item.key}
                    className="message-unread-separator"
                    aria-label={item.label}
                  >
                    <span className="message-unread-label">{item.label}</span>
                  </div>
                );
              }

              const { message } = item;
              const isOwnMessage = message.sender_id === user.id;
              const isDeletedMessage = Boolean(message.deleted_at);
              const messageSeq = getMessageSeq(message.seq);
              const isLatestConversationMessage =
                latestVisibleMessageSeq !== null &&
                Number.isFinite(messageSeq) &&
                messageSeq === latestVisibleMessageSeq;
              const isMessageInEditMode =
                activeEditMessageId === message.id &&
                isOwnMessage &&
                !isDeletedMessage &&
                !isEncryptedDmTextMessage(message);
              const isMessageInDeleteMode =
                activeDeleteMessageId === message.id && isOwnMessage && !isDeletedMessage;
              const messageAttachments = attachmentsByMessage.get(message.id) ?? [];
              const encryptedEnvelope =
                e2eeEnvelopesByMessage.get(message.id) ?? null;
              const canAttemptEncryptedRender = canRenderEncryptedDmBody({
                clientId: message.client_id,
                envelopePresent: Boolean(encryptedEnvelope),
              });
              const otherParticipantReadSeq =
                otherParticipantReadState?.lastReadMessageSeq ?? null;
              const outgoingMessageStatus = getOutgoingMessageStatus({
                conversationId,
                isOwnMessage,
                isDeletedMessage,
                messageId: message.id,
                messageSeq: message.seq,
                otherParticipantReadSeq:
                  conversation.kind === 'dm' ? otherParticipantReadSeq : null,
              });
              const isMessageActionActive = activeActionMessage?.id === message.id;

              return (
                <article
                  key={item.key}
                  className={isOwnMessage ? 'message-row message-row-own' : 'message-row'}
                >
                  <div
                    className={
                      isDeletedMessage
                        ? isOwnMessage
                          ? 'message-card message-card-own message-card-deleted'
                          : 'message-card message-card-deleted'
                        : isOwnMessage
                          ? 'message-card message-card-own'
                          : 'message-card'
                    }
                    id={`message-${message.id}`}
                  >
                      {!isDeletedMessage ? (
                        <div
                          className={
                            isOwnMessage
                              ? 'message-header message-header-own'
                              : 'message-header'
                          }
                        >
                          <div className="message-header-side">
                          {!isDeletedMessage ? (
                            <Link
                              aria-label={t.chat.openMessageActions}
                              className={
                                isMessageActionActive
                                  ? 'message-actions-trigger message-actions-trigger-active'
                                  : 'message-actions-trigger'
                              }
                              href={buildChatHref({
                                actionMessageId: message.id,
                                conversationId,
                                hash: `#message-${message.id}`,
                                spaceId: activeSpaceId,
                              })}
                            >
                              <span aria-hidden="true">⋯</span>
                            </Link>
                          ) : null}
                          </div>
                        </div>
                      ) : null}
                      <div
                        className={
                          isOwnMessage
                            ? 'message-bubble message-bubble-own'
                            : 'message-bubble'
                        }
                      >
                        {message.reply_to_message_id && !isDeletedMessage ? (
                          <div className="message-reply-reference">
                            <span className="message-reply-sender">
                              {(() => {
                                const repliedMessage = messagesById.get(
                                  message.reply_to_message_id,
                                );

                                if (!repliedMessage) {
                                  return t.chat.earlierMessage;
                                }

                                if (repliedMessage.deleted_at) {
                                  return t.chat.deletedMessage;
                                }

                                return (
                                  senderNames.get(repliedMessage.sender_id ?? '') ||
                                  t.chat.unknownUser
                                );
                              })()}
                            </span>
                            <span className="message-reply-snippet">
                              {(() => {
                                const repliedMessage = messagesById.get(
                                  message.reply_to_message_id,
                                );

                                if (repliedMessage?.deleted_at) {
                                  return t.chat.messageDeleted;
                                }

                                if (repliedMessage?.kind === 'voice') {
                                  return t.chat.voiceMessage;
                                }

                                if (repliedMessage && isEncryptedDmTextMessage(repliedMessage)) {
                                  return t.chat.replyToEncryptedMessage;
                                }

                                return getMessageSnippet(
                                  repliedMessage?.body ?? null,
                                  t,
                                  72,
                                );
                              })()}
                            </span>
                          </div>
                        ) : null}
                        {isDeletedMessage ? (
                          <p className="message-deleted-text">{t.chat.messageDeleted}</p>
                        ) : isMessageInEditMode ? (
                          <form action={editMessageAction} className="stack message-edit-form">
                            <input
                              name="conversationId"
                              type="hidden"
                              value={conversationId}
                            />
                            <input name="messageId" type="hidden" value={message.id} />
                            <label className="field">
                              <span className="sr-only">{t.chat.edit}</span>
                              <AutoGrowTextarea
                                className="input textarea"
                                defaultValue={
                                  isEncryptedDmTextMessage(message)
                                    ? ''
                                    : message.body?.trim() ?? ''
                                }
                                maxHeight={160}
                                name="body"
                                required
                                rows={2}
                              />
                            </label>
                            <div className="message-edit-actions">
                              <button className="button button-compact" type="submit">
                                {t.chat.save}
                              </button>
                              <Link
                                className="pill message-edit-cancel"
                                href={buildChatHref({
                                  conversationId,
                                  hash: `#message-${message.id}`,
                                  spaceId: activeSpaceId,
                                })}
                              >
                                {t.chat.cancel}
                              </Link>
                            </div>
                          </form>
                        ) : activeEditMessageId === message.id &&
                          isOwnMessage &&
                          isEncryptedDmTextMessage(message) ? (
                          <div className="message-edit-unavailable">
                            <p className="message-edit-unavailable-copy">
                              {t.chat.encryptedEditUnavailable}
                            </p>
                            <div className="message-edit-actions">
                              <Link
                                className="pill message-edit-cancel"
                                href={buildChatHref({
                                  conversationId,
                                  hash: `#message-${message.id}`,
                                  spaceId: activeSpaceId,
                                })}
                              >
                                {t.chat.cancel}
                              </Link>
                            </div>
                          </div>
                        ) : isEncryptedDmTextMessage(message) ? (
                          canAttemptEncryptedRender ? (
                            <EncryptedDmMessageBody
                              clientId={message.client_id}
                              conversationId={conversationId}
                              currentUserId={user.id}
                              envelope={encryptedEnvelope}
                              fallbackLabel={t.chat.encryptedMessage}
                              refreshSetupLabel={t.chat.refreshEncryptedSetup}
                              reloadConversationLabel={t.chat.reloadConversation}
                              retryLabel={t.chat.retryEncryptedAction}
                              setupUnavailableLabel={t.chat.encryptedMessageSetupUnavailable}
                              unavailableLabel={t.chat.encryptedMessageUnavailable}
                              messageId={message.id}
                              messageCreatedAt={message.created_at}
                              shouldCachePreview={
                                conversation.kind === 'dm' && isLatestConversationMessage
                              }
                            />
                          ) : (
                            <div className="message-encryption-state">
                              <p className="message-body">
                                {t.chat.encryptedMessageUnavailable}
                              </p>
                            </div>
                          )
                        ) : message.body?.trim() ? (
                          <p className="message-body">{message.body.trim()}</p>
                        ) : !messageAttachments.length ? (
                          <p className="message-body">{t.chat.emptyMessage}</p>
                        ) : null}
                        {messageAttachments.length && !isDeletedMessage ? (
                          <div className="message-attachments">
                            {messageAttachments.map((attachment) => {
                              const attachmentContent = (
                                <>
                                  {attachment.isImage && attachment.signedUrl ? (
                                    <span
                                      aria-hidden="true"
                                      className="message-attachment-preview"
                                      style={{
                                        backgroundImage: `url("${attachment.signedUrl}")`,
                                      }}
                                    />
                                  ) : (
                                    <span
                                      aria-hidden="true"
                                      className="message-attachment-file"
                                    >
                                      {attachment.isAudio ? t.chat.audio : t.chat.file}
                                    </span>
                                  )}
                                  <span className="message-attachment-copy">
                                    <span className="message-attachment-name">
                                      {attachment.fileName}
                                    </span>
                                    <span className="message-attachment-meta">
                                      {attachment.isVoiceMessage
                                        ? t.chat.voiceMessage
                                        : attachment.isAudio
                                          ? t.chat.audio
                                          : attachment.isImage
                                            ? t.chat.image
                                            : t.chat.attachment}
                                      {formatAttachmentSize(attachment.sizeBytes)
                                        ? ` · ${formatAttachmentSize(
                                            attachment.sizeBytes,
                                          )}`
                                        : ''}
                                      {!attachment.signedUrl
                                        ? ` · ${t.chat.unavailableRightNow}`
                                        : ''}
                                    </span>
                                  </span>
                                </>
                              );

                              if (!attachment.signedUrl) {
                                return (
                                  <div
                                    key={attachment.id}
                                    className="message-attachment-card message-attachment-card-unavailable"
                                  >
                                    {attachmentContent}
                                  </div>
                                );
                              }

                              if (attachment.isAudio) {
                                return (
                                  <div
                                    key={attachment.id}
                                    className="message-attachment-card message-attachment-card-audio"
                                  >
                                    {attachmentContent}
                                    <audio
                                      className="message-attachment-audio"
                                      controls
                                      preload="metadata"
                                      src={attachment.signedUrl}
                                    />
                                  </div>
                                );
                              }

                              return (
                                <a
                                  key={attachment.id}
                                  className="message-attachment-card"
                                  href={attachment.signedUrl}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {attachmentContent}
                                </a>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={
                          isOwnMessage
                            ? 'message-meta message-meta-own'
                            : 'message-meta'
                        }
                      >
                        <span>{formatMessageTimestamp(message.created_at, language) || t.chat.justNow}</span>
                        {isEditedMessage(message) ? (
                          <span className="message-edited" aria-label={t.chat.edited}>
                            {t.chat.edited}
                          </span>
                        ) : null}
                        {isOwnMessage && outgoingMessageStatus ? (
                          otherParticipantUserId ? (
                            <LiveOutgoingMessageStatus
                              labels={{
                                delivered: t.chat.delivered,
                                seen: t.chat.seen,
                                sent: t.chat.sent,
                              }}
                              status={outgoingMessageStatus}
                            />
                          ) : (
                            <MessageStatusIndicator
                              label={
                                outgoingMessageStatus === 'seen'
                                  ? t.chat.seen
                                  : t.chat.sent
                              }
                              status={outgoingMessageStatus}
                            />
                          )
                        ) : null}
                      </span>

                      {reactionsByMessage.get(message.id)?.length && !isDeletedMessage ? (
                        <div
                          className={
                            isOwnMessage
                              ? 'reaction-groups reaction-groups-own'
                              : 'reaction-groups'
                          }
                          aria-label={t.chat.messageReactions}
                        >
                          {reactionsByMessage.get(message.id)?.map((reaction) => (
                            <form
                              key={`${message.id}-${reaction.emoji}`}
                              action={toggleReactionAction}
                            >
                              <input
                                name="conversationId"
                                type="hidden"
                                value={conversationId}
                              />
                              <input
                                name="messageId"
                                type="hidden"
                                value={message.id}
                              />
                              <input name="emoji" type="hidden" value={reaction.emoji} />
                              <button
                                className={
                                  reaction.selectedByCurrentUser
                                    ? 'reaction-pill reaction-pill-selected'
                                    : 'reaction-pill'
                                }
                                type="submit"
                              >
                                <span>{reaction.emoji}</span>
                                <span className="reaction-count">{reaction.count}</span>
                              </button>
                            </form>
                          ))}
                        </div>
                      ) : null}
                      {isMessageInDeleteMode ? (
                        <form action={deleteMessageAction} className="message-delete-confirm">
                          <input
                            name="conversationId"
                            type="hidden"
                            value={conversationId}
                          />
                          <input name="messageId" type="hidden" value={message.id} />
                          <input name="confirmDelete" type="hidden" value="true" />
                          <span className="message-delete-copy">
                            {t.chat.deleteConfirm}
                          </span>
                          <div className="message-delete-actions">
                            <button className="button button-compact" type="submit">
                              {t.chat.delete}
                            </button>
                            <Link
                              className="pill message-edit-cancel"
                              href={buildChatHref({
                                conversationId,
                                hash: `#message-${message.id}`,
                                spaceId: activeSpaceId,
                              })}
                            >
                              {t.chat.cancel}
                            </Link>
                          </div>
                        </form>
                      ) : null}
                  </div>
                </article>
              );
            })
          )}
          <OptimisticThreadMessages
            confirmedClientIds={messages
              .map((message) => message.client_id ?? null)
              .filter((clientId): clientId is string => Boolean(clientId))}
            conversationId={conversationId}
            labels={{
              failed: t.chat.sendFailed,
              justNow: t.chat.justNow,
              retry: t.chat.retrySend,
              sending: t.chat.sending,
              sent: t.chat.sent,
            }}
          />
          <MarkConversationRead
            bottomSentinelId="message-thread-bottom-sentinel"
            conversationId={conversationId}
            currentReadMessageSeq={readState.lastReadMessageSeq}
            latestVisibleMessageSeq={
              latestVisibleMessageSeq !== null && Number.isFinite(latestVisibleMessageSeq)
                ? latestVisibleMessageSeq
                : null
            }
          />
        </section>

        <section className="stack composer-card" id="message-composer">
          <TypingIndicator
            conversationId={conversationId}
            currentUserId={user.id}
            language={language}
          />
          {activeReplyTarget ? (
            <div className="composer-reply-preview">
              <div className="stack composer-reply-copy">
                <span className="composer-reply-label">{t.chat.replyingTo}</span>
                <span className="composer-reply-sender">
                  {activeReplyTarget.deleted_at
                    ? t.chat.deletedMessage
                    : senderNames.get(activeReplyTarget.sender_id ?? '') ||
                      t.chat.unknownUser}
                </span>
                <span className="composer-reply-snippet">
                  {activeReplyTarget.deleted_at
                    ? t.chat.thisMessageWasDeleted
                    : isEncryptedDmTextMessage(activeReplyTarget)
                      ? t.chat.replyToEncryptedMessage
                      : getMessageSnippet(activeReplyTarget.body, t, 88)}
                </span>
                {isEncryptedDmTextMessage(activeReplyTarget) ? (
                  <span className="composer-reply-note">
                    {t.chat.encryptedReplyInfo}
                  </span>
                ) : null}
              </div>
              <Link
                className="pill composer-reply-cancel"
                href={buildChatHref({
                  conversationId,
                  hash: '#message-composer',
                  spaceId: activeSpaceId,
                })}
              >
                {t.chat.cancel}
              </Link>
            </div>
          ) : null}
          {conversation.kind === 'dm' ? (
            <EncryptedDmComposerForm
              action={sendMessageAction}
              accept={CHAT_ATTACHMENT_ACCEPT}
              attachmentHelpText={attachmentHelpText}
              attachmentMaxSizeBytes={CHAT_ATTACHMENT_MAX_SIZE_BYTES}
              attachmentMaxSizeLabel={attachmentMaxSizeLabel}
              conversationId={conversationId}
              currentUserId={user.id}
              currentUserLabel={currentUserDisplayLabel}
              encryptedDmEnabled={encryptedDmEnabled}
              language={language}
              mentionParticipants={mentionParticipants}
              mentionSuggestionsLabel={t.chat.mentionSuggestions}
              messagePlaceholder={t.chat.messagePlaceholder}
              replyToMessageId={activeReplyTarget?.id ?? null}
              spaceId={activeSpaceId}
            />
          ) : (
            <GuardedServerActionForm
              action={sendMessageAction}
              className="stack composer-form"
            >
              <input name="conversationId" type="hidden" value={conversationId} />
              {activeReplyTarget ? (
                <input
                  name="replyToMessageId"
                  type="hidden"
                  value={activeReplyTarget.id}
                />
              ) : null}
              <div className="composer-input-shell">
                <ComposerAttachmentPicker
                  accept={CHAT_ATTACHMENT_ACCEPT}
                  helperText={attachmentHelpText}
                  maxSizeBytes={CHAT_ATTACHMENT_MAX_SIZE_BYTES}
                  maxSizeLabel={attachmentMaxSizeLabel}
                  language={language}
                />

                <label className="field composer-input-field">
                  <span className="sr-only">{t.chat.messagePlaceholder}</span>
                  <ComposerTypingTextarea
                    className="input textarea"
                    conversationId={conversationId}
                    currentUserId={user.id}
                    currentUserLabel={currentUserDisplayLabel}
                    mentionParticipants={mentionParticipants}
                    mentionSuggestionsLabel={t.chat.mentionSuggestions}
                    name="body"
                    placeholder={t.chat.messagePlaceholder}
                    rows={1}
                    maxHeight={136}
                  />
                </label>

                <div className="composer-action-cluster">
                  <button
                    aria-label={t.chat.microphone}
                    className="button button-secondary composer-button composer-button-mic"
                    disabled
                    title={t.chat.voiceMessagesSoon}
                    type="button"
                  >
                    <span aria-hidden="true" className="composer-mic-icon" />
                  </button>

                  <PendingSubmitButton
                    aria-label={t.chat.sendMessage}
                    className="button composer-button composer-button-icon"
                    type="submit"
                  >
                    <span aria-hidden="true">➤</span>
                  </PendingSubmitButton>
                </div>
              </div>
            </GuardedServerActionForm>
          )}
        </section>
      </section>

      {isSettingsOpen ? (
        <section
          className="conversation-settings-overlay"
          id="conversation-settings"
        >
          <Link
            aria-label={t.chat.closeInfo}
            className="conversation-settings-backdrop"
            href={buildChatHref({
              conversationId,
              spaceId: activeSpaceId,
            })}
          />

          <section className="card stack conversation-settings-card conversation-settings-sheet">
            <div className="conversation-settings-grabber" aria-hidden="true" />

            <div className="conversation-settings-header">
              <Link
                aria-label={t.chat.closeInfo}
                className="back-arrow-link conversation-settings-back-link"
                href={buildChatHref({
                  conversationId,
                  spaceId: activeSpaceId,
                })}
              >
                <span aria-hidden="true">←</span>
              </Link>
            </div>

            {visibleSettingsError ? (
              <p className="notice notice-error">{visibleSettingsError}</p>
            ) : null}

            {hasSettingsSavedState ? (
              <div
                aria-live="polite"
                className="notice notice-success notice-inline conversation-settings-success"
              >
                <span aria-hidden="true" className="notice-check conversation-settings-success-check">
                  ✓
                </span>
                <span className="notice-copy conversation-settings-success-copy">
                  {t.chat.changesSaved}
                </span>
              </div>
            ) : null}

            <section className="conversation-info-summary">
              <div className="conversation-info-identity">
                {conversation.kind === 'group' ? (
                  <GroupIdentityAvatar
                    avatarPath={conversation.avatarPath}
                    label={directConversationDisplayTitle}
                    size="lg"
                  />
                ) : (
                  <IdentityAvatar
                    diagnosticsSurface="chat:info-summary"
                    identity={directParticipantIdentity}
                    label={directConversationDisplayTitle}
                    size="lg"
                  />
                )}

                <div className="stack conversation-info-copy">
                  <h3 className="conversation-info-title">{directConversationDisplayTitle}</h3>
                  <p className="muted conversation-info-subtitle">
                    {conversation.kind === 'group'
                      ? groupMemberSummary
                      : t.chat.directChat}
                  </p>
                </div>
              </div>

              <div className="conversation-info-meta">
                <span className="conversation-info-meta-item">
                  {conversation.kind === 'group' ? t.chat.group : t.chat.person}
                </span>
                <span className="conversation-info-meta-item">
                  {t.chat.startedAt(formatLongDate(conversation.createdAt ?? null, language, t))}
                </span>
                {conversation.kind === 'group' ? (
                  <span className="conversation-info-meta-item">
                    {formatMemberCount(language, participants.length)}
                  </span>
                ) : null}
              </div>
            </section>

            <dl className="conversation-info-list">
              <div className="conversation-info-row">
                <dt className="conversation-info-label">{t.chat.type}</dt>
                <dd className="conversation-info-value">
                  {conversation.kind === 'group' ? t.inbox.create.group : t.chat.directChat}
                </dd>
              </div>
              {conversation.kind === 'group' ? (
                <div className="conversation-info-row">
                  <dt className="conversation-info-label">{t.chat.members}</dt>
                  <dd className="conversation-info-value">
                    {formatMemberCount(language, participants.length)}
                  </dd>
                </div>
              ) : null}
              <div className="conversation-info-row">
                <dt className="conversation-info-label">{t.chat.started}</dt>
                <dd className="conversation-info-value">
                  {formatLongDate(conversation.createdAt ?? null, language, t)}
                </dd>
              </div>
            </dl>

            <section className="conversation-settings-panel stack">
              <div className="stack conversation-settings-panel-copy">
                <h3 className="card-title">{t.chat.people}</h3>
                <p className="muted conversation-settings-note">
                  {conversation.kind === 'group'
                    ? formatMemberCount(language, participants.length)
                    : t.chat.inThisChat}
                </p>
              </div>

              <div className="conversation-member-list">
                {participantItems.map((participant) => (
                  <div
                    key={participant.userId}
                    className="conversation-member-row"
                  >
                    <div className="conversation-member-identity">
                      <IdentityAvatar
                        diagnosticsSurface="chat:participant-item"
                        identity={participant.identity}
                        label={participant.label}
                        size="sm"
                      />
                      <div className="stack conversation-member-copy">
                        <span className="user-label">
                          {participant.label}
                        </span>
                        <div className="conversation-member-meta">
                          <span className="conversation-role-chip">
                            {participant.roleLabel}
                          </span>
                          {participant.isCurrentUser ? (
                            <span className="conversation-member-self-chip">{t.chat.you}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    {conversation.kind === 'group' &&
                    canManageGroupParticipants &&
                    !participant.isCurrentUser &&
                    participant.role !== 'owner' ? (
                      <GuardedServerActionForm action={removeGroupParticipantAction}>
                        <input
                          name="conversationId"
                          type="hidden"
                          value={conversationId}
                        />
                        <input
                          name="targetUserId"
                          type="hidden"
                          value={participant.userId}
                        />
                        <PendingSubmitButton
                          className="button button-compact button-danger-subtle"
                          type="submit"
                        >
                          {t.chat.remove}
                        </PendingSubmitButton>
                      </GuardedServerActionForm>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {conversation.kind === 'group' ? (
              <section className="conversation-settings-panel stack">
                <div className="stack conversation-settings-panel-copy">
                  <h3 className="card-title">{t.chat.groupSection}</h3>
                  <p className="muted conversation-settings-note">
                    {t.chat.nameAndPeople}
                  </p>
                </div>

                <div className="conversation-group-actions">
                  {canEditGroupTitle ? (
                    <GroupChatSettingsForm
                      conversationId={conversationId}
                      defaultAvatarPath={conversation.avatarPath}
                      defaultTitle={conversation.title?.trim() || ''}
                      labels={{
                        title: t.chat.chatIdentity,
                        subtitle: t.chat.chatIdentityNote,
                        name: t.chat.name,
                        namePlaceholder: t.chat.groupNamePlaceholder,
                        nameRequired: t.chat.groupNameRequired,
                        changePhoto: t.chat.changePhoto,
                        removePhoto: t.chat.removePhoto,
                        saveChanges: t.chat.saveChanges,
                        cancelEdit: t.chat.cancel,
                        avatarDraftReady: t.chat.chatAvatarDraftReady,
                        avatarRemovedDraft: t.chat.chatAvatarRemovedDraft,
                        avatarUploading: t.chat.avatarUploading,
                        avatarTooLarge: t.chat.avatarTooLarge,
                        avatarInvalidType: t.chat.avatarInvalidType,
                        avatarUploadFailed: t.chat.avatarUploadFailed,
                        avatarStorageUnavailable: t.chat.avatarStorageUnavailable,
                      }}
                      spaceId={activeSpaceId}
                    />
                  ) : (
                    <section className="stack conversation-settings-subsection">
                      <div className="stack conversation-settings-panel-copy">
                        <h4 className="conversation-settings-subtitle">{t.chat.chatIdentity}</h4>
                        <div className="conversation-settings-static conversation-settings-group-identity-preview">
                          <GroupIdentityAvatar
                            avatarPath={conversation.avatarPath}
                            label={directConversationDisplayTitle}
                            size="md"
                          />
                          <div className="stack conversation-settings-group-identity-copy">
                            <p className="conversation-settings-title-preview">
                              {directConversationDisplayTitle}
                            </p>
                            <p className="muted conversation-settings-note">
                              {t.chat.ownerOnly}
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="stack conversation-settings-subsection conversation-participant-manager">
                    <div className="stack conversation-settings-panel-copy">
                      <h4 className="conversation-settings-subtitle">{t.chat.addPeople}</h4>
                      {!canManageGroupParticipants ? (
                        <p className="muted conversation-settings-note">
                          {t.chat.ownerOnly}
                        </p>
                      ) : null}
                    </div>

                    {canManageGroupParticipants ? (
                      availableParticipantsToAdd.length === 0 ? (
                        <p className="muted conversation-settings-note">
                          {t.chat.everyoneIsHere}
                        </p>
                      ) : (
                        <GuardedServerActionForm
                          action={addGroupParticipantsAction}
                          className="stack compact-form"
                        >
                          <input
                            name="conversationId"
                            type="hidden"
                            value={conversationId}
                          />
                          <div className="checkbox-list conversation-checkbox-list">
                            {availableParticipantsToAdd.map((participant) => (
                              <label
                                key={`add-${participant.userId}`}
                                className="checkbox-row"
                              >
                                <input
                                  name="participantUserIds"
                                  type="checkbox"
                                  value={participant.userId}
                                />
                                <span className="checkbox-copy">
                                  <span className="checkbox-identity">
                                    <IdentityAvatar
                                      diagnosticsSurface="chat:add-participant"
                                      identity={participant}
                                      label={participant.label}
                                      size="sm"
                                    />
                                  </span>
                                  <span className="user-label">{participant.label}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                          <PendingSubmitButton
                            className="button button-compact"
                            type="submit"
                          >
                            {t.chat.addPeople}
                          </PendingSubmitButton>
                        </GuardedServerActionForm>
                      )
                    ) : null}
                  </section>

                  <section className="stack conversation-settings-subsection conversation-leave-panel">
                    <div className="stack conversation-settings-panel-copy">
                      <h4 className="conversation-settings-subtitle">{t.chat.leaveGroup}</h4>
                    </div>
                    <GuardedServerActionForm action={leaveGroupAction}>
                      <input
                        name="conversationId"
                        type="hidden"
                        value={conversationId}
                      />
                      <PendingSubmitButton
                        className="button button-compact button-danger-subtle"
                        type="submit"
                      >
                        {t.chat.leaveGroupButton}
                      </PendingSubmitButton>
                    </GuardedServerActionForm>
                  </section>
                </div>
              </section>
            ) : null}

            <section className="conversation-settings-panel stack">
              <div className="stack conversation-settings-panel-copy">
                <h3 className="card-title">{t.chat.notifications}</h3>
                <p className="muted conversation-settings-note">
                  {t.chat.notificationsNote}
                </p>
              </div>

              <GuardedServerActionForm
                action={updateConversationNotificationLevelAction}
                className="conversation-notification-form"
              >
                <input
                  name="conversationId"
                  type="hidden"
                  value={conversationId}
                />

                <PendingSubmitButton
                  className={
                    conversation.notificationLevel === 'default'
                      ? 'conversation-choice-button conversation-choice-button-active'
                      : 'conversation-choice-button'
                  }
                  name="notificationLevel"
                  type="submit"
                  value="default"
                >
                    <span className="conversation-choice-copy">
                      <span className="conversation-choice-title">{t.chat.notificationsDefault}</span>
                      <span className="conversation-choice-note">
                        {t.chat.notificationsDefaultNote}
                      </span>
                    </span>
                </PendingSubmitButton>

                <PendingSubmitButton
                  className={
                    conversation.notificationLevel === 'muted'
                      ? 'conversation-choice-button conversation-choice-button-active'
                      : 'conversation-choice-button'
                  }
                  name="notificationLevel"
                  type="submit"
                  value="muted"
                >
                    <span className="conversation-choice-copy">
                      <span className="conversation-choice-title">{t.chat.notificationsMuted}</span>
                      <span className="conversation-choice-note">
                        {t.chat.notificationsMutedNote}
                      </span>
                    </span>
                </PendingSubmitButton>
              </GuardedServerActionForm>
            </section>

            {conversation.kind === 'dm' ? (
              <section className="conversation-settings-panel stack">
                <div className="stack conversation-settings-panel-copy">
                  <h3 className="card-title">{t.chat.deleteChat}</h3>
                  <p className="muted conversation-settings-note">
                    {t.chat.deleteChatNote}
                  </p>
                </div>

                <div className="conversation-manage-actions">
                  <GuardedServerActionForm action={deleteDirectConversationAction}>
                    <input
                      name="conversationId"
                      type="hidden"
                      value={conversationId}
                    />
                    <input
                      name="spaceId"
                      type="hidden"
                      value={activeSpaceId ?? ''}
                    />
                    <PendingSubmitButton
                      className="button button-compact button-danger-subtle"
                      type="submit"
                    >
                      {t.chat.deleteChatButton}
                    </PendingSubmitButton>
                  </GuardedServerActionForm>
                </div>
              </section>
            ) : (
              <section className="conversation-settings-panel stack">
                <div className="stack conversation-settings-panel-copy">
                  <h3 className="card-title">{t.chat.inbox}</h3>
                  <p className="muted conversation-settings-note">
                    {t.chat.inboxNote}
                  </p>
                </div>

                <div className="conversation-manage-actions">
                  <GuardedServerActionForm action={hideConversationAction}>
                    <input
                      name="conversationId"
                      type="hidden"
                      value={conversationId}
                    />
                    <input
                      name="spaceId"
                      type="hidden"
                      value={activeSpaceId ?? ''}
                    />
                    <PendingSubmitButton
                      className="button button-compact button-secondary"
                      type="submit"
                    >
                      {t.chat.hideFromInbox}
                    </PendingSubmitButton>
                  </GuardedServerActionForm>
                </div>
              </section>
            )}
          </section>
        </section>
      ) : null}

      {activeActionMessage && !activeActionMessage.deleted_at ? (
        <section className="message-sheet-overlay" aria-label={t.chat.openMessageActions}>
          <Link
            aria-label={t.chat.closeMessageActions}
            className="message-sheet-backdrop"
            href={buildChatHref({
              conversationId,
              hash: `#message-${activeActionMessage.id}`,
              spaceId: activeSpaceId,
            })}
          />
          <section className="message-sheet-card card stack">
            <div className="message-sheet-header">
              <div className="stack message-sheet-copy">
                <span className="message-sheet-title">
                  {activeActionMessageSenderLabel}
                </span>
                <span className="message-sheet-snippet">
                  {isEncryptedDmTextMessage(activeActionMessage)
                    ? t.chat.encryptedMessage
                    : activeActionMessage.body?.trim()
                    ? getMessageSnippet(activeActionMessage.body, t, 96)
                    : activeActionMessage.kind === 'voice'
                      ? t.chat.voiceMessage
                    : activeActionMessage.reply_to_message_id
                      ? t.chat.replyMessage
                      : t.chat.chooseAction}
                </span>
              </div>
              <Link
                aria-label={t.chat.closeMessageActions}
                className="message-sheet-close"
                href={buildChatHref({
                  conversationId,
                  hash: `#message-${activeActionMessage.id}`,
                  spaceId: activeSpaceId,
                })}
              >
                <span aria-hidden="true">×</span>
              </Link>
            </div>

            <div className="stack message-sheet-section">
              <div
                className={
                  activeActionMessage.sender_id === user.id
                    ? 'reaction-picker reaction-picker-own message-sheet-reactions'
                    : 'reaction-picker message-sheet-reactions'
                }
              >
                {STARTER_REACTIONS.map((emoji) => {
                  const currentReaction = activeActionReactions.find(
                    (reaction) => reaction.emoji === emoji,
                  );

                  return (
                    <form
                      key={`${activeActionMessage.id}-sheet-${emoji}`}
                      action={toggleReactionAction}
                    >
                      <input
                        name="conversationId"
                        type="hidden"
                        value={conversationId}
                      />
                      <input
                        name="messageId"
                        type="hidden"
                        value={activeActionMessage.id}
                      />
                      <input name="emoji" type="hidden" value={emoji} />
                      <button
                        className={
                          currentReaction?.selectedByCurrentUser
                            ? 'reaction-toggle reaction-toggle-selected'
                            : 'reaction-toggle'
                        }
                        type="submit"
                      >
                        <span>{emoji}</span>
                        {currentReaction ? (
                          <span className="reaction-count">{currentReaction.count}</span>
                        ) : null}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>

            <div className="stack message-sheet-section">
              <div className="message-sheet-action-list">
                <Link
                  className="message-sheet-action"
                  href={buildChatHref({
                    conversationId,
                    hash: '#message-composer',
                    replyToMessageId: activeActionMessage.id,
                    spaceId: activeSpaceId,
                  })}
                >
                  <span className="message-sheet-action-icon" aria-hidden="true">
                    ↩
                  </span>
                  <span className="message-sheet-action-copy">
                    <span className="message-sheet-action-label">{t.chat.reply}</span>
                    {isEncryptedDmTextMessage(activeActionMessage) ? (
                      <span className="message-sheet-action-note">
                        {t.chat.encryptedReplyInfo}
                      </span>
                    ) : null}
                  </span>
                </Link>

                {activeActionMessageIsOwn && isEncryptedDmTextMessage(activeActionMessage) ? (
                  <>
                    <div className="message-sheet-action message-sheet-action-disabled">
                      <span className="message-sheet-action-icon" aria-hidden="true">
                        ✎
                      </span>
                      <span className="message-sheet-action-copy">
                        <span className="message-sheet-action-label">{t.chat.edit}</span>
                        <span className="message-sheet-action-note">
                          {t.chat.encryptedEditUnavailable}
                        </span>
                      </span>
                    </div>

                    <Link
                      className="message-sheet-action message-sheet-action-danger"
                      href={buildChatHref({
                        conversationId,
                        deleteMessageId: activeActionMessage.id,
                        hash: `#message-${activeActionMessage.id}`,
                        spaceId: activeSpaceId,
                      })}
                    >
                      <span className="message-sheet-action-icon" aria-hidden="true">
                        🗑
                      </span>
                      <span className="message-sheet-action-copy">
                        <span className="message-sheet-action-label">{t.chat.delete}</span>
                      </span>
                    </Link>
                  </>
                ) : activeActionMessageIsOwn && !isEncryptedDmTextMessage(activeActionMessage) ? (
                  <>
                    <Link
                      className="message-sheet-action"
                      href={buildChatHref({
                        conversationId,
                        editMessageId: activeActionMessage.id,
                        hash: `#message-${activeActionMessage.id}`,
                        spaceId: activeSpaceId,
                      })}
                    >
                      <span className="message-sheet-action-icon" aria-hidden="true">
                        ✎
                      </span>
                      <span className="message-sheet-action-copy">
                        <span className="message-sheet-action-label">{t.chat.edit}</span>
                      </span>
                    </Link>

                    <Link
                      className="message-sheet-action message-sheet-action-danger"
                      href={buildChatHref({
                        conversationId,
                        deleteMessageId: activeActionMessage.id,
                        hash: `#message-${activeActionMessage.id}`,
                        spaceId: activeSpaceId,
                      })}
                    >
                      <span className="message-sheet-action-icon" aria-hidden="true">
                        🗑
                      </span>
                      <span className="message-sheet-action-copy">
                        <span className="message-sheet-action-label">{t.chat.delete}</span>
                      </span>
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          </section>
        </section>
      ) : null}
    </section>
  );
}
