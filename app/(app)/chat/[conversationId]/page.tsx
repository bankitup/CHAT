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
  type MessageSenderProfile,
} from '@/modules/messaging/data/server';
import {
  canAddParticipantsToGroupConversation,
  canEditGroupConversationIdentity,
  canRemoveParticipantFromGroupConversation,
  normalizeGroupConversationJoinPolicy,
} from '@/modules/messaging/group-policy';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import { ActiveChatRealtimeSync } from '@/modules/messaging/realtime/active-chat-sync';
import {
  WarmNavReadyProbe,
} from '@/modules/messaging/performance/warm-nav-client';
import {
  measureWarmNavServerLoad,
  recordWarmNavServerRender,
} from '@/modules/messaging/performance/warm-nav-server';
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
import {
  IdentityStatusInline,
  hasIdentityStatus,
  resolveIdentityStatusParts,
} from '@/modules/messaging/ui/identity-status';
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
  updateConversationNotificationLevelAction,
} from './actions';
import { ConversationPresenceStatus } from './conversation-presence-status';
import { ChatHeaderAvatarPreviewTrigger } from './chat-header-avatar-preview-trigger';
import { ComposerKeyboardOffset } from './composer-keyboard-offset';
import {
  DmThreadClientSubtree,
  DmThreadPresenceScope,
} from './dm-thread-client-diagnostics';
import { DmChatDeleteConfirmForm } from './dm-chat-delete-confirm-form';
import { DmThreadHydrationProbe } from './dm-thread-hydration-probe';
import {
  resolveReplyTargetAttachmentKind,
} from './dm-reply-target-snippet';
import { ThreadComposerRuntime } from './thread-composer-runtime';
import { ThreadHistoryViewport } from './thread-history-viewport';
import { GroupChatSettingsForm } from './group-chat-settings-form';
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

