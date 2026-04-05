import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getLocaleForLanguage,
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getInboxPreviewText,
  getSearchableConversationPreview,
} from '@/modules/messaging/e2ee/inbox-policy';
import {
  getAvailableUsers,
  getArchivedConversations,
  getConversationDisplayName,
  getDirectMessageDisplayName,
  getConversationParticipantIdentities,
  getInboxConversations,
  getInboxConversationsStable,
} from '@/modules/messaging/data/server';
import {
  loadArchivedConversationsForSsr,
  loadInboxConversationsForSsr,
} from '@/modules/messaging/data/inbox-ssr-stability';
import {
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/messaging/ui/identity';
import { resolvePublicIdentityLabel } from '@/modules/messaging/ui/identity-label';
import { InboxRealtimeSync } from '@/modules/messaging/realtime/inbox-sync';
import { resolveActiveSpaceForUser } from '@/modules/spaces/server';
import { isSpaceMembersSchemaCacheErrorMessage } from '@/modules/spaces/server';
import { resolveV1TestSpaceFallback } from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';
import { EncryptedDmInboxPreview } from './encrypted-dm-inbox-preview';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  restoreConversationAction,
} from './actions';
import { NewChatSheet } from './new-chat-sheet';

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

type InboxFilter = 'all' | 'dm' | 'groups';
type InboxView = 'main' | 'archived';

type ConversationListItem = {
  conversationId: string;
  isGroupConversation: boolean;
  title: string;
  preview: string | null;
  latestMessageId: string | null;
  latestMessageContentMode: string | null;
  latestMessageDeletedAt: string | null;
  metaLabels: Array<{
    label: string;
    tone: 'default' | 'archived';
  }>;
  recencyLabel: string;
  timestampLabel: string;
  participants: Array<{
    userId: string;
    displayName: string | null;
    avatarPath?: string | null;
  }>;
  participantLabels: string[];
  hasUnread: boolean;
};

