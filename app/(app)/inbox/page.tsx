import { getRequestViewer } from '@/lib/request-context/server';
import {
  getTranslations,
} from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getInboxPreviewText,
} from '@/modules/messaging/e2ee/inbox-policy';
import {
  getInboxSectionPreferences,
} from '@/modules/messaging/inbox/preferences-server';
import {
  resolveInboxInitialFilter,
} from '@/modules/messaging/inbox/preferences';
import {
  getAvailableUsers,
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
  resolvePublicIdentityLabel,
} from '@/modules/messaging/ui/identity-label';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import { InboxRealtimeSync } from '@/modules/messaging/realtime/inbox-sync';
import { resolveActiveSpaceForUser } from '@/modules/spaces/server';
import { isSpaceMembersSchemaCacheErrorMessage } from '@/modules/spaces/server';
import { resolveV1TestSpaceFallback } from '@/modules/spaces/server';
import { InboxFilterableContent } from './inbox-filterable-content';
import { redirect } from 'next/navigation';
import {
  restoreConversationAction,
} from './actions';

type InboxPageProps = {
  searchParams: Promise<{
    create?: string;
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

  let activeSpaceId: string;
  const explicitV1TestSpace = await resolveV1TestSpaceFallback({
    requestedSpaceId: query.space,
    source: 'inbox-page-explicit-v1-test-bypass',
  });
  const isV1TestBypass = Boolean(explicitV1TestSpace);

  if (explicitV1TestSpace) {
    // Temporary v1 unblocker: bypass fragile space_members SSR path for explicit TEST-space entry.
    // Remove once membership resolution via space_members is stable again.
    activeSpaceId = explicitV1TestSpace.id;
    logDiagnostics('active-space-bypass-v1-test', {
      spaceId: explicitV1TestSpace.id,
    });
  } else {
    try {
      const activeSpaceState = await resolveActiveSpaceForUser({
        userId: user.id,
        requestedSpaceId: query.space,
        source: 'inbox-page',
      });

      if (!activeSpaceState.activeSpace) {
        logDiagnostics('no-active-space-notFound');
        redirect('/spaces');
      }

      if (activeSpaceState.requestedSpaceWasInvalid) {
        logDiagnostics('invalid-space-redirect');
        redirect('/spaces');
      }

      activeSpaceId = activeSpaceState.activeSpace.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (isSpaceMembersSchemaCacheErrorMessage(message)) {
        const fallbackSpace = await resolveV1TestSpaceFallback({
          requestedSpaceId: query.space,
          source: 'inbox-page',
        });

        if (!fallbackSpace) {
          redirect('/spaces');
        }

        activeSpaceId = fallbackSpace.id;
        logDiagnostics('active-space-fallback-v1-test', {
          spaceId: fallbackSpace.id,
        });
      } else {
        throw error;
      }
    }
  }
  logDiagnostics('active-space-ok', { hasActiveSpace: true });

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

  const archivedConversationsPromise = loadArchivedConversationsForSsr({
    view: activeView,
    emptyValue: emptyArchivedConversations,
    loadArchived: async () => {
      const value = await getArchivedConversations(user.id, {
        spaceId: activeSpaceId,
      });
      logDiagnostics('loader:archived-ok', { count: value.length });
      return value;
    },
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

  const [conversations, archivedConversations, availableUsers]: [
    InboxConversation[],
    InboxConversation[],
    Awaited<ReturnType<typeof getAvailableUsers>>,
  ] = await Promise.all([
    loadInboxConversationsForSsr({
      view: 'main',
      loadPrecise: () => getInboxConversations(user.id, { spaceId: activeSpaceId }),
      loadStable: () =>
        getInboxConversationsStable(user.id, { spaceId: activeSpaceId }),
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
    getAvailableUsers(user.id, {
      spaceId: activeSpaceId,
      source: isV1TestBypass ? 'inbox-page-v1-test-bypass' : 'inbox-page',
    })
          .then((value) => {
            logDiagnostics('loader:users-ok', { count: value.length });
            return value;
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            logDiagnostics('loader:users-error', { message });

            if (isSpaceMembersSchemaCacheErrorMessage(message)) {
              logDiagnostics('loader:users-fallback-empty');
              return [] as Awaited<ReturnType<typeof getAvailableUsers>>;
            }

            throw error;
          }),
  ]);
  logDiagnostics('loader:all-ok');
  const allVisibleConversations = [...conversations, ...archivedConversations];
  const participantIdentities = await getConversationParticipantIdentities(
    allVisibleConversations.map((conversation) => conversation.conversationId),
  );
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
  const availableUserEntries = availableUsers.map((availableUser) => ({
    ...availableUser,
    label: resolvePublicIdentityLabel(availableUser, t.chat.unknownUser),
  }));
  const buildConversationItems = (input: InboxConversation[]) =>
    input.map((conversation) => {
      const participantOptions =
        participantIdentitiesByConversation.get(conversation.conversationId) ?? [];
      const otherParticipants = participantOptions.filter(
        (participant) => participant.userId !== user.id,
      );
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
      const preview = getInboxPreviewText(conversation, {
        deletedMessage: t.chat.deletedMessage,
        voiceMessage: t.chat.voiceMessage,
        encryptedMessage: t.chat.encryptedMessage,
        newEncryptedMessage: t.chat.newEncryptedMessage,
        attachment: t.chat.attachment,
      });
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
        participants: otherParticipants,
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

      {visibleError ? <p className="notice notice-error">{visibleError}</p> : null}
      <InboxFilterableContent
        activeSpaceId={activeSpaceId}
        archivedConversationItems={archivedConversationItems}
        archivedSummaries={archivedSummaries}
        availableUserEntries={availableUserEntries}
        createOpen={isCreateOpen}
        currentUserId={user.id}
        initialFilter={activeFilter}
        initialView={activeView}
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