function shouldHydrateChatSurfaceIdentity(
  profile: MessageSenderProfile | undefined,
) {
  return !profile?.avatarPath;
}

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

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
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
  level: 'info' | 'error' = 'info',
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
  kind: string | null;
  content_mode?: string | null;
  deleted_at?: string | null;
}) {
  return (
    (value.kind === 'text' || value.kind === 'attachment') &&
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
          userEmail: user.email ?? null,
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
      ].filter((value) => value && looksLikeUuid(value)),
    ),
  );
  const requestedHistoryTargetWindowSize =
    requestedHistoryTargetMessageIds.length > 0
      ? await getConversationHistoryWindowSizeForMessageTargets({
          conversationId,
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
    `conversation=${conversationId}`,
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
    conversationId,
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
        conversationId,
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
            conversationId,
            debugRequestId: threadRenderRequestId,
            kind: conversation.kind,
            requestedHistoryTargetMessageCount:
              requestedHistoryTargetMessageIds.length,
            threadHistoryLimit,
          },
          () =>
            getConversationHistorySnapshot({
              conversationId,
              debugRequestId: threadRenderRequestId,
              limit: threadHistoryLimit,
              userId: user.id,
            }),
        ),
    }),
    measureWarmNavServerLoad({
      details: {
        conversationId,
        userId: user.id,
      },
      load: 'read-state',
      routeKey: warmNavRouteKey,
      surface: 'chat',
      resolver: () =>
        resolveThreadRenderStage(
          'read-state-load',
          {
            conversationId,
            debugRequestId: threadRenderRequestId,
            userId: user.id,
          },
          () => getConversationReadState(conversationId, user.id),
        ),
    }),
    conversation.kind === 'dm'
      ? measureWarmNavServerLoad({
          details: {
            conversationId,
            kind: conversation.kind,
          },
          load: 'member-read-states',
          routeKey: warmNavRouteKey,
          surface: 'chat',
          resolver: () =>
            resolveThreadRenderStage(
              'member-read-states-load',
              {
                conversationId,
                debugRequestId: threadRenderRequestId,
                kind: conversation.kind,
              },
              () => getConversationMemberReadStates(conversationId),
            ),
        })
      : Promise.resolve([]),
    measureWarmNavServerLoad({
      details: {
        conversationId,
        kind: conversation.kind,
      },
      load: 'participants',
      routeKey: warmNavRouteKey,
      surface: 'chat',
      resolver: () =>
        resolveThreadRenderStage(
          'participants-load',
          {
            conversationId,
            debugRequestId: threadRenderRequestId,
            kind: conversation.kind,
          },
          () => getConversationParticipants(conversationId),
        ),
    }),
  ]);
  const { hasMoreOlder, messages } = threadHistorySnapshot;
  logThreadRenderCheckpoint('thread-history-loaded', {
    ...threadDeploymentMarker,
    conversationId,
    debugRequestId: threadRenderRequestId,
    hasMoreOlder,
    kind: conversation.kind,
    messageCount: messages.length,
    oldestMessageSeq: threadHistorySnapshot.oldestMessageSeq,
  });
  // Temporary v1 unblocker: do not trigger space_members-backed available user lookup in TEST bypass flow.
  const availableUsers =
    conversation.kind === 'group' && isSettingsOpen && !isV1TestBypass
      ? await resolveThreadRenderStage(
          'available-users-load',
          {
            activeSpaceId,
            conversationId,
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
    [
      ...new Set([
        ...participants.map((participant) => participant.userId),
        ...availableUsers.map((availableUser) => availableUser.userId),
      ]),
    ].filter((userId) =>
      shouldHydrateChatSurfaceIdentity(
        snapshotSenderProfilesById.get(userId),
      ),
    ),
  );
  const supplementalSenderProfiles = supplementalSenderProfileIds.length
    ? await resolveThreadRenderStage(
        'sender-profiles-supplemental-load',
        {
          conversationId,
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
    conversationId,
    debugRequestId: threadRenderRequestId,
    kind: conversation.kind,
    messageCount: messages.length,
  });
  const reactionsByMessage = await resolveThreadRenderStage(
    'reaction-mapping',
    {
      conversationId,
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
      conversationId,
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
      conversationId,
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
        currentDeviceRowId: e2eeEnvelopeHistory.activeDeviceRecordId ?? null,
        currentDeviceRowSelectionSource: e2eeEnvelopeHistory.selectionSource ?? null,
        currentDeviceAvailability: historyClassification.policyBlocked
          ? 'policy-blocked-history'
          : 'missing-envelope',
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
      conversationId,
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
      const nextSenderIdentities = new Map<string, (typeof senderProfiles)[number]>(
        senderProfiles.map((profile) => [profile.userId, profile] as const),
      );
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
        kind: conversation.kind === 'group' ? conversation.kind : null,
        title: conversation.title,
        participantLabels:
          conversation.kind === 'group' ? nextOtherParticipantLabels : [],
        fallbackTitles: {
          group: language === 'ru' ? 'Новая группа' : 'New group',
        },
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
  const directParticipantStatus = resolveIdentityStatusParts(directParticipantIdentity);
  const hasDirectParticipantStatusText = Boolean(directParticipantStatus.text);
  const hasDirectParticipantStatusEmojiOnly =
    Boolean(directParticipantStatus.emoji) && !hasDirectParticipantStatusText;
  const attachmentHelpText =
    language === 'ru'
      ? 'Поддерживаются фото, документы, ZIP-архивы и обычные аудиофайлы до 10 МБ.'
      : CHAT_ATTACHMENT_HELP_TEXT;
  const attachmentMaxSizeLabel = language === 'ru' ? 'До 10 МБ' : 'Up to 10 MB';
  const replyMessageIds = messages.flatMap((message) =>
    message.reply_to_message_id ? [message.reply_to_message_id] : [],
  );
  const activeReplyTarget = await resolveThreadRenderStage(
    'reply-mapping',
    {
      conversationId,
      debugRequestId: threadRenderRequestId,
      kind: conversation.kind,
      missingReplyTargetCount: replyMessageIds.filter(
        (replyMessageId) => !messagesById.has(replyMessageId),
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
      replyReferenceCount: replyMessageIds.length,
      requestedReplyTargetId: query.replyToMessageId?.trim() || null,
    },
    () =>
      query.replyToMessageId
        ? messagesById.get(query.replyToMessageId) ?? null
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
  const activeEditMessageId = query.editMessageId?.trim() || null;
  const activeDeleteMessageId = query.deleteMessageId?.trim() || null;
  const currentUserGroupRole =
    conversation.kind === 'group'
      ? participants.find((participant) => participant.userId === user.id)?.role ?? 'member'
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
  logThreadRenderCheckpoint('final-thread-props-prepared', {
    ...threadDeploymentMarker,
    conversationId,
    debugRequestId: threadRenderRequestId,
    hasActiveReplyTarget: Boolean(activeReplyTarget),
    kind: conversation.kind,
    messageCount: messages.length,
    participantCount: participants.length,
  });

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
      <WarmNavReadyProbe
        details={{
          isSettingsOpen,
          kind: conversation.kind,
          messageCount: messages.length,
          spaceId: activeSpaceId,
        }}
        routeKey={warmNavRouteKey}
        routePath={`/chat/${conversationId}`}
        surface="chat"
      />
      {conversation.kind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="active-chat-realtime-sync"
        >
          <ActiveChatRealtimeSync
            conversationId={conversationId}
            currentUserId={user.id}
            messageIds={messageIds}
          />
        </DmThreadClientSubtree>
      ) : (
        <ActiveChatRealtimeSync
          conversationId={conversationId}
          currentUserId={user.id}
          messageIds={messageIds}
        />
      )}
      <ThreadLiveStateHydrator
        conversationId={conversationId}
        currentUserReadSeq={readState.lastReadMessageSeq}
        otherParticipantReadSeq={otherParticipantReadState?.lastReadMessageSeq ?? null}
        reactionsByMessage={reactionsByMessageEntries}
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
        <section className="card chat-header-card chat-header-shell">
          <Link
            aria-label={t.chat.backToChats}
            className="back-arrow-link conversation-back chat-header-back"
            href={withSpaceParam('/inbox', activeSpaceId)}
          >
            <span aria-hidden="true">←</span>
          </Link>

          <Link
            aria-label={t.chat.openInfoAria(directConversationDisplayTitle)}
            className="chat-header-main-link"
            href={withSpaceParam(`/chat/${conversationId}/settings`, activeSpaceId)}
            prefetch={false}
          >
            <div className="stack chat-header-copy">
              {conversation.kind === 'group' ? (
                <>
                  <h1 className="conversation-screen-title">
                    {directConversationDisplayTitle}
                  </h1>
                  <p className="muted chat-member-summary">{groupMemberSummary}</p>
                </>
              ) : hasDirectParticipantStatusText ? (
                <>
                  <span className="sr-only">{directConversationDisplayTitle}</span>
                  <span className="chat-header-status-bubble">
                    <IdentityStatusInline
                      className="chat-header-status chat-header-status-bubble-copy"
                      identity={directParticipantIdentity}
                    />
                  </span>
                </>
              ) : (
                <>
                  <h1 className="conversation-screen-title chat-header-title-with-status">
                    <span className="chat-header-title-label">
                      {directConversationDisplayTitle}
                    </span>
                    {hasDirectParticipantStatusEmojiOnly ? (
                      <span
                        aria-hidden="true"
                        className="chat-header-title-emoji"
                      >
                        {directParticipantStatus.emoji}
                      </span>
                    ) : null}
                  </h1>
                  {otherParticipants[0] ? (
                    <div className="chat-header-meta">
                      <DmThreadClientSubtree
                        conversationId={conversationId}
                        {...threadClientDiagnostics}
                        fallback={null}
                        surface="conversation-presence-status"
                      >
                        <ConversationPresenceStatus language={language} />
                      </DmThreadClientSubtree>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Link>

          <div className="chat-header-avatar-slot">
            <ChatHeaderAvatarPreviewTrigger
              closeLabel={t.chat.closeAvatarPreview}
              conversationKind={conversation.kind === 'group' ? 'group' : 'dm'}
              groupAvatarPath={conversation.avatarPath}
              openLabel={t.chat.openAvatarPreviewAria(directConversationDisplayTitle)}
              participant={directParticipantIdentity}
              title={directConversationDisplayTitle}
            />
          </div>
        </section>
      </section>

      {visibleRouteError && !isSettingsOpen ? (
        <p className="notice notice-error">{visibleRouteError}</p>
      ) : null}

      <section className="chat-main">
        <section className="message-thread" id="message-thread-scroll">
          <ThreadHistoryViewport
            activeDeleteMessageId={activeDeleteMessageId}
            activeEditMessageId={activeEditMessageId}
            activeSpaceId={activeSpaceId}
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

        <ThreadComposerRuntime
          accept={CHAT_ATTACHMENT_ACCEPT}
          attachmentHelpText={attachmentHelpText}
          attachmentMaxSizeBytes={CHAT_ATTACHMENT_MAX_SIZE_BYTES}
          attachmentMaxSizeLabel={attachmentMaxSizeLabel}
          conversationId={conversationId}
          conversationKind={conversation.kind === 'group' ? 'group' : 'dm'}
          currentUserId={user.id}
          currentUserLabel={currentUserDisplayLabel}
          encryptedDmEnabled={encryptedDmEnabled}
          initialReplyTarget={initialReplyTarget}
          language={language}
          latestVisibleMessageSeq={latestVisibleMessageSeq}
          mentionParticipants={mentionParticipants}
          mentionSuggestionsLabel={t.chat.mentionSuggestions}
          messagePlaceholder={t.chat.messagePlaceholder}
          recipientUserId={otherParticipantUserId}
          threadClientDiagnostics={threadClientDiagnostics}
        />
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
            prefetch={false}
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
                prefetch={false}
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
                  {conversation.kind === 'group' ? (
                    <p className="muted conversation-info-subtitle">
                      {groupMemberSummary}
                    </p>
                  ) : hasIdentityStatus(directParticipantIdentity) ? (
                    <IdentityStatusInline
                      className="conversation-info-status"
                      identity={directParticipantIdentity}
                    />
                  ) : (
                    <p className="muted conversation-info-subtitle">
                      {t.chat.directChat}
                    </p>
                  )}
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
              {conversation.kind === 'group' ? (
                <div className="conversation-info-row">
                  <dt className="conversation-info-label">{t.chat.groupPrivacy}</dt>
                  <dd className="conversation-info-value">
                    {groupJoinPolicy === 'open'
                      ? t.chat.groupPrivacyOpen
                      : t.chat.groupPrivacyClosed}
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
                        <div className="conversation-member-title-row">
                          <span className="user-label">
                            {participant.label}
                          </span>
                          <IdentityStatusInline
                            className="conversation-member-status"
                            identity={participant.identity}
                          />
                        </div>
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
                    canRemoveParticipantFromGroupConversation(
                      currentUserGroupRole,
                      participant.role,
                    ) ? (
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
                  {canEditGroupIdentity ? (
                    <GroupChatSettingsForm
                      conversationId={conversationId}
                      currentUserId={user.id}
                      defaultAvatarPath={conversation.avatarPath}
                      defaultJoinPolicy={groupJoinPolicy ?? 'closed'}
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
                        avatarSchemaRequired: t.chat.avatarSchemaRequired,
                        avatarStorageUnavailable: t.chat.avatarStorageUnavailable,
                        tapPhotoToChange: t.settings.tapPhotoToChange,
                        avatarEditorHint: t.settings.avatarEditorHint,
                        avatarEditorZoom: t.settings.avatarEditorZoom,
                        avatarEditorApply: t.settings.avatarEditorApply,
                        avatarEditorPreparing: t.settings.avatarEditorPreparing,
                        avatarEditorLoadFailed: t.settings.avatarEditorLoadFailed,
                        avatarEditorApplyBeforeSave:
                          t.settings.avatarEditorApplyBeforeSave,
                        privacyTitle: t.chat.groupPrivacy,
                        privacyNote: t.chat.groupPrivacyNote,
                        privacyOpen: t.chat.groupPrivacyOpen,
                        privacyOpenNote: t.chat.groupPrivacyOpenNote,
                        privacyClosed: t.chat.groupPrivacyClosed,
                        privacyClosedNote: t.chat.groupPrivacyClosedNote,
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
                              {t.chat.adminOnly}
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="stack conversation-settings-subsection conversation-participant-manager">
                    <div className="stack conversation-settings-panel-copy">
                      <h4 className="conversation-settings-subtitle">{t.chat.addPeople}</h4>
                      <p className="muted conversation-settings-note">
                        {groupJoinPolicy === 'open'
                          ? t.chat.groupOpenMembersCanAdd
                          : t.chat.groupClosedAdminsOnly}
                      </p>
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
                                  <span className="stack user-copy">
                                    <span className="user-label">{participant.label}</span>
                                    <IdentityStatusInline
                                      className="user-status-inline"
                                      identity={participant}
                                    />
                                  </span>
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

    </section>
  );
}
