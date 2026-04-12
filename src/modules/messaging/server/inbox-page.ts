import 'server-only';

import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getArchivedConversations,
  getConversationDisplayName,
  getConversationParticipantIdentities,
  getDirectMessageDisplayName,
  getInboxConversations,
  getInboxConversationsStable,
  type InboxConversation,
} from '@/modules/messaging/data/conversation-read-server';
import {
  loadArchivedConversationsForSsr,
  loadInboxConversationsForSsr,
} from '@/modules/messaging/data/inbox-ssr-stability';
import { getInboxDisplayPreviewText } from '@/modules/messaging/e2ee/inbox-policy';
import {
  resolveInboxInitialFilter,
  type InboxSectionPreferences,
} from '@/modules/messaging/inbox/preferences';
import { getInboxSectionPreferences } from '@/modules/messaging/inbox/preferences-server';
import {
  measureWarmNavServerLoad,
  recordWarmNavServerRender,
} from '@/modules/messaging/performance/warm-nav-server';
import { resolveMessagingRouteSpaceContextForUser } from '@/modules/messaging/server/route-context';
import { resolvePublicIdentityLabel } from '@/modules/profile/ui/identity-label';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';

export type MessengerInboxPageQuery = {
  create?: string;
  createMode?: string;
  error?: string;
  filter?: string;
  q?: string;
  space?: string;
  view?: string;
};

type InboxView = 'main' | 'archived';
type MessengerCreateMode = 'dm' | 'group';

type ConversationListItem = {
  conversationId: string;
  groupAvatarPath: string | null;
  hasUnread: boolean;
  isGroupConversation: boolean;
  latestMessageContentMode: string | null;
  latestMessageDeletedAt: string | null;
  latestMessageId: string | null;
  metaLabels: Array<{
    label: string;
    tone: 'default' | 'archived';
  }>;
  participantLabels: string[];
  participants: Array<{
    avatarPath?: string | null;
    displayName: string | null;
    userId: string;
  }>;
  preview: string | null;
  title: string;
};

function normalizeView(value: string | undefined): InboxView {
  return value === 'archived' ? 'archived' : 'main';
}

function normalizeCreateMode(value: string | undefined): MessengerCreateMode {
  return value === 'group' ? 'group' : 'dm';
}

