import { getRequestViewer } from '@/lib/request-context/server';
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
  getConversationForUser,
  getConversationHistorySnapshot,
  getConversationHistoryWindowSizeForMessageTargets,
  getConversationMemberReadStates,
  getConversationParticipants,
  getConversationReadState,
  getMessageSenderProfiles,
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
  hideConversationAction,
  leaveGroupAction,
  removeGroupParticipantAction,
  sendMessageAction,
  updateConversationNotificationLevelAction,
} from './actions';
import { ConversationPresenceStatus } from './conversation-presence-status';
import { ChatHeaderAvatarVisual } from './chat-header-avatar-visual';
import { ComposerKeyboardOffset } from './composer-keyboard-offset';
import {
  DmThreadClientSubtree,
  DmThreadComposerFallback,
  DmThreadPresenceScope,
} from './dm-thread-client-diagnostics';
import { DmChatDeleteConfirmForm } from './dm-chat-delete-confirm-form';
import { DmThreadHydrationProbe } from './dm-thread-hydration-probe';
import { DmReplyTargetSnippet } from './dm-reply-target-snippet';
import { ThreadHistoryViewport } from './thread-history-viewport';
import { TypingIndicator } from './typing-indicator';
import { EncryptedDmComposerForm } from './encrypted-dm-composer-form';
import { GroupChatSettingsForm } from './group-chat-settings-form';
import { PlaintextChatComposerForm } from './plaintext-chat-composer-form';
import { ThreadReactionPicker } from './thread-reaction-picker';
import { ThreadLiveStateHydrator } from '@/modules/messaging/realtime/thread-live-state-store';
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

const THREAD_HISTORY_PAGE_SIZE = 26;

