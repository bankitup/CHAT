import 'server-only';

import { getRequestViewer } from '@/lib/request-context/server';
import {
  formatMemberCount,
  formatPersonFallbackLabel,
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getAvailableUsers,
  getConversationDisplayName,
  getConversationMemberReadStates,
  getConversationParticipants,
  getConversationReadState,
  getDirectMessageDisplayName,
} from '@/modules/messaging/data/conversation-read-server';
import {
  getConversationHistorySnapshot,
  getConversationHistoryWindowSizeForMessageTargets,
  getMessageSenderProfiles,
  type MessageSenderProfile,
} from '@/modules/messaging/data/thread-read-server';
import { CHAT_ATTACHMENT_HELP_TEXT } from '@/modules/messaging/data/server';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import {
  canAddParticipantsToGroupConversation,
  canEditGroupConversationIdentity,
  canRemoveParticipantFromGroupConversation,
  normalizeGroupConversationJoinPolicy,
} from '@/modules/messaging/group-policy';
import {
  logBrokenThreadHistoryProof,
  summarizeBrokenThreadHistorySnapshot,
} from '@/modules/messaging/diagnostics/thread-history-proof';
import {
  measureWarmNavServerLoad,
  recordWarmNavServerRender,
} from '@/modules/messaging/performance/warm-nav-server';
import { resolveMessagingConversationRouteContextForUser } from '@/modules/messaging/server/route-context';
import { resolvePublicIdentityLabel } from '@/modules/profile/ui/identity-label';
import { resolveIdentityStatusParts } from '@/modules/profile/ui/identity-status';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import { withSpaceParam } from '@/modules/spaces/url';
import { notFound, redirect } from 'next/navigation';

const THREAD_HISTORY_PAGE_SIZE = 26;
const CHAT_ATTACHMENT_HELP_TEXT_RU =
  'Поддерживаются фото, документы, ZIP-архивы и обычные аудиофайлы до 10 МБ.';

export type MessengerThreadPageQuery = {
  actionMessageId?: string;
  deleteMessageId?: string;
  details?: string;
  editMessageId?: string;
  error?: string;
  replyToMessageId?: string;
  saved?: string;
  settings?: string;
  space?: string;
};

