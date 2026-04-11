import { getRequestViewer } from '@/lib/request-context/server';
import {
  getTranslations,
} from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getInboxDisplayPreviewText,
} from '@/modules/messaging/e2ee/inbox-policy';
import {
  getInboxSectionPreferences,
} from '@/modules/messaging/inbox/preferences-server';
import {
  resolveInboxInitialFilter,
} from '@/modules/messaging/inbox/preferences';
import {
  getArchivedConversations,
  getConversationDisplayName,
  getDirectMessageDisplayName,
  getConversationParticipantIdentities,
  getInboxConversations,
  getInboxConversationsStable,
  type InboxConversation,
} from '@/modules/messaging/data/server';
import {
  loadArchivedConversationsForSsr,
  loadInboxConversationsForSsr,
} from '@/modules/messaging/data/inbox-ssr-stability';
import {
  WarmNavReadyProbe,
} from '@/modules/messaging/performance/warm-nav-client';
import {
  measureWarmNavServerLoad,
  recordWarmNavServerRender,
} from '@/modules/messaging/performance/warm-nav-server';
import {
  resolvePublicIdentityLabel,
} from '@/modules/messaging/ui/identity-label';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import {
  resolveMessagingRouteSpaceContextForUser,
} from '@/modules/messaging/server/route-context';
import { InboxRealtimeSync } from '@/modules/messaging/realtime/inbox-sync';
import { InboxFilterableContent } from './inbox-filterable-content';
import { redirect } from 'next/navigation';
import {
  restoreConversationAction,
} from './actions';
import type { NewChatMode } from './new-chat-sheet';

type InboxPageProps = {
  searchParams: Promise<{
    create?: string;
    createMode?: string;
    error?: string;
    filter?: string;
    q?: string;
    space?: string;
    view?: string;
  }>;
};

type InboxView = 'main' | 'archived';

type ConversationListItem = {
  conversationId: string;
  isGroupConversation: boolean;
  title: string;
  groupAvatarPath: string | null;
  preview: string | null;
  latestMessageId: string | null;
  latestMessageContentMode: string | null;
  latestMessageDeletedAt: string | null;
  metaLabels: Array<{
    label: string;
    tone: 'default' | 'archived';
  }>;
  participants: Array<{
    userId: string;
    displayName: string | null;
    avatarPath?: string | null;
  }>;
  participantLabels: string[];
  hasUnread: boolean;
};

function normalizeView(value: string | undefined): InboxView {
  return value === 'archived' ? 'archived' : 'main';
}

function normalizeCreateMode(value: string | undefined): NewChatMode {
  return value === 'group' ? 'group' : 'dm';
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
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

  const query = await searchParams;
  logDiagnostics('start', {
    hasSpace: Boolean(query.space?.trim()),
    filter: query.filter ?? 'all',
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
        view: activeView,
        emptyValue: emptyArchivedConversations,
        loadArchived: async () => {
          const value = await getArchivedConversations(user.id, {
            spaceId: activeSpaceId,
          });
          logDiagnostics('loader:archived-ok', { count: value.length });
          return value;
        },
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
          view: 'main',
          loadPrecise: () =>
            getInboxConversations(user.id, { spaceId: activeSpaceId }),
          loadStable: () =>
            getInboxConversationsStable(user.id, { spaceId: activeSpaceId }),
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
  // Seed create-chat from identities the inbox already resolved for visible
  // conversations, then let the sheet hydrate any missing space members later.
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
            kind: conversation.kind ?? null,
            title: conversation.title,
            participantLabels: otherParticipantLabels,
            fallbackTitles: {
              dm: language === 'ru' ? 'Новый чат' : 'New chat',
              group: language === 'ru' ? 'Новая группа' : 'New group',
            },
          })
        : getDirectMessageDisplayName(otherParticipantLabels, t.chat.unknownUser);
      const preview = getInboxDisplayPreviewText(conversation, {
        audio: t.chat.audio,
        deletedMessage: t.chat.deletedMessage,
        voiceMessage: t.chat.voiceMessage,
        encryptedMessage: t.chat.encryptedMessage,
        newEncryptedMessage: t.chat.newEncryptedMessage,
        attachment: t.chat.attachment,
        file: t.chat.file,
        image: t.chat.photo,
        newMessage: t.chat.newMessage,
      }, inboxPreferences.previewMode);
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
        isGroupConversation,
        title,
        groupAvatarPath: conversation.avatarPath,
        preview,
        latestMessageId: conversation.latestMessageId,
        latestMessageContentMode: conversation.latestMessageContentMode,
        latestMessageDeletedAt: conversation.latestMessageDeletedAt,
        metaLabels,
        participants: primaryOtherParticipant ? [primaryOtherParticipant] : [],
        participantLabels: otherParticipantLabels,
        hasUnread,
      } satisfies ConversationListItem;
    });
  const mainConversationItems = buildConversationItems(conversations);
  const archivedConversationItems = buildConversationItems(archivedConversations);
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
  const mainSummaries = buildLiveSummaries(conversations);
  const archivedSummaries = buildLiveSummaries(archivedConversations);
  const allConversationIds = Array.from(
    new Set(allVisibleConversations.map((conversation) => conversation.conversationId)),
  );

  return (
    <section className="stack inbox-screen inbox-screen-minimal">
      <InboxRealtimeSync
        conversationIds={allConversationIds}
        initialSummaries={[...mainSummaries, ...archivedSummaries]}
        userId={user.id}
      />
      <WarmNavReadyProbe
        details={{
          archivedCount: archivedConversationItems.length,
          mainCount: mainConversationItems.length,
          spaceId: activeSpaceId,
        }}
        routeKey={warmNavRouteKey}
        routePath="/inbox"
        surface="inbox"
      />

      {visibleError ? <p className="notice notice-error">{visibleError}</p> : null}
      <InboxFilterableContent
        activeSpaceId={activeSpaceId}
        activeSpaceName={activeSpaceName}
        archivedConversationItems={archivedConversationItems}
        archivedSummaries={archivedSummaries}
        availableDmUserEntries={availableDmUserEntries}
        availableUserEntries={availableUserEntries}
        canManageMembers={canManageMembers}
        createOpen={isCreateOpen}
        createTargetsLoaded={false}
        currentUserId={user.id}
        initialCreateMode={initialCreateMode}
        initialFilter={activeFilter}
        initialView={activeView}
        isMessengerSpace={isMessengerProductSpace}
        language={language}
        mainConversationItems={mainConversationItems}
        mainSummaries={mainSummaries}
        preferences={inboxPreferences}
        queryValue={query.q ?? ''}
        restoreAction={restoreConversationAction}
      />
    </section>
  );
}