export async function loadMessengerInboxPageData(query: MessengerInboxPageQuery) {
  const diagnosticsEnabled = process.env.CHAT_DEBUG_INBOX_SSR === '1';
  const diagnosticsLabel = '[inbox-ssr]';
  const logDiagnostics = (stage: string, details?: Record<string, unknown>) => {
    if (!diagnosticsEnabled) {
      return;
    }

    if (details) {
      console.info(diagnosticsLabel, stage, details);
      return;
    }

    console.info(diagnosticsLabel, stage);
  };

  logDiagnostics('start', {
    filter: query.filter ?? 'all',
    hasSpace: Boolean(query.space?.trim()),
    view: query.view ?? 'main',
  });

  const activeView = normalizeView(query.view);
  const isCreateOpen = query.create === 'open';
  const initialCreateMode = normalizeCreateMode(query.createMode);
  const [user, language, inboxPreferences] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
    getInboxSectionPreferences(),
  ]);
  const activeFilter = resolveInboxInitialFilter(query.filter, inboxPreferences);

  if (!user) {
    logDiagnostics('no-user');
    return null;
  }

  logDiagnostics('auth-ok');

  const spaceContext = await resolveMessagingRouteSpaceContextForUser({
    requestedSpaceId: query.space,
    source: 'inbox-page',
    userEmail: user.email ?? null,
    userId: user.id,
  });

  if (spaceContext.kind === 'requested_space_invalid') {
    logDiagnostics('invalid-space-redirect');
    redirect('/spaces');
  }

  if (spaceContext.kind !== 'resolved') {
    logDiagnostics('no-active-space-notFound');
    redirect('/spaces');
  }

  const activeSpaceId = spaceContext.context.activeSpaceId;
  const activeSpaceName = spaceContext.context.activeSpaceName;
  const canManageMembers =
    spaceContext.context.platformAccess.governance.canManageMembers;
  const isMessengerProductSpace =
    spaceContext.context.productAccess.messenger.isPrimaryProfile;

  if (spaceContext.context.isV1TestBypass) {
    logDiagnostics('active-space-bypass-v1-test', {
      spaceId: activeSpaceId,
    });
  }

  logDiagnostics('active-space-ok', { hasActiveSpace: true });

  const warmNavRouteKey = [
    `space=${activeSpaceId}`,
    `view=${activeView}`,
    `filter=${activeFilter}`,
    `create=${isCreateOpen ? '1' : '0'}`,
    `query=${query.q?.trim() ? '1' : '0'}`,
  ].join('|');

  recordWarmNavServerRender({
    details: {
      canManageMembers,
      isMessengerSpace: isMessengerProductSpace,
    },
    routeKey: warmNavRouteKey,
    surface: 'inbox',
  });

  const t = getTranslations(language);
  const visibleError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'inbox'),
        language,
        rawMessage: query.error,
      })
    : null;

  const emptyArchivedConversations =
    [] as Awaited<ReturnType<typeof getArchivedConversations>>;

  const archivedConversationsPromise = measureWarmNavServerLoad({
    details: {
      activeView,
      userId: user.id,
    },
    load: 'archived-conversations',
    routeKey: warmNavRouteKey,
    surface: 'inbox',
    resolver: () =>
      loadArchivedConversationsForSsr({
        emptyValue: emptyArchivedConversations,
        loadArchived: async () => {
          const value = await getArchivedConversations(user.id, {
            spaceId: activeSpaceId,
          });
          logDiagnostics('loader:archived-ok', { count: value.length });
          return value;
        },
        view: activeView,
      }),
  }).catch((error) => {
    logDiagnostics('loader:archived-error', {
      message: error instanceof Error ? error.message : String(error),
    });
    logDiagnostics('loader:archived-fallback-empty');
    return emptyArchivedConversations;
  });

  if (activeView !== 'archived') {
    logDiagnostics('loader:archived-skip-main-view');
  }

  const [conversations, archivedConversations]: [
    InboxConversation[],
    InboxConversation[],
  ] = await Promise.all([
    measureWarmNavServerLoad({
      details: {
        userId: user.id,
      },
      load: 'main-conversations',
      routeKey: warmNavRouteKey,
      surface: 'inbox',
      resolver: () =>
        loadInboxConversationsForSsr({
          loadPrecise: () =>
            getInboxConversations(user.id, { spaceId: activeSpaceId }),
          loadStable: () =>
            getInboxConversationsStable(user.id, { spaceId: activeSpaceId }),
          view: 'main',
        }),
    })
      .then((value) => {
        logDiagnostics('loader:inbox-ok', { count: value.length });
        return value;
      })
      .catch((error) => {
        logDiagnostics('loader:inbox-error', {
          message: error instanceof Error ? error.message : String(error),
        });
        logDiagnostics('loader:inbox-fallback-empty');
        return [] as Awaited<ReturnType<typeof getInboxConversations>>;
      }),
    archivedConversationsPromise,
  ]);

  logDiagnostics('loader:all-ok');

  const allVisibleConversations = [...conversations, ...archivedConversations];
  const participantIdentities = await measureWarmNavServerLoad({
    details: {
      conversationCount: allVisibleConversations.length,
    },
    load: 'participant-identities',
    routeKey: warmNavRouteKey,
    surface: 'inbox',
    resolver: () =>
      getConversationParticipantIdentities(
        allVisibleConversations.map((conversation) => conversation.conversationId),
      ),
  });

  logDiagnostics('loader:participant-identities-ok', {
    count: participantIdentities.length,
  });

  const participantIdentitiesByConversation = participantIdentities.reduce(
    (map, identity) => {
      const existing = map.get(identity.conversationId) ?? [];
      existing.push(identity);
      map.set(identity.conversationId, existing);
      return map;
    },
    new Map<string, (typeof participantIdentities)[number][]>(),
  );

  const visibleKnownParticipantsByUserId = new Map<
    string,
    {
      avatarPath?: string | null;
      displayName: string | null;
      emailLocalPart?: string | null;
      label: string;
      statusEmoji?: string | null;
      statusText?: string | null;
      userId: string;
      username?: string | null;
    }
  >();

  for (const participant of participantIdentities) {
    if (!participant.userId || participant.userId === user.id) {
      continue;
    }

    const existingParticipant = visibleKnownParticipantsByUserId.get(
      participant.userId,
    );

    visibleKnownParticipantsByUserId.set(participant.userId, {
      avatarPath: participant.avatarPath ?? existingParticipant?.avatarPath ?? null,
      displayName:
        participant.displayName ?? existingParticipant?.displayName ?? null,
      emailLocalPart:
        participant.emailLocalPart ?? existingParticipant?.emailLocalPart ?? null,
      label: resolvePublicIdentityLabel(participant, t.chat.unknownUser),
      statusEmoji: participant.statusEmoji ?? existingParticipant?.statusEmoji ?? null,
      statusText: participant.statusText ?? existingParticipant?.statusText ?? null,
      userId: participant.userId,
      username: participant.username ?? existingParticipant?.username ?? null,
    });
  }

  const visibleExistingDmPartnerUserIds = new Set(
    allVisibleConversations.flatMap((conversation) => {
      if (conversation.kind !== 'dm') {
        return [];
      }

      const participants =
        participantIdentitiesByConversation.get(conversation.conversationId) ?? [];

      return participants
        .map((participant) => participant.userId)
        .filter((participantUserId) => participantUserId && participantUserId !== user.id);
    }),
  );

  const availableUserEntries = Array.from(visibleKnownParticipantsByUserId.values());
  const availableDmUserEntries = availableUserEntries.filter(
    (availableUser) => !visibleExistingDmPartnerUserIds.has(availableUser.userId),
  );

  const buildConversationItems = (input: InboxConversation[]) =>
    input.map((conversation) => {
      const participantOptions =
        participantIdentitiesByConversation.get(conversation.conversationId) ?? [];
      const otherParticipants = participantOptions.filter(
        (participant) => participant.userId !== user.id,
      );
      const primaryOtherParticipant = otherParticipants[0] ?? null;
      const otherParticipantLabels = otherParticipants.map((participant) =>
        resolvePublicIdentityLabel(participant, t.chat.unknownUser),
      );
      const isGroupConversation = conversation.kind === 'group';
      const title = isGroupConversation
        ? getConversationDisplayName({
            fallbackTitles: {
              dm: language === 'ru' ? 'Новый чат' : 'New chat',
              group: language === 'ru' ? 'Новая группа' : 'New group',
            },
            kind: conversation.kind ?? null,
            participantLabels: otherParticipantLabels,
            title: conversation.title,
          })
        : getDirectMessageDisplayName(otherParticipantLabels, t.chat.unknownUser);
      const preview = getInboxDisplayPreviewText(
        conversation,
        {
          attachment: t.chat.attachment,
          audio: t.chat.audio,
          deletedMessage: t.chat.deletedMessage,
          encryptedMessage: t.chat.encryptedMessage,
          file: t.chat.file,
          image: t.chat.photo,
          newEncryptedMessage: t.chat.newEncryptedMessage,
          newMessage: t.chat.newMessage,
          voiceMessage: t.chat.voiceMessage,
        },
        inboxPreferences.previewMode,
      );
      const hasUnread = conversation.unreadCount > 0;
      const metaLabels = [
        ...(isGroupConversation
          ? [{ label: t.inbox.metaGroup, tone: 'default' as const }]
          : []),
        ...(conversation.hiddenAt
          ? [{ label: t.inbox.metaArchived, tone: 'archived' as const }]
          : []),
      ];

      return {
        conversationId: conversation.conversationId,
        groupAvatarPath: conversation.avatarPath,
        hasUnread,
        isGroupConversation,
        latestMessageContentMode: conversation.latestMessageContentMode,
        latestMessageDeletedAt: conversation.latestMessageDeletedAt,
        latestMessageId: conversation.latestMessageId,
        metaLabels,
        participantLabels: otherParticipantLabels,
        participants: primaryOtherParticipant ? [primaryOtherParticipant] : [],
        preview,
        title,
      } satisfies ConversationListItem;
    });

  const buildLiveSummaries = (input: InboxConversation[]) =>
    input.map((conversation) => ({
      conversationId: conversation.conversationId,
      createdAt: conversation.createdAt,
      hiddenAt: conversation.hiddenAt,
      lastMessageAt: conversation.lastMessageAt,
      lastReadAt: conversation.lastReadAt,
      lastReadMessageSeq: conversation.lastReadMessageSeq,
      latestMessageAttachmentKind: conversation.latestMessageAttachmentKind,
      latestMessageBody: conversation.latestMessageBody,
      latestMessageContentMode: conversation.latestMessageContentMode,
      latestMessageDeletedAt: conversation.latestMessageDeletedAt,
      latestMessageId: conversation.latestMessageId,
      latestMessageKind: conversation.latestMessageKind,
      latestMessageSenderId: conversation.latestMessageSenderId,
      latestMessageSeq: conversation.latestMessageSeq,
      unreadCount: conversation.unreadCount,
    }));

  const mainConversationItems = buildConversationItems(conversations);
  const archivedConversationItems = buildConversationItems(archivedConversations);
  const mainSummaries = buildLiveSummaries(conversations);
  const archivedSummaries = buildLiveSummaries(archivedConversations);
  const allConversationIds = Array.from(
    new Set(allVisibleConversations.map((conversation) => conversation.conversationId)),
  );

  return {
    activeFilter,
    activeSpaceId,
    activeSpaceName,
    activeView,
    allConversationIds,
    archivedConversationItems,
    archivedSummaries,
    availableDmUserEntries,
    availableUserEntries,
    canManageMembers,
    initialCreateMode,
    inboxPreferences: inboxPreferences as InboxSectionPreferences,
    isCreateOpen,
    isMessengerProductSpace,
    language,
    mainConversationItems,
    mainSummaries,
    userId: user.id,
    visibleError,
    warmNavRouteKey,
  };
}