function shouldHydrateChatSurfaceIdentity(
  profile: MessageSenderProfile | undefined,
) {
  return !profile?.avatarPath;
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

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getMessageSeq(value: number | string) {
  return typeof value === 'number' ? value : Number(value);
}

function buildChatHref(input: {
  actionMessageId?: string | null;
  conversationId: string;
  deleteMessageId?: string | null;
  details?: string | null;
  editMessageId?: string | null;
  error?: string | null;
  hash?: string | null;
  replyToMessageId?: string | null;
  saved?: string | null;
  spaceId: string;
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

function getThreadRenderErrorDiagnostics(error: unknown) {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
    };
  }

  return {
    errorMessage: String(error),
    errorName: null,
  };
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

function shouldLogThreadRenderCheckpoint() {
  return (
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' ||
    process.env.CHAT_DEBUG_THREAD_RENDER === '1'
  );
}

function logThreadRenderCheckpoint(
  stage: string,
  details?: Record<string, unknown>,
  level: 'error' | 'info' = 'info',
) {
  if (level !== 'error' && !shouldLogThreadRenderCheckpoint()) {
    return;
  }

  if (details) {
    console[level]('[chat-thread-checkpoint]', stage, details);
    return;
  }

  console[level]('[chat-thread-checkpoint]', stage);
}

async function resolveThreadRenderStage<T>(
  stage: string,
  details: Record<string, unknown>,
  resolver: () => Promise<T> | T,
) {
  logThreadRenderCheckpoint(`${stage}:started`, details);
  logThreadRenderDiagnostics(`${stage}:started`, details);

  try {
    const result = await resolver();
    logThreadRenderCheckpoint(`${stage}:completed`, details);
    logThreadRenderDiagnostics(`${stage}:completed`, details);
    return result;
  } catch (error) {
    const errorDetails = {
      ...details,
      ...getThreadRenderErrorDiagnostics(error),
    };
    logThreadRenderCheckpoint(`${stage}:failed`, errorDetails, 'error');
    console.error('[chat-thread-render]', `${stage}:failed`, errorDetails);
    throw error;
  }
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

function isEncryptedDmMessage(value: {
  content_mode?: string | null;
  deleted_at?: string | null;
  kind: string | null;
}) {
  return (
    (value.kind === 'text' || value.kind === 'attachment') &&
    value.content_mode === 'dm_e2ee_v1' &&
    !value.deleted_at
  );
}

function canRenderEncryptedDmBody(input: { clientId: unknown }) {
  return typeof input.clientId === 'string' && input.clientId.trim().length > 0;
}

function classifyMissingEncryptedHistory(input: {
  activeDeviceCreatedAtDate: Date | null;
  currentUserId: string;
  currentUserJoinedAtDate: Date | null;
  message: {
    created_at: string | null;
    sender_id: string | null;
  } | null;
}) {
  const messageCreatedAtDate = parseSafeDate(input.message?.created_at ?? null);
  const policyBlocked =
    messageCreatedAtDate !== null &&
    input.currentUserJoinedAtDate !== null &&
    input.message?.sender_id !== input.currentUserId &&
    messageCreatedAtDate.getTime() < input.currentUserJoinedAtDate.getTime();

  if (policyBlocked) {
    return {
      classification: 'policy-blocked-by-membership' as const,
      expectedByDesign: true,
      messageCreatedAtDate,
      policyBlocked: true,
      sameUserNewDevice: false,
      suspiciousMissingEnvelope: false,
    };
  }

  const messagePredatesCurrentDevice =
    messageCreatedAtDate !== null &&
    input.activeDeviceCreatedAtDate !== null &&
    messageCreatedAtDate.getTime() < input.activeDeviceCreatedAtDate.getTime();

  if (messagePredatesCurrentDevice) {
    const sameUserNewDevice =
      input.currentUserJoinedAtDate !== null &&
      messageCreatedAtDate.getTime() >= input.currentUserJoinedAtDate.getTime();

    return {
      classification:
        input.message?.sender_id === input.currentUserId
          ? ('expected-v1-sent-on-older-device' as const)
          : ('expected-v1-received-before-current-device' as const),
      expectedByDesign: true,
      messageCreatedAtDate,
      policyBlocked: false,
      sameUserNewDevice,
      suspiciousMissingEnvelope: false,
    };
  }

  return {
    classification: 'unexpected-current-device-envelope-missing' as const,
    expectedByDesign: false,
    messageCreatedAtDate,
    policyBlocked: false,
    sameUserNewDevice: false,
    suspiciousMissingEnvelope: true,
  };
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

function resolveReplyTargetAttachmentKind(
  attachments:
    | Array<{
        isAudio?: boolean | null;
        isImage?: boolean | null;
        isVoiceMessage?: boolean | null;
      }>
    | null
    | undefined,
) {
  const normalizedAttachments = attachments ?? [];

  if (normalizedAttachments.length === 0) {
    return null;
  }

  if (normalizedAttachments.some((attachment) => attachment?.isImage)) {
    return 'photo' as const;
  }

  if (
    normalizedAttachments.some(
      (attachment) => attachment?.isAudio && !attachment?.isVoiceMessage,
    )
  ) {
    return 'audio' as const;
  }

  if (normalizedAttachments.length > 0) {
    return 'file' as const;
  }

  return 'attachment' as const;
}

export async function loadMessengerThreadPageData(input: {
  conversationId: string;
  query: MessengerThreadPageQuery;
}) {
  const languagePromise = getRequestLanguage();
  const user = await getRequestViewer();

  if (!user) {
    notFound();
  }

  const routeContext = await resolveMessagingConversationRouteContextForUser({
    conversationId: input.conversationId,
    requestedSpaceId: input.query.space,
    source: 'chat-page',
    userEmail: user.email ?? null,
    userId: user.id,
  });

  if (routeContext.kind === 'conversation_not_found') {
    notFound();
  }

  if (routeContext.kind === 'requested_space_invalid') {
    notFound();
  }

  if (routeContext.kind === 'space_unavailable') {
    redirect('/spaces');
  }

  const {
    activeSpaceId,
    conversation,
    isV1TestBypass,
    shouldRedirectToCanonicalSpace,
  } = routeContext.context;

  if (shouldRedirectToCanonicalSpace) {
    redirect(
      buildChatHref({
        actionMessageId: input.query.actionMessageId ?? null,
        conversationId: input.conversationId,
        deleteMessageId: input.query.deleteMessageId ?? null,
        details: input.query.details ?? input.query.settings ?? null,
        editMessageId: input.query.editMessageId ?? null,
        error: input.query.error ?? null,
        replyToMessageId: input.query.replyToMessageId ?? null,
        spaceId: activeSpaceId,
      }),
    );
  }

  const language = await languagePromise;
  const t = getTranslations(language);
  const visibleRouteError = input.query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'chat'),
        language,
        rawMessage: input.query.error,
      })
    : null;
  const visibleSettingsError = input.query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'chat-settings'),
        language,
        rawMessage: input.query.error,
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
    input.query.details === 'open' || input.query.settings === 'open';
  const hasSettingsSavedState = input.query.saved === '1';
  const requestedHistoryTargetMessageIds = Array.from(
    new Set(
      [
        input.query.actionMessageId?.trim() ?? '',
        input.query.deleteMessageId?.trim() ?? '',
        input.query.editMessageId?.trim() ?? '',
        input.query.replyToMessageId?.trim() ?? '',
      ].filter((value) => value && looksLikeUuid(value)),
    ),
  );
  const requestedHistoryTargetWindowSize =
    requestedHistoryTargetMessageIds.length > 0
      ? await getConversationHistoryWindowSizeForMessageTargets({
          conversationId: input.conversationId,
          messageIds: requestedHistoryTargetMessageIds,
          userId: user.id,
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
  const warmNavRouteKey = [
    `conversation=${input.conversationId}`,
    `space=${activeSpaceId}`,
    `settings=${isSettingsOpen ? '1' : '0'}`,
    `targets=${requestedHistoryTargetMessageIds.length}`,
  ].join('|');

  recordWarmNavServerRender({
    details: {
      isSettingsOpen,
      kind: conversation.kind,
      requestedHistoryTargetMessageCount:
        requestedHistoryTargetMessageIds.length,
    },
    routeKey: warmNavRouteKey,
    surface: 'chat',
  });

  const threadRenderRequestId =
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
      ? crypto.randomUUID()
      : null;
  const threadDeploymentMarker = getThreadDeploymentMarker();

  logThreadRenderCheckpoint('conversation-loaded', {
    ...threadDeploymentMarker,
    activeSpaceId,
    conversationId: input.conversationId,
    debugRequestId: threadRenderRequestId,
    hasSettingsSavedState,
    isSettingsOpen,
    isV1TestBypass,
    kind: conversation.kind,
    requestedHistoryTargetMessageCount: requestedHistoryTargetMessageIds.length,
    userId: user.id,
  });

  const [
    threadHistorySnapshot,
    readState,
    memberReadStates,
    participants,
  ] = await Promise.all([
    measureWarmNavServerLoad({
      details: {
        conversationId: input.conversationId,
        requestedHistoryTargetMessageCount:
          requestedHistoryTargetMessageIds.length,
        threadHistoryLimit,
        userId: user.id,
      },
      load: 'history-snapshot',
      routeKey: warmNavRouteKey,
      surface: 'chat',
      resolver: () =>
        resolveThreadRenderStage(
          'history-snapshot-load',
          {
            conversationId: input.conversationId,
            debugRequestId: threadRenderRequestId,
            kind: conversation.kind,
            requestedHistoryTargetMessageCount:
              requestedHistoryTargetMessageIds.length,
            threadHistoryLimit,
          },
          () =>
            getConversationHistorySnapshot({
              conversationId: input.conversationId,
              debugRequestId: threadRenderRequestId,
              limit: threadHistoryLimit,
              userId: user.id,
            }),
        ),
    }),
    measureWarmNavServerLoad({
      details: {
        conversationId: input.conversationId,
        userId: user.id,
      },
      load: 'read-state',
      routeKey: warmNavRouteKey,
      surface: 'chat',
      resolver: () =>
        resolveThreadRenderStage(
          'read-state-load',
          {
            conversationId: input.conversationId,
            debugRequestId: threadRenderRequestId,
            userId: user.id,
          },
          () => getConversationReadState(input.conversationId, user.id),
        ),
    }),
    conversation.kind === 'dm'
      ? measureWarmNavServerLoad({
          details: {
            conversationId: input.conversationId,
            kind: conversation.kind,
          },
          load: 'member-read-states',
          routeKey: warmNavRouteKey,
          surface: 'chat',
          resolver: () =>
            resolveThreadRenderStage(
              'member-read-states-load',
              {
                conversationId: input.conversationId,
                debugRequestId: threadRenderRequestId,
                kind: conversation.kind,
              },
              () => getConversationMemberReadStates(input.conversationId),
            ),
        })
      : Promise.resolve([]),
    measureWarmNavServerLoad({
      details: {
        conversationId: input.conversationId,
        kind: conversation.kind,
      },
      load: 'participants',
      routeKey: warmNavRouteKey,
      surface: 'chat',
      resolver: () =>
        resolveThreadRenderStage(
          'participants-load',
          {
            conversationId: input.conversationId,
            debugRequestId: threadRenderRequestId,
            kind: conversation.kind,
          },
          () => getConversationParticipants(input.conversationId),
        ),
    }),
  ]);

  const { hasMoreOlder, messages } = threadHistorySnapshot;

  logThreadRenderCheckpoint('thread-history-loaded', {
    ...threadDeploymentMarker,
    conversationId: input.conversationId,
    debugRequestId: threadRenderRequestId,
    hasMoreOlder,
    kind: conversation.kind,
    messageCount: messages.length,
    oldestMessageSeq: threadHistorySnapshot.oldestMessageSeq,
  });
  logBrokenThreadHistoryProof('server:snapshot-loaded', {
    conversationId: input.conversationId,
    details: {
      ...threadDeploymentMarker,
      debugRequestId: threadRenderRequestId,
      hasMoreOlder,
      kind: conversation.kind,
      oldestMessageSeq: threadHistorySnapshot.oldestMessageSeq,
      summary: summarizeBrokenThreadHistorySnapshot({
        attachmentsByMessage: threadHistorySnapshot.attachmentsByMessage,
        conversationId: input.conversationId,
        messages: threadHistorySnapshot.messages,
      }),
    },
  });

  const availableUsers =
    conversation.kind === 'group' && isSettingsOpen && !isV1TestBypass
      ? await resolveThreadRenderStage(
          'available-users-load',
          {
            activeSpaceId,
            conversationId: input.conversationId,
            debugRequestId: threadRenderRequestId,
            kind: conversation.kind,
            userId: user.id,
          },
          () => getAvailableUsers(user.id, { spaceId: activeSpaceId }),
        )
      : [];

  const messageIds = messages.map((message) => message.id);
  const firstMessage = messages[0] ?? null;
  const lastMessage = messages[messages.length - 1] ?? null;
  const encryptedMessageIds = messages
    .filter((message) => isEncryptedDmMessage(message))
    .map((message) => message.id);
  const snapshotSenderProfiles = threadHistorySnapshot.senderProfiles;
  const snapshotSenderProfilesById = new Map(
    snapshotSenderProfiles.map((profile) => [profile.userId, profile] as const),
  );
  const supplementalSenderProfileIds = Array.from(
    new Set(
      [...participants.map((participant) => participant.userId), ...availableUsers.map((availableUser) => availableUser.userId)].filter(
        (userId) =>
          shouldHydrateChatSurfaceIdentity(
            snapshotSenderProfilesById.get(userId),
          ),
      ),
    ),
  );
  const supplementalSenderProfiles = supplementalSenderProfileIds.length
    ? await resolveThreadRenderStage(
        'sender-profiles-supplemental-load',
        {
          conversationId: input.conversationId,
          debugRequestId: threadRenderRequestId,
          kind: conversation.kind,
          participantCount: participants.length,
          requestedProfileCount: supplementalSenderProfileIds.length,
        },
        () => getMessageSenderProfiles(supplementalSenderProfileIds),
      )
    : [];
  const senderProfiles = [
    ...snapshotSenderProfiles,
    ...supplementalSenderProfiles,
  ];

  logThreadRenderCheckpoint('thread-row-mapping:started', {
    conversationId: input.conversationId,
    debugRequestId: threadRenderRequestId,
    kind: conversation.kind,
    messageCount: messages.length,
  });

  const reactionsByMessage = await resolveThreadRenderStage(
    'reaction-mapping',
    {
      conversationId: input.conversationId,
      debugRequestId: threadRenderRequestId,
      kind: conversation.kind,
      messageCount: messages.length,
      messagesWithReactionsCount: threadHistorySnapshot.reactionsByMessage.filter(
        (entry) => entry.reactions.length > 0,
      ).length,
      reactionGroupCount: threadHistorySnapshot.reactionsByMessage.reduce(
        (count, entry) => count + entry.reactions.length,
        0,
      ),
    },
    () =>
      new Map(
        threadHistorySnapshot.reactionsByMessage.map((entry) => [
          entry.messageId,
          entry.reactions,
        ] as const),
      ),
  );
  const reactionsByMessageEntries = messageIds.map((messageId) => ({
    messageId,
    reactions: reactionsByMessage.get(messageId) ?? [],
  }));
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
  const attachmentsByMessageId = new Map(
    threadHistorySnapshot.attachmentsByMessage.map((entry) => [
      entry.messageId,
      entry.attachments,
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

  await resolveThreadRenderStage(
    'attachment-voice-mapping',
    {
      conversationId: input.conversationId,
      debugRequestId: threadRenderRequestId,
      kind: conversation.kind,
      messageCount: messages.length,
      messagesWithAttachmentsCount: threadHistorySnapshot.attachmentsByMessage.filter(
        (entry) => entry.attachments.length > 0,
      ).length,
      totalAttachmentCount: threadHistorySnapshot.attachmentsByMessage.reduce(
        (count, entry) => count + entry.attachments.length,
        0,
      ),
      voiceAttachmentCount: threadHistorySnapshot.attachmentsByMessage.reduce(
        (count, entry) =>
          count +
          entry.attachments.filter((attachment) => attachment.isVoiceMessage)
            .length,
        0,
      ),
    },
    () => null,
  );

  await resolveThreadRenderStage(
    'encrypted-unavailable-mapping',
    {
      conversationId: input.conversationId,
      debugRequestId: threadRenderRequestId,
      encryptedEnvelopeCount: e2eeEnvelopesByMessage.size,
      encryptedHintCount: encryptedHistoryHintsByMessage.size,
      encryptedMessageCount: encryptedMessageIds.length,
      kind: conversation.kind,
      missingEnvelopeCount: encryptedMessageIds.filter(
        (messageId) => !e2eeEnvelopesByMessage.has(messageId),
      ).length,
      unavailableEncryptedCount: encryptedMessageIds.filter((messageId) => {
        const hint = encryptedHistoryHintsByMessage.get(messageId);
        return hint?.code === 'missing-envelope' || hint?.code === 'policy-blocked-history';
      }).length,
    },
    () => null,
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
      const historyClassification = classifyMissingEncryptedHistory({
        activeDeviceCreatedAtDate,
        currentUserId: user.id,
        currentUserJoinedAtDate,
        message,
      });

      return {
        availabilityClass: historyClassification.classification,
        backfillAttempted: false,
        backfillResult:
          historyClassification.classification ===
          'unexpected-current-device-envelope-missing'
            ? 'not-attempted-current-device-envelope-expected'
            : historyClassification.policyBlocked
              ? 'not-applicable-policy-blocked'
              : 'skipped-unsupported-v1-no-cross-device-recovery',
        committedHistoryState: 'present',
        currentDeviceAvailability: historyClassification.policyBlocked
          ? 'policy-blocked-history'
          : 'missing-envelope',
        currentDeviceRowId: e2eeEnvelopeHistory.activeDeviceRecordId ?? null,
        currentDeviceRowSelectionSource: e2eeEnvelopeHistory.selectionSource ?? null,
        envelopeFoundForCurrentDevice: false,
        expectedByDesign: historyClassification.expectedByDesign,
        memberJoinedAt: currentUserConversationJoinedAt,
        messageCreatedAt,
        messageDirection:
          message?.sender_id === user.id ? 'sent-by-current-user' : 'received',
        messageId,
        recoveryDisposition: historyClassification.policyBlocked
          ? 'policy-blocked'
          : 'not-supported-v1',
        sameUserNewDevice: historyClassification.sameUserNewDevice,
        suspiciousMissingEnvelope:
          historyClassification.suspiciousMissingEnvelope,
      };
    });
    const policyBlockedMessageIds = encryptedMessageIds.filter(
      (messageId) =>
        encryptedHistoryHintsByMessage.get(messageId)?.code ===
        'policy-blocked-history',
    );
    console.info('[dm-e2ee-history]', 'thread:envelope-availability', {
      conversationId: input.conversationId,
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
      missingEnvelopeCount: missingEnvelopeMessageIds.length,
      missingEnvelopeDiagnostics,
      missingEnvelopeMessageIds,
      policyBlockedCount: policyBlockedMessageIds.length,
      policyBlockedMessageIds,
      selectedActiveDeviceCreatedAt: e2eeEnvelopeHistory.activeDeviceCreatedAt ?? null,
      selectedActiveDeviceRowId: e2eeEnvelopeHistory.activeDeviceRecordId ?? null,
      selectedActiveDeviceSelectionSource: e2eeEnvelopeHistory.selectionSource ?? null,
      vercelUrl: threadDeploymentMarker.vercelUrl,
    });
  }

  const {
    currentUserDisplayLabel,
    directConversationDisplayTitle,
    directParticipantIdentity,
    groupMemberSummary,
    otherParticipants,
    senderIdentities,
    senderNames,
  } = await resolveThreadRenderStage(
    'shared-identity-derive',
    {
      conversationId: input.conversationId,
      debugRequestId: threadRenderRequestId,
      kind: conversation.kind,
      messageCount: messages.length,
      participantCount: participants.length,
      senderProfileCount: senderProfiles.length,
    },
    () => {
      const nextSenderNames = new Map<string, string>(
        senderProfiles.map((profile) => [
          profile.userId,
          resolvePublicIdentityLabel(profile, t.chat.unknownUser),
        ] as const),
      );
      const nextSenderIdentities = new Map<
        string,
        (typeof senderProfiles)[number]
      >(senderProfiles.map((profile) => [profile.userId, profile] as const));
      const nextOtherParticipants = participants.filter(
        (participant) => participant.userId !== user.id,
      );
      const nextOtherParticipantLabels = nextOtherParticipants.map((participant) =>
        resolvePublicIdentityLabel(
          nextSenderIdentities.get(participant.userId),
          t.chat.unknownUser,
        ),
      );
      const nextDirectParticipantIdentity = nextOtherParticipants[0]
        ? nextSenderIdentities.get(nextOtherParticipants[0].userId)
        : null;
      const nextConversationDisplayTitle = getConversationDisplayName({
        fallbackTitles: {
          group: language === 'ru' ? 'Новая группа' : 'New group',
        },
        kind: conversation.kind === 'group' ? conversation.kind : null,
        participantLabels:
          conversation.kind === 'group' ? nextOtherParticipantLabels : [],
        title: conversation.title,
      });
      const nextDirectConversationDisplayTitle =
        conversation.kind === 'dm'
          ? getDirectMessageDisplayName(
              nextOtherParticipantLabels,
              t.chat.unknownUser,
            )
          : nextConversationDisplayTitle;
      const nextCurrentUserDisplayLabel = resolvePublicIdentityLabel(
        nextSenderIdentities.get(user.id),
        t.chat.unknownUser,
      );
      const nextGroupMemberSummary =
        conversation.kind === 'group'
          ? formatGroupMemberSummary(
              participants.map((participant) => participant.userId),
              user.id,
              nextSenderNames,
              language,
              t,
            )
          : null;

      return {
        currentUserDisplayLabel: nextCurrentUserDisplayLabel,
        directConversationDisplayTitle: nextDirectConversationDisplayTitle,
        directParticipantIdentity: nextDirectParticipantIdentity,
        groupMemberSummary: nextGroupMemberSummary,
        otherParticipants: nextOtherParticipants,
        senderIdentities: nextSenderIdentities,
        senderNames: nextSenderNames,
      };
    },
  );

  const directParticipantStatus = resolveIdentityStatusParts(
    directParticipantIdentity,
  );
  const hasDirectParticipantStatusText = Boolean(directParticipantStatus.text);
  const hasDirectParticipantStatusEmojiOnly =
    Boolean(directParticipantStatus.emoji) && !hasDirectParticipantStatusText;
  const attachmentHelpText =
    language === 'ru' ? CHAT_ATTACHMENT_HELP_TEXT_RU : CHAT_ATTACHMENT_HELP_TEXT;
  const attachmentMaxSizeLabel = language === 'ru' ? 'До 10 МБ' : 'Up to 10 MB';
  const activeReplyTarget = await resolveThreadRenderStage(
    'reply-mapping',
    {
      conversationId: input.conversationId,
      debugRequestId: threadRenderRequestId,
      kind: conversation.kind,
      missingReplyTargetCount: messages.filter(
        (message) =>
          message.reply_to_message_id &&
          !messagesById.has(message.reply_to_message_id),
      ).length,
      missingReplyTargetSample: messages
        .filter(
          (message) =>
            message.reply_to_message_id &&
            !messagesById.has(message.reply_to_message_id),
        )
        .slice(0, 5)
        .map((message) => ({
          messageId: message.id,
          replyToMessageId: message.reply_to_message_id,
        })),
      replyReferenceCount: messages.filter((message) => Boolean(message.reply_to_message_id))
        .length,
      requestedReplyTargetId: input.query.replyToMessageId?.trim() || null,
    },
    () =>
      input.query.replyToMessageId
        ? messagesById.get(input.query.replyToMessageId) ?? null
        : null,
  );
  const activeReplyTargetAttachmentKind = activeReplyTarget
    ? resolveReplyTargetAttachmentKind(
        attachmentsByMessageId.get(activeReplyTarget.id) ?? [],
      )
    : null;
  const initialReplyTarget = activeReplyTarget
    ? {
        attachmentKind: activeReplyTargetAttachmentKind,
        body: activeReplyTarget.body,
        deletedAt: activeReplyTarget.deleted_at,
        id: activeReplyTarget.id,
        isEncrypted: isEncryptedDmMessage(activeReplyTarget),
        kind: activeReplyTarget.kind,
        senderId: activeReplyTarget.sender_id ?? null,
        senderLabel:
          senderNames.get(activeReplyTarget.sender_id ?? '') || t.chat.unknownUser,
      }
    : null;
  const activeEditMessageId = input.query.editMessageId?.trim() || null;
  const activeDeleteMessageId = input.query.deleteMessageId?.trim() || null;
  const currentUserGroupRole =
    conversation.kind === 'group'
      ? participants.find((participant) => participant.userId === user.id)?.role ??
        'member'
      : null;
  const groupJoinPolicy =
    conversation.kind === 'group'
      ? normalizeGroupConversationJoinPolicy(conversation.joinPolicy)
      : null;
  const canEditGroupIdentity =
    conversation.kind === 'group' &&
    canEditGroupConversationIdentity(currentUserGroupRole);
  const canManageGroupParticipants =
    conversation.kind === 'group' &&
    groupJoinPolicy !== null &&
    canAddParticipantsToGroupConversation(
      groupJoinPolicy,
      currentUserGroupRole,
    );
  const canDeleteDirectConversation =
    conversation.kind === 'dm' &&
    participants.some((participant) => participant.userId === user.id);
  const participantItems = participants.map((participant) => {
    const identity = senderIdentities.get(participant.userId);
    const label = resolvePublicIdentityLabel(identity, t.chat.unknownUser);

    return {
      canRemove:
        conversation.kind === 'group' &&
        canManageGroupParticipants &&
        !(
          participant.userId === user.id
        ) &&
        canRemoveParticipantFromGroupConversation(
          currentUserGroupRole,
          participant.role,
        ),
      identity,
      isCurrentUser: participant.userId === user.id,
      label,
      role: participant.role ?? 'member',
      roleLabel: formatParticipantRoleLabel(participant.role ?? 'member', t),
      userId: participant.userId,
    };
  });
  const mentionParticipants =
    conversation.kind === 'group'
      ? participantItems
          .filter((participant) => !participant.isCurrentUser)
          .map((participant) => ({
            label: participant.label,
            userId: participant.userId,
          }))
      : [];
  const activeParticipantUserIds = new Set(
    participants.map((participant) => participant.userId),
  );
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
      conversationId: input.conversationId,
      debugRequestId: threadRenderRequestId,
      dateFallbackUsed,
      daySeparatorFallbackUsed,
      encryptedRenderFallbackCount,
      envelopeCount: e2eeEnvelopesByMessage.size,
      firstMessageBodyType,
      firstMessageCreatedAtValid,
      firstMessageId: firstMessage?.id ?? null,
      gitCommitSha: threadDeploymentMarker.gitCommitSha,
      hasMoreOlder,
      historyWindowLimit: threadHistoryLimit,
      historyWindowSize: messages.length,
      kind: conversation.kind,
      lastMessageId: lastMessage?.id ?? null,
      messageCount: messages.length,
      metadataFallbackCount: threadMetadataFallbackCount,
      metadataFallbackUsed: threadMetadataFallbackCount > 0,
      missingEnvelopeCount: encryptedMessageIds.filter(
        (messageId) => !e2eeEnvelopesByMessage.has(messageId),
      ).length,
      policyBlockedCount: encryptedMessageIds.filter(
        (messageId) =>
          encryptedHistoryHintsByMessage.get(messageId)?.code ===
          'policy-blocked-history',
      ).length,
      statusFallbackCount: threadStatusFallbackCount,
      statusFallbackUsed: threadStatusFallbackCount > 0,
      unreadSeparatorFallbackUsed,
    });
  }

  logThreadRenderCheckpoint('final-thread-props-prepared', {
    ...threadDeploymentMarker,
    conversationId: input.conversationId,
    debugRequestId: threadRenderRequestId,
    hasActiveReplyTarget: Boolean(activeReplyTarget),
    kind: conversation.kind,
    messageCount: messages.length,
    participantCount: participants.length,
  });

  return {
    activeDeleteMessageId,
    activeEditMessageId,
    activeSpaceId,
    attachmentHelpText,
    attachmentMaxSizeLabel,
    availableParticipantsToAdd,
    canDeleteDirectConversation,
    canEditGroupIdentity,
    canManageGroupParticipants,
    conversation,
    currentUserDisplayLabel,
    currentUserGroupRole,
    currentUserId: user.id,
    directConversationDisplayTitle,
    directParticipantIdentity,
    directParticipantStatus,
    encryptedDmEnabled,
    firstMessage,
    groupJoinPolicy,
    groupMemberSummary,
    hasDirectParticipantStatusEmojiOnly,
    hasDirectParticipantStatusText,
    hasMoreOlder,
    hasSettingsSavedState,
    initialReplyTarget,
    isSettingsOpen,
    language,
    lastMessage,
    latestVisibleMessageSeq,
    mentionParticipants,
    messageIds,
    messages,
    otherParticipantReadState,
    otherParticipants,
    otherParticipantUserId,
    participantItems,
    participants,
    reactionsByMessageEntries,
    readState,
    t,
    threadClientDiagnostics,
    threadHistoryLimit,
    threadHistorySnapshot,
    visibleRouteError,
    visibleSettingsError,
    warmNavRouteKey,
  };
}