function formatLongDate(value: string | null, language: AppLanguage, t: ReturnType<typeof getTranslations>) {
  const parsedDate = parseSafeDate(value);

  if (!parsedDate) {
    return t.chat.unknown;
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
}

function getMessageSnippet(
  value: unknown,
  t: ReturnType<typeof getTranslations>,
  maxLength = 90,
) {
  const normalized = normalizeMessageBodyText(value) ?? '';

  if (!normalized) {
    return t.chat.emptyMessage;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function getMessageSeq(value: number | string) {
  return typeof value === 'number' ? value : Number(value);
}

function parseSafeDate(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsedDate = new Date(trimmed);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function normalizeMessageBodyText(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function logThreadRenderDiagnostics(
  stage: string,
  details: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP !== '1') {
    return;
  }

  console.info('[chat-thread-render]', stage, details);
}

function getThreadDeploymentMarker() {
  return {
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
  };
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
  clientId: unknown;
}) {
  return typeof input.clientId === 'string' && input.clientId.trim().length > 0;
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
  const languagePromise = getRequestLanguage();
  const user = await getRequestViewer();

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
  const requestedHistoryTargetMessageIds = Array.from(
    new Set(
      [
        query.actionMessageId?.trim() ?? '',
        query.deleteMessageId?.trim() ?? '',
        query.editMessageId?.trim() ?? '',
        query.replyToMessageId?.trim() ?? '',
      ].filter(Boolean),
    ),
  );
  const requestedHistoryTargetWindowSize =
    requestedHistoryTargetMessageIds.length > 0
      ? await getConversationHistoryWindowSizeForMessageTargets({
          conversationId,
          messageIds: requestedHistoryTargetMessageIds,
        })
      : null;
  const threadHistoryLimit =
    requestedHistoryTargetWindowSize &&
    Number.isFinite(requestedHistoryTargetWindowSize) &&
    requestedHistoryTargetWindowSize > 0
      ? Math.max(
          THREAD_HISTORY_PAGE_SIZE,
          Math.ceil(requestedHistoryTargetWindowSize / THREAD_HISTORY_PAGE_SIZE) *
            THREAD_HISTORY_PAGE_SIZE,
        )
      : THREAD_HISTORY_PAGE_SIZE;
  const threadRenderRequestId =
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
      ? crypto.randomUUID()
      : null;
  const threadDeploymentMarker = getThreadDeploymentMarker();
  const [
    threadHistorySnapshot,
    readState,
    memberReadStates,
    participants,
  ] =
    await Promise.all([
      getConversationHistorySnapshot({
        conversationId,
        debugRequestId: threadRenderRequestId,
        limit: threadHistoryLimit,
        userId: user.id,
      }),
      getConversationReadState(conversationId, user.id),
      getConversationMemberReadStates(conversationId),
      getConversationParticipants(conversationId),
    ]);
  const { hasMoreOlder, messages } = threadHistorySnapshot;
  // Temporary v1 unblocker: do not trigger space_members-backed available user lookup in TEST bypass flow.
  const availableUsers =
    conversation.kind === 'group' && isSettingsOpen && !isV1TestBypass
      ? await getAvailableUsers(user.id, { spaceId: activeSpaceId })
      : [];
  const messageIds = messages.map((message) => message.id);
  const firstMessage = messages[0] ?? null;
  const lastMessage = messages[messages.length - 1] ?? null;
  const encryptedMessageIds = messages
    .filter((message) => isEncryptedDmTextMessage(message))
    .map((message) => message.id);
  const snapshotSenderProfiles = threadHistorySnapshot.senderProfiles;
  const snapshotSenderProfileIds = new Set(
    snapshotSenderProfiles.map((profile) => profile.userId),
  );
  const supplementalSenderProfileIds = Array.from(
    [
      ...new Set([
        ...participants.map((participant) => participant.userId),
        ...availableUsers.map((availableUser) => availableUser.userId),
      ]),
    ].filter((userId) => !snapshotSenderProfileIds.has(userId)),
  );
  const supplementalSenderProfiles = supplementalSenderProfileIds.length
    ? await getMessageSenderProfiles(supplementalSenderProfileIds)
    : [];
  const senderProfiles = [
    ...snapshotSenderProfiles,
    ...supplementalSenderProfiles,
  ];
  const reactionsByMessage = new Map(
    threadHistorySnapshot.reactionsByMessage.map((entry) => [
      entry.messageId,
      entry.reactions,
    ] as const),
  );
  const e2eeEnvelopeHistory = {
    activeDeviceCreatedAt:
      threadHistorySnapshot.dmE2ee?.activeDeviceCreatedAt ?? null,
    activeDeviceRecordId:
      threadHistorySnapshot.dmE2ee?.activeDeviceRecordId ?? null,
    selectionSource: threadHistorySnapshot.dmE2ee?.selectionSource ?? null,
  };
  const e2eeEnvelopesByMessage = new Map(
    (threadHistorySnapshot.dmE2ee?.envelopesByMessage ?? []).map((entry) => [
      entry.messageId,
      entry.envelope,
    ] as const),
  );
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const currentUserConversationJoinedAt =
    threadHistorySnapshot.dmE2ee?.historyHintsByMessage[0]?.hint.viewerJoinedAt ??
    null;
  const currentUserJoinedAtDate = parseSafeDate(currentUserConversationJoinedAt);
  const encryptedHistoryHintsByMessage = new Map(
    (threadHistorySnapshot.dmE2ee?.historyHintsByMessage ?? []).map((entry) => [
      entry.messageId,
      entry.hint,
    ] as const),
  );
  if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' && encryptedMessageIds.length > 0) {
    const missingEnvelopeMessageIds = encryptedMessageIds.filter(
      (messageId) => !e2eeEnvelopesByMessage.has(messageId),
    );
    const activeDeviceCreatedAtDate = parseSafeDate(
      e2eeEnvelopeHistory.activeDeviceCreatedAt ?? null,
    );
    const missingEnvelopeDiagnostics = missingEnvelopeMessageIds.map((messageId) => {
      const message = messagesById.get(messageId) ?? null;
      const messageCreatedAt = message?.created_at ?? null;
      const messageCreatedAtDate = parseSafeDate(messageCreatedAt);
      const sameUserNewDevice =
        messageCreatedAtDate !== null &&
        activeDeviceCreatedAtDate !== null &&
        currentUserJoinedAtDate !== null &&
        messageCreatedAtDate.getTime() >= currentUserJoinedAtDate.getTime() &&
        activeDeviceCreatedAtDate.getTime() > messageCreatedAtDate.getTime();
      const policyBlocked =
        messageCreatedAtDate !== null &&
        currentUserJoinedAtDate !== null &&
        message?.sender_id !== user.id &&
        messageCreatedAtDate.getTime() < currentUserJoinedAtDate.getTime();

      return {
        backfillAttempted: false,
        backfillResult: sameUserNewDevice
          ? 'skipped-unsupported-v1-no-cross-device-recovery'
          : policyBlocked
            ? 'not-applicable-policy-blocked'
            : 'not-attempted-no-history-sync-path',
        currentDeviceRowId: e2eeEnvelopeHistory.activeDeviceRecordId ?? null,
        currentDeviceRowSelectionSource: e2eeEnvelopeHistory.selectionSource ?? null,
        envelopeFoundForCurrentDevice: false,
        memberJoinedAt: currentUserConversationJoinedAt,
        messageCreatedAt,
        messageId,
        sameUserNewDevice,
      };
    });
    const policyBlockedMessageIds = encryptedMessageIds.filter(
      (messageId) =>
        encryptedHistoryHintsByMessage.get(messageId)?.code ===
        'policy-blocked-history',
    );
    console.info('[dm-e2ee-history]', 'thread:envelope-availability', {
      conversationId,
      currentUserId: user.id,
      debugRequestId: threadRenderRequestId,
      deploymentId: threadDeploymentMarker.deploymentId,
      encryptedMessageCount: encryptedMessageIds.length,
      envelopeCount: e2eeEnvelopesByMessage.size,
      firstMessageId: firstMessage?.id ?? null,
      gitCommitSha: threadDeploymentMarker.gitCommitSha,
      historyWindowLimit: threadHistoryLimit,
      lastMessageId: lastMessage?.id ?? null,
      messageCount: messages.length,
      missingEnvelopeDiagnostics,
      missingEnvelopeCount: missingEnvelopeMessageIds.length,
      missingEnvelopeMessageIds,
      selectedActiveDeviceCreatedAt: e2eeEnvelopeHistory.activeDeviceCreatedAt ?? null,
      selectedActiveDeviceRowId: e2eeEnvelopeHistory.activeDeviceRecordId ?? null,
      selectedActiveDeviceSelectionSource: e2eeEnvelopeHistory.selectionSource ?? null,
      policyBlockedCount: policyBlockedMessageIds.length,
      policyBlockedMessageIds,
      vercelUrl: threadDeploymentMarker.vercelUrl,
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
  const canDeleteDirectConversation =
    conversation.kind === 'dm' &&
    participants.some((participant) => participant.userId === user.id);
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
  const firstMessageCreatedAtValid = firstMessage
    ? Boolean(parseSafeDate(firstMessage.created_at))
    : null;
  const firstMessageBodyType = firstMessage
    ? firstMessage.body === null
      ? 'null'
      : typeof firstMessage.body
    : null;
  const dateFallbackUsed = messages.some(
    (message) => parseSafeDate(message.created_at) === null,
  );
  const threadMetadataFallbackCount = messages.reduce(
    (count, message) =>
      count +
      (parseSafeDate(message.created_at) ? 0 : 1) +
      (message.body !== null && typeof message.body !== 'string' ? 1 : 0),
    0,
  );
  const otherParticipantReadSeqRaw =
    conversation.kind === 'dm'
      ? otherParticipantReadState?.lastReadMessageSeq ?? null
      : null;
  const hasInvalidReadSeqFallback =
    otherParticipantReadSeqRaw !== null &&
    normalizeComparableMessageSeq(otherParticipantReadSeqRaw) === null;
  const threadStatusFallbackCount = messages.reduce((count, message) => {
    const isOwnMessage = message.sender_id === user.id;
    const isDeletedMessage = Boolean(message.deleted_at);

    if (!isOwnMessage || isDeletedMessage) {
      return count;
    }

    if (normalizeComparableMessageSeq(message.seq) === null) {
      return count + 1;
    }

    if (hasInvalidReadSeqFallback) {
      return count + 1;
    }

    return count;
  }, 0);
  const unreadSeparatorFallbackUsed =
    hasInvalidReadSeqFallback ||
    (readState.lastReadMessageSeq !== null &&
      messages.some((message, index) => {
        const normalizedMessageSeq = normalizeComparableMessageSeq(message.seq);
        const normalizedPreviousSeq =
          index > 0
            ? normalizeComparableMessageSeq(messages[index - 1]?.seq)
            : null;

        return (
          normalizedMessageSeq === null ||
          (index > 0 && normalizedPreviousSeq === null)
        );
      }));
  const daySeparatorFallbackUsed = dateFallbackUsed;
  const encryptedRenderFallbackCount = encryptedMessageIds.filter((messageId) => {
    const message = messagesById.get(messageId);

    return (
      Boolean(message) &&
      !canRenderEncryptedDmBody({
        clientId: message?.client_id,
      })
    );
  }).length;
  const threadClientDiagnostics = {
    debugRequestId: threadRenderRequestId,
    deploymentId: threadDeploymentMarker.deploymentId,
    gitCommitSha: threadDeploymentMarker.gitCommitSha,
    vercelUrl: threadDeploymentMarker.vercelUrl,
  };

  if (
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' &&
    conversation.kind === 'dm'
  ) {
    logThreadRenderDiagnostics('dm-thread:open-summary', {
      ...threadDeploymentMarker,
      conversationId,
      debugRequestId: threadRenderRequestId,
      dateFallbackUsed,
      daySeparatorFallbackUsed,
      encryptedRenderFallbackCount,
      envelopeCount: e2eeEnvelopesByMessage.size,
      firstMessageBodyType,
      firstMessageCreatedAtValid,
      firstMessageId: firstMessage?.id ?? null,
      lastMessageId: lastMessage?.id ?? null,
      hasMoreOlder,
      historyWindowSize: messages.length,
      historyWindowLimit: threadHistoryLimit,
      kind: conversation.kind,
      messageCount: messages.length,
      metadataFallbackUsed: threadMetadataFallbackCount > 0,
      metadataFallbackCount: threadMetadataFallbackCount,
      missingEnvelopeCount: encryptedMessageIds.filter(
        (messageId) => !e2eeEnvelopesByMessage.has(messageId),
      ).length,
      policyBlockedCount: encryptedMessageIds.filter(
        (messageId) =>
          encryptedHistoryHintsByMessage.get(messageId)?.code ===
          'policy-blocked-history',
      ).length,
      statusFallbackUsed: threadStatusFallbackCount > 0,
      statusFallbackCount: threadStatusFallbackCount,
      unreadSeparatorFallbackUsed,
    });
  }

  return (
    <section className="stack chat-screen">
      {conversation.kind === 'dm' ? (
        <DmThreadHydrationProbe
          conversationId={conversationId}
          debugRequestId={threadRenderRequestId}
          firstMessageId={firstMessage?.id ?? null}
          historyWindowLimit={threadHistoryLimit}
          initialServerMessageCount={messages.length}
          kind="dm"
          lastMessageId={lastMessage?.id ?? null}
          renderedEmptyState={messages.length === 0}
        />
      ) : null}
      {conversation.kind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="active-chat-realtime-sync"
        >
          <ActiveChatRealtimeSync
            conversationId={conversationId}
            currentUserId={user.id}
            messageIds={messages.map((message) => message.id)}
          />
        </DmThreadClientSubtree>
      ) : (
        <ActiveChatRealtimeSync
          conversationId={conversationId}
          currentUserId={user.id}
          messageIds={messages.map((message) => message.id)}
        />
      )}
      <ThreadLiveStateHydrator
        conversationId={conversationId}
        currentUserReadSeq={readState.lastReadMessageSeq}
        otherParticipantReadSeq={otherParticipantReadState?.lastReadMessageSeq ?? null}
        reactionsByMessage={messageIds.map((messageId) => ({
          messageId,
          reactions: reactionsByMessage.get(messageId) ?? [],
        }))}
      />
      {conversation.kind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="composer-keyboard-offset"
        >
          <ComposerKeyboardOffset />
        </DmThreadClientSubtree>
      ) : (
        <ComposerKeyboardOffset />
      )}

      <DmThreadPresenceScope
        conversationId={conversationId}
        currentUserId={user.id}
        debugRequestId={threadRenderRequestId}
        deploymentId={threadDeploymentMarker.deploymentId}
        gitCommitSha={threadDeploymentMarker.gitCommitSha}
        otherUserId={conversation.kind === 'dm' ? otherParticipantUserId : null}
        vercelUrl={threadDeploymentMarker.vercelUrl}
      >
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
          href={withSpaceParam(`/chat/${conversationId}/settings`, activeSpaceId)}
        >
          <div className="chat-header-identity">
            <ChatHeaderAvatarVisual
              conversationKind={conversation.kind === 'group' ? 'group' : 'dm'}
              groupAvatarPath={conversation.avatarPath}
              participant={
                directParticipantIdentity
                  ? {
                      avatarPath: directParticipantIdentity.avatarPath ?? null,
                      displayName: directParticipantIdentity.displayName ?? null,
                      userId: directParticipantIdentity.userId,
                    }
                  : null
              }
              title={directConversationDisplayTitle}
            />

            <div className="stack chat-header-copy">
              <h1 className="conversation-screen-title">
                {directConversationDisplayTitle}
              </h1>
              {conversation.kind === 'group' ? (
                <p className="muted chat-member-summary">{groupMemberSummary}</p>
              ) : otherParticipants[0] ? (
                <DmThreadClientSubtree
                  conversationId={conversationId}
                  {...threadClientDiagnostics}
                  fallback={null}
                  surface="conversation-presence-status"
                >
                  <ConversationPresenceStatus language={language} />
                </DmThreadClientSubtree>
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
          <ThreadHistoryViewport
            activeActionMessageId={activeActionMessageId}
            activeDeleteMessageId={activeDeleteMessageId}
            activeEditMessageId={activeEditMessageId}
            activeSpaceId={activeSpaceId}
            confirmedClientIds={messages
              .map((message) => message.client_id ?? null)
              .filter((clientId): clientId is string => Boolean(clientId))}
            conversationId={conversationId}
            conversationKind={conversation.kind === 'group' ? 'group' : 'dm'}
            currentReadMessageSeq={readState.lastReadMessageSeq}
            currentUserId={user.id}
            initialSnapshot={threadHistorySnapshot}
            language={language}
            latestVisibleMessageSeq={latestVisibleMessageSeq}
            otherParticipantReadSeq={otherParticipantReadState?.lastReadMessageSeq ?? null}
            otherParticipantUserId={otherParticipantUserId}
            threadClientDiagnostics={threadClientDiagnostics}
          />
        </section>

        <section className="stack composer-card" id="message-composer">
          {conversation.kind === 'dm' ? (
            <DmThreadClientSubtree
              conversationId={conversationId}
              {...threadClientDiagnostics}
              surface="typing-indicator"
            >
              <TypingIndicator
                conversationId={conversationId}
                currentUserId={user.id}
                language={language}
              />
            </DmThreadClientSubtree>
          ) : (
            <TypingIndicator
              conversationId={conversationId}
              currentUserId={user.id}
              language={language}
            />
          )}
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
                <DmReplyTargetSnippet
                  body={activeReplyTarget.body}
                  conversationId={conversationId}
                  currentUserId={user.id}
                  debugRequestId={threadRenderRequestId}
                  deletedFallbackLabel={t.chat.thisMessageWasDeleted}
                  emptyFallbackLabel={t.chat.emptyMessage}
                  encryptedFallbackLabel={t.chat.replyToEncryptedMessage}
                  encryptedReferenceNote={t.chat.encryptedReplyInfo}
                  loadedFallbackLabel={t.chat.earlierMessage}
                  messageId={activeReplyTarget.id}
                  surface="composer-reply-preview"
                  targetDeleted={Boolean(activeReplyTarget.deleted_at)}
                  targetIsEncrypted={isEncryptedDmTextMessage(activeReplyTarget)}
                  targetIsLoaded
                  targetKind={activeReplyTarget.kind}
                  targetMessageId={activeReplyTarget.id}
                  voiceFallbackLabel={t.chat.voiceMessage}
                />
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
            <DmThreadClientSubtree
              conversationId={conversationId}
              {...threadClientDiagnostics}
              fallback={
                <DmThreadComposerFallback
                  copy={t.chat.encryptionNeedsRefresh}
                  reloadLabel={t.chat.reloadConversation}
                />
              }
              surface="encrypted-dm-composer-form"
            >
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
              />
            </DmThreadClientSubtree>
          ) : (
            <PlaintextChatComposerForm
              accept={CHAT_ATTACHMENT_ACCEPT}
              attachmentHelpText={attachmentHelpText}
              attachmentMaxSizeBytes={CHAT_ATTACHMENT_MAX_SIZE_BYTES}
              attachmentMaxSizeLabel={attachmentMaxSizeLabel}
              conversationId={conversationId}
              currentUserId={user.id}
              currentUserLabel={currentUserDisplayLabel}
              language={language}
              mentionParticipants={mentionParticipants}
              mentionSuggestionsLabel={t.chat.mentionSuggestions}
              messagePlaceholder={t.chat.messagePlaceholder}
              replyToMessageId={activeReplyTarget?.id ?? null}
            />
          )}
        </section>
      </section>
      </DmThreadPresenceScope>

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
                          {conversation.kind === 'group' ? (
                            <span className="conversation-role-chip">
                              {participant.roleLabel}
                            </span>
                          ) : null}
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

            {canDeleteDirectConversation ? (
              <section className="conversation-settings-panel stack">
                <div className="stack conversation-settings-panel-copy">
                  <h3 className="card-title">{t.chat.deleteChat}</h3>
                  <p className="muted conversation-settings-note">
                    {t.chat.deleteChatCurrentUserOnlyNote}
                  </p>
                </div>

                <div className="conversation-manage-actions">
                  <DmChatDeleteConfirmForm
                    cancelLabel={t.chat.cancel}
                    confirmBody={t.chat.deleteChatConfirmBody}
                    confirmButtonLabel={t.chat.deleteChatConfirmButton}
                    confirmHint={t.chat.deleteChatConfirmHint}
                    confirmPlaceholder={t.chat.deleteChatConfirmPlaceholder}
                    confirmTitle={t.chat.deleteChatConfirmTitle}
                    conversationId={conversationId}
                    deleteButtonLabel={t.chat.deleteChatButton}
                    returnTo="settings-overlay"
                    spaceId={activeSpaceId}
                  />
                </div>
              </section>
            ) : conversation.kind === 'group' ? (
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
            ) : null}
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
                    : normalizeMessageBodyText(activeActionMessage.body)
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
              <ThreadReactionPicker
                conversationId={conversationId}
                currentUserId={user.id}
                emojis={STARTER_REACTIONS}
                initialReactions={activeActionReactions}
                isOwnMessage={activeActionMessage.sender_id === user.id}
                messageId={activeActionMessage.id}
              />
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