function normalizeSearchTerm(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeFilter(value: string | undefined): InboxFilter {
  if (value === 'dm' || value === 'groups') {
    return value;
  }

  return 'all';
}

function normalizeView(value: string | undefined): InboxView {
  return value === 'archived' ? 'archived' : 'main';
}

function formatTimestamp(value: string | null, language: AppLanguage) {
  if (!value) {
    return getTranslations(language).inbox.noActivityYet;
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatRecency(value: string | null, language: AppLanguage) {
  const t = getTranslations(language);
  if (!value) {
    return t.inbox.newRecency;
  }

  const target = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (diffMinutes < 60) {
    return language === 'ru' ? `${diffMinutes} мин` : `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return language === 'ru' ? `${diffHours} ч` : `${diffHours}h`;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const dayDiff = Math.round(
    (today.getTime() - targetDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dayDiff === 1) {
    return t.inbox.yesterday;
  }

  if (dayDiff < 7) {
    return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
      weekday: 'short',
    }).format(target);
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    month: 'short',
    day: 'numeric',
  }).format(target);
}

function buildFilterHref(
  filter: InboxFilter,
  query?: string,
  view?: InboxView,
  spaceId?: string | null,
) {
  const params = new URLSearchParams();

  if (filter !== 'all') {
    params.set('filter', filter);
  }

  if (view === 'archived') {
    params.set('view', 'archived');
  }

  if (spaceId?.trim()) {
    params.set('space', spaceId.trim());
  }

  if (query?.trim()) {
    params.set('q', query.trim());
  }

  const href = params.toString();
  return href ? `/inbox?${href}` : '/inbox';
}

function buildInboxHref({
  filter,
  query,
  create,
  spaceId,
  view,
}: {
  filter: InboxFilter;
  query?: string;
  create?: boolean;
  spaceId?: string | null;
  view?: InboxView;
}) {
  const params = new URLSearchParams();

  if (filter !== 'all') {
    params.set('filter', filter);
  }

  if (query?.trim()) {
    params.set('q', query.trim());
  }

  if (view === 'archived') {
    params.set('view', 'archived');
  }

  if (spaceId?.trim()) {
    params.set('space', spaceId.trim());
  }

  if (create) {
    params.set('create', 'open');
  }

  const href = params.toString();
  return href ? `/inbox?${href}` : '/inbox';
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
  const searchTerm = normalizeSearchTerm(query.q);
  const activeFilter = normalizeFilter(query.filter);
  const activeView = normalizeView(query.view);
  const isPrimaryChatsView = activeView === 'main';
  const isDmFilter = activeFilter === 'dm';
  const isCreateOpen = query.create === 'open';
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        notFound();
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

  const language = await getRequestLanguage();
  const t = getTranslations(language);

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

  const [conversations, archivedConversations, availableUsers] = await Promise.all([
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
  const visibleConversations =
    activeView === 'archived' ? archivedConversations : conversations;
  const participantIdentities = await getConversationParticipantIdentities(
    visibleConversations.map((conversation) => conversation.conversationId),
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
  const filteredAvailableUserEntries = availableUserEntries.filter(
    (availableUser) => {
      if (!searchTerm) {
        return true;
      }

      return availableUser.label.toLowerCase().includes(searchTerm);
    },
  );
  const conversationItems = visibleConversations.map((conversation) => {
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
    const lastActivityAt = conversation.lastMessageAt ?? conversation.createdAt;
    const hasUnread = conversation.unreadCount > 0;
    const metaLabels = [
      ...(isGroupConversation
        ? [{ label: t.inbox.metaGroup, tone: 'default' as const }]
        : []),
      ...(activeView === 'archived'
        ? [{ label: t.inbox.metaArchived, tone: 'archived' as const }]
        : []),
    ];

    return {
      conversationId: conversation.conversationId,
      isGroupConversation,
      title,
      preview,
      latestMessageId: conversation.latestMessageId,
      latestMessageContentMode: conversation.latestMessageContentMode,
      latestMessageDeletedAt: conversation.latestMessageDeletedAt,
      metaLabels,
      recencyLabel: formatRecency(lastActivityAt, language),
      timestampLabel: formatTimestamp(lastActivityAt, language),
      participants: otherParticipants,
      participantLabels: otherParticipantLabels,
      hasUnread,
    } satisfies ConversationListItem;
  });

  const filterConversationItems = (conversation: ConversationListItem) => {
    if (activeFilter === 'dm' && conversation.isGroupConversation) {
      return false;
    }

    if (activeFilter === 'groups' && !conversation.isGroupConversation) {
      return false;
    }

    return true;
  };

  const visibleConversationItems = conversationItems.filter(filterConversationItems);

  const filteredConversationItems = visibleConversationItems.filter((conversation) => {
    if (!searchTerm) {
      return true;
    }

    const searchablePreview = getSearchableConversationPreview({
      latestMessageContentMode: conversation.latestMessageContentMode,
      preview: conversation.preview,
    });

    const haystack = [
      conversation.title,
      searchablePreview,
      ...conversation.participantLabels,
      conversation.isGroupConversation ? t.inbox.metaGroup : t.chat.directChat,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(searchTerm);
  });

  const unreadVisibleConversationCount = visibleConversationItems.filter(
    (conversation) => conversation.hasUnread,
  ).length;
  const archivedConversationCount = archivedConversations.length;
  const headerTitle = t.inbox.title;
  const headerSubtitle =
    activeView === 'archived'
      ? archivedConversationCount > 0
        ? t.inbox.subtitleArchivedCount(archivedConversationCount)
        : t.inbox.subtitleArchivedEmpty
      : isDmFilter
        ? unreadVisibleConversationCount > 0
          ? t.inbox.subtitleDmNew(unreadVisibleConversationCount)
          : visibleConversationItems.length > 0
            ? t.inbox.subtitleDmCaughtUp
            : t.inbox.subtitleDmStart
        : unreadVisibleConversationCount > 0
          ? t.inbox.subtitleNew(unreadVisibleConversationCount)
          : visibleConversationItems.length > 0
            ? t.inbox.subtitleCaughtUp
            : t.inbox.subtitleStart;
  const searchAria = isDmFilter ? t.inbox.searchDmAria : t.inbox.searchAria;
  const searchPlaceholder = isDmFilter
    ? t.inbox.searchDmPlaceholder
    : t.inbox.searchPlaceholder;
  const searchScopeSummary = searchTerm
    ? (() => {
        const parts = [
          filteredConversationItems.length > 0
            ? t.inbox.searchResultChat(filteredConversationItems.length)
            : null,
          filteredAvailableUserEntries.length > 0
            ? t.inbox.searchResultPerson(filteredAvailableUserEntries.length)
            : null,
        ].filter(Boolean);

        return parts.length > 0 ? parts.join(' · ') : t.inbox.searchSummaryNone;
      })()
    : null;
  const hasEncryptedDmSearchLimit =
    searchTerm.length > 0 &&
    visibleConversations.some(
      (conversation) =>
        conversation.kind === 'dm' &&
        conversation.latestMessageContentMode === 'dm_e2ee_v1',
    );

  return (
    <section
      className={
        isPrimaryChatsView
          ? 'stack inbox-screen inbox-screen-minimal inbox-screen-dm'
          : 'stack inbox-screen inbox-screen-minimal'
      }
    >
      <InboxRealtimeSync
        conversationIds={visibleConversations.map((conversation) => conversation.conversationId)}
        userId={user.id}
      />

      <section
        className={
          isPrimaryChatsView
            ? 'card inbox-home-shell inbox-home-shell-dm stack'
            : 'card inbox-home-shell stack'
        }
      >
        <div className="inbox-topbar">
          <div
            className={
              isPrimaryChatsView
                ? 'stack inbox-topbar-copy inbox-topbar-copy-dm'
                : 'stack inbox-topbar-copy'
            }
          >
            <h1
              className={
                isPrimaryChatsView
                  ? 'inbox-home-title inbox-home-title-dm'
                  : 'inbox-home-title'
              }
            >
              {headerTitle}
            </h1>
            <p
              className={
                isPrimaryChatsView
                  ? 'muted inbox-home-subtitle inbox-home-subtitle-dm'
                  : 'muted inbox-home-subtitle'
              }
            >
              {headerSubtitle}
            </p>
          </div>
          <div className="inbox-topbar-actions">
            <Link
              aria-label={t.inbox.settingsAria}
              className="inbox-settings-trigger"
              href={withSpaceParam('/settings', activeSpaceId)}
            >
              <span aria-hidden="true">⚙</span>
            </Link>
            <Link
              aria-label={t.inbox.createAria}
              className="inbox-compose-trigger"
              href={buildInboxHref({
                filter: activeFilter,
                query: query.q,
                create: true,
                spaceId: activeSpaceId,
                view: activeView,
              })}
            >
              <span aria-hidden="true">+</span>
            </Link>
          </div>
        </div>

        <div
          className={
            isPrimaryChatsView ? 'stack inbox-toolbar inbox-toolbar-dm' : 'stack inbox-toolbar'
          }
        >
          <form
            action="/inbox"
            className={
              isPrimaryChatsView
                ? 'inbox-search-form inbox-search-form-minimal inbox-search-form-dm'
                : 'inbox-search-form inbox-search-form-minimal'
            }
            aria-label={searchAria}
            role="search"
          >
            <label
              className={
                isPrimaryChatsView
                  ? 'field inbox-search-field inbox-search-shell inbox-search-shell-dm'
                  : 'field inbox-search-field inbox-search-shell'
              }
            >
              <span className="sr-only">{searchAria}</span>
              <span
                aria-hidden="true"
                className={
                  isPrimaryChatsView
                    ? 'inbox-search-icon inbox-search-icon-dm'
                    : 'inbox-search-icon'
                }
              >
                ⌕
              </span>
              <input
                className={
                  isPrimaryChatsView
                    ? 'input inbox-search-input inbox-search-input-dm'
                    : 'input inbox-search-input'
                }
                defaultValue={query.q ?? ''}
                enterKeyHint="search"
                name="q"
                placeholder={searchPlaceholder}
                type="search"
              />
            </label>
            {activeFilter !== 'all' ? (
              <input name="filter" type="hidden" value={activeFilter} />
            ) : null}
            <input name="space" type="hidden" value={activeSpaceId} />
            {activeView === 'archived' ? (
              <input name="view" type="hidden" value="archived" />
            ) : null}
          </form>

          <div
            className={
              isPrimaryChatsView
                ? 'inbox-filter-row inbox-filter-row-dm'
                : 'inbox-filter-row'
            }
            role="tablist"
            aria-label={t.inbox.filtersAria}
          >
            <Link
              aria-selected={activeFilter === 'all'}
              className={
                activeFilter === 'all'
                  ? 'inbox-filter-pill inbox-filter-pill-active'
                  : 'inbox-filter-pill'
              }
              href={buildFilterHref('all', query.q, activeView, activeSpaceId)}
            >
              {t.inbox.filters.all}
            </Link>
            <Link
              aria-selected={activeFilter === 'dm'}
              className={
                activeFilter === 'dm'
                  ? 'inbox-filter-pill inbox-filter-pill-active'
                  : 'inbox-filter-pill'
              }
              href={buildFilterHref('dm', query.q, activeView, activeSpaceId)}
            >
              {t.inbox.filters.dm}
            </Link>
            <Link
              aria-selected={activeFilter === 'groups'}
              className={
                activeFilter === 'groups'
                  ? 'inbox-filter-pill inbox-filter-pill-active'
                  : 'inbox-filter-pill'
              }
              href={buildFilterHref('groups', query.q, activeView, activeSpaceId)}
            >
              {t.inbox.filters.groups}
            </Link>
            {(archivedConversationCount > 0 || activeView === 'archived') ? (
              <Link
                className={
                  activeView === 'archived'
                    ? 'inbox-filter-pill inbox-filter-pill-active'
                    : 'inbox-filter-pill'
                }
                href={
                  activeView === 'archived'
                    ? buildInboxHref({
                        filter: activeFilter,
                        query: query.q,
                        spaceId: activeSpaceId,
                      })
                    : buildInboxHref({
                        filter: activeFilter,
                        query: query.q,
                        spaceId: activeSpaceId,
                        view: 'archived',
                      })
                }
              >
                {activeView === 'archived'
                  ? t.inbox.filters.inbox
                  : `${t.inbox.filters.archived}${archivedConversationCount > 0 ? ` (${archivedConversationCount})` : ''}`}
              </Link>
            ) : null}
          </div>

          {searchTerm ? (
            <div
              className={
                isPrimaryChatsView
                  ? 'inbox-search-meta inbox-search-meta-dm'
                  : 'inbox-search-meta'
              }
            >
              <div
                className={
                  isPrimaryChatsView
                    ? 'stack inbox-search-copy inbox-search-copy-dm'
                    : 'stack inbox-search-copy'
                }
              >
                <p className="muted inbox-search-scope">{searchScopeSummary}</p>
                {hasEncryptedDmSearchLimit ? (
                  <p className="muted inbox-search-note">
                    {t.inbox.searchEncryptedNote}
                  </p>
                ) : null}
              </div>
              <div className="inbox-search-meta-actions">
              {searchTerm ? (
                <Link
                  className="inbox-search-clear"
                  href={buildFilterHref(
                    activeFilter,
                    undefined,
                    activeView,
                    activeSpaceId,
                  )}
                >
                  {t.inbox.clear}
                </Link>
              ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {query.error ? <p className="notice notice-error">{query.error}</p> : null}

      {activeView === 'archived' ? (
        <section className="card stack inbox-archived-note">
          <p className="muted inbox-archived-note-copy">
            {t.inbox.archivedNote}
          </p>
        </section>
      ) : null}

      {conversationItems.length === 0 ? (
          <section className="card stack empty-card inbox-empty-state">
          <h2 className="card-title">
            {activeView === 'archived' ? t.inbox.emptyArchivedTitle : t.inbox.emptyMainTitle}
          </h2>
          <p className="muted">
            {activeView === 'archived'
              ? t.inbox.emptyArchivedBody
              : t.inbox.emptyMainBody}
          </p>
        </section>
      ) : filteredConversationItems.length === 0 ? (
        <section className="card stack empty-card inbox-empty-state">
          <h2 className="card-title">
            {activeView === 'archived'
              ? t.inbox.emptyArchivedSearchTitle
              : t.inbox.emptySearchTitle}
          </h2>
          <p className="muted">
            {t.inbox.emptySearchBody}
          </p>
        </section>
      ) : (
        <section
          className={
            isPrimaryChatsView
              ? 'stack conversation-list conversation-list-minimal conversation-list-dm'
              : 'stack conversation-list conversation-list-minimal'
          }
        >
          {filteredConversationItems.map((conversation) => (
            <article
              key={conversation.conversationId}
              className={
                conversation.hasUnread
                  ? isPrimaryChatsView
                    ? 'conversation-card conversation-card-unread conversation-card-minimal conversation-card-dm'
                    : 'conversation-card conversation-card-unread conversation-card-minimal'
                  : isPrimaryChatsView
                    ? 'conversation-card conversation-card-minimal conversation-card-dm'
                    : 'conversation-card conversation-card-minimal'
              }
            >
              <div
                className={
                  activeView === 'archived'
                    ? isPrimaryChatsView
                      ? 'conversation-row conversation-row-with-action conversation-row-dm'
                      : 'conversation-row conversation-row-with-action'
                    : isPrimaryChatsView
                      ? 'conversation-row conversation-row-dm'
                      : 'conversation-row'
                }
              >
                <Link
                  className={
                    isPrimaryChatsView
                      ? 'conversation-row-link conversation-row-link-dm'
                      : 'conversation-row-link'
                  }
                  href={withSpaceParam(
                    `/chat/${conversation.conversationId}`,
                    activeSpaceId,
                  )}
                >
                  {conversation.isGroupConversation ? (
                    <GroupIdentityAvatar
                      label={conversation.title}
                      size={isPrimaryChatsView ? 'lg' : 'md'}
                    />
                  ) : (
                    <IdentityAvatar
                      diagnosticsSurface="inbox:conversation-row"
                      identity={conversation.participants[0]}
                      label={conversation.title}
                      size={isPrimaryChatsView ? 'lg' : 'md'}
                    />
                  )}

                  <div
                    className={
                      isPrimaryChatsView
                        ? 'stack conversation-card-copy conversation-card-copy-dm'
                        : 'stack conversation-card-copy'
                    }
                  >
                    <div
                      className={
                        isPrimaryChatsView
                          ? 'stack conversation-main-copy conversation-main-copy-dm'
                          : 'stack conversation-main-copy'
                      }
                    >
                      <div
                        className={
                          isPrimaryChatsView
                            ? 'conversation-title-row conversation-title-row-dm'
                            : 'conversation-title-row'
                        }
                      >
                        <h3
                          className={
                            conversation.hasUnread
                              ? isPrimaryChatsView
                                ? 'conversation-title conversation-title-unread conversation-title-dm'
                                : 'conversation-title conversation-title-unread'
                              : isPrimaryChatsView
                                ? 'conversation-title conversation-title-dm'
                                : 'conversation-title'
                          }
                        >
                          {conversation.title}
                        </h3>
                        <div className="conversation-title-meta">
                          <span
                            className={
                              conversation.hasUnread
                                ? 'conversation-recency conversation-recency-unread'
                                : 'conversation-recency'
                            }
                          >
                            {conversation.recencyLabel}
                          </span>
                          {conversation.hasUnread ? (
                            <span
                              className="conversation-unread-dot"
                              aria-label={t.inbox.unreadAria}
                            />
                          ) : null}
                        </div>
                      </div>
                      {conversation.preview ? (
                        <EncryptedDmInboxPreview
                          className={
                            conversation.hasUnread
                              ? isPrimaryChatsView
                                ? 'muted conversation-preview conversation-preview-unread conversation-preview-dm'
                                : 'muted conversation-preview conversation-preview-unread'
                              : isPrimaryChatsView
                                ? 'muted conversation-preview conversation-preview-dm'
                                : 'muted conversation-preview'
                          }
                          conversationId={conversation.conversationId}
                          currentUserId={user.id}
                          fallbackPreview={conversation.preview}
                          latestMessageContentMode={conversation.latestMessageContentMode}
                          latestMessageDeletedAt={conversation.latestMessageDeletedAt ?? null}
                          latestMessageId={conversation.latestMessageId}
                        />
                      ) : null}
                    </div>

                    <div
                      className={
                        isPrimaryChatsView
                          ? 'conversation-footer conversation-footer-dm'
                          : 'conversation-footer'
                      }
                    >
                      <div className="conversation-footer-meta">
                        {conversation.metaLabels.map((metaLabel) => (
                          <span
                            key={metaLabel.label}
                            className={
                              metaLabel.tone === 'archived'
                                ? 'conversation-kind-label conversation-kind-label-archived'
                                : 'conversation-kind-label'
                            }
                          >
                            {metaLabel.tone === 'archived'
                              ? t.inbox.metaArchived
                              : t.inbox.metaGroup}
                          </span>
                        ))}
                      </div>
                      <p className="muted conversation-timestamp">
                        {conversation.timestampLabel}
                      </p>
                    </div>
                  </div>
                </Link>
                {activeView === 'archived' ? (
                  <form action={restoreConversationAction}>
                    <input
                      name="conversationId"
                      type="hidden"
                      value={conversation.conversationId}
                    />
                    <input name="spaceId" type="hidden" value={activeSpaceId} />
                    <button
                      className="button button-compact button-secondary conversation-restore-button"
                      type="submit"
                    >
                      {t.inbox.restore}
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}

      {isCreateOpen ? (
        <section className="inbox-create-overlay" aria-label="Create chat">
          <Link
            aria-label="Close create chat"
            className="inbox-create-backdrop"
            href={buildInboxHref({
              filter: activeFilter,
              query: query.q,
              spaceId: activeSpaceId,
              view: activeView,
            })}
          />

          <NewChatSheet
            availableUsers={filteredAvailableUserEntries}
            hasAnyUsers={availableUserEntries.length > 0}
            closeHref={buildInboxHref({
              filter: activeFilter,
              query: query.q,
              spaceId: activeSpaceId,
              view: activeView,
            })}
            spaceId={activeSpaceId}
            language={language}
          />
        </section>
      ) : null}
    </section>
  );
}
