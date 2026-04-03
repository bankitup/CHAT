import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  formatPersonFallbackLabel,
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
  getConversationParticipantIdentities,
  getInboxConversations,
} from '@/modules/messaging/data/server';
import {
  getIdentityLabel,
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/messaging/ui/identity';
import { InboxRealtimeSync } from '@/modules/messaging/realtime/inbox-sync';
import { resolveActiveSpaceForUser } from '@/modules/spaces/server';
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

function getFallbackIdentityLabel(
  language: AppLanguage,
  userId: string,
  fallbackLabels: Map<string, string>,
  kind: 'person' | 'member' = 'person',
) {
  const existing = fallbackLabels.get(userId);

  if (existing) {
    return existing;
  }

  const nextLabel = formatPersonFallbackLabel(
    language,
    fallbackLabels.size + 1,
    kind,
  );
  fallbackLabels.set(userId, nextLabel);

  return nextLabel;
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
  const query = await searchParams;
  const searchTerm = normalizeSearchTerm(query.q);
  const activeFilter = normalizeFilter(query.filter);
  const activeView = normalizeView(query.view);
  const isDmOnlyView = activeFilter === 'dm' && activeView === 'main';
  const isCreateOpen = query.create === 'open';
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  if (!query.space?.trim()) {
    redirect('/spaces');
  }

  const activeSpaceState = await resolveActiveSpaceForUser({
    userId: user.id,
    requestedSpaceId: query.space,
  });

  if (!activeSpaceState.activeSpace) {
    notFound();
  }

  const activeSpaceId = activeSpaceState.activeSpace.id;

  if (activeSpaceState.requestedSpaceWasInvalid) {
    redirect('/spaces');
  }

  const language = await getRequestLanguage();
  const t = getTranslations(language);

  const [conversations, archivedConversations, availableUsers] = await Promise.all([
    getInboxConversations(user.id, { spaceId: activeSpaceId }),
    getArchivedConversations(user.id, { spaceId: activeSpaceId }),
    getAvailableUsers(user.id, { spaceId: activeSpaceId }),
  ]);
  const visibleConversations =
    activeView === 'archived' ? archivedConversations : conversations;
  const participantIdentities = await getConversationParticipantIdentities(
    visibleConversations.map((conversation) => conversation.conversationId),
  );
  const participantIdentitiesByConversation = participantIdentities.reduce(
    (map, identity) => {
      const existing = map.get(identity.conversationId) ?? [];
      existing.push(identity);
      map.set(identity.conversationId, existing);
      return map;
    },
    new Map<string, typeof participantIdentities>(),
  );
  const fallbackIdentityLabels = new Map<string, string>();
  const availableUserEntries = availableUsers.map((availableUser) => ({
    ...availableUser,
    label: getIdentityLabel(
      availableUser,
      getFallbackIdentityLabel(
        language,
        availableUser.userId,
        fallbackIdentityLabels,
        'member',
      ),
    ),
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
      getIdentityLabel(
        participant,
        getFallbackIdentityLabel(language, participant.userId, fallbackIdentityLabels),
      ),
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
      : otherParticipantLabels[0] || (language === 'ru' ? 'Новый чат' : 'New chat');
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

  const filteredConversationItems = conversationItems.filter((conversation) => {
    if (activeFilter === 'dm' && conversation.isGroupConversation) {
      return false;
    }

    if (activeFilter === 'groups' && !conversation.isGroupConversation) {
      return false;
    }

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

  const unreadConversationCount = conversationItems.filter(
    (conversation) => conversation.hasUnread,
  ).length;
  const archivedConversationCount = archivedConversations.length;
  const headerTitle = isDmOnlyView ? t.inbox.dmTitle : t.inbox.title;
  const headerSubtitle =
    activeView === 'archived'
      ? archivedConversationCount > 0
        ? t.inbox.subtitleArchivedCount(archivedConversationCount)
        : t.inbox.subtitleArchivedEmpty
      : isDmOnlyView
        ? unreadConversationCount > 0
          ? t.inbox.subtitleDmNew(unreadConversationCount)
          : conversationItems.length > 0
            ? t.inbox.subtitleDmCaughtUp
            : t.inbox.subtitleDmStart
        : unreadConversationCount > 0
          ? t.inbox.subtitleNew(unreadConversationCount)
          : conversationItems.length > 0
            ? t.inbox.subtitleCaughtUp
            : t.inbox.subtitleStart;
  const searchAria = isDmOnlyView ? t.inbox.searchDmAria : t.inbox.searchAria;
  const searchPlaceholder = isDmOnlyView
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
    <section className="stack inbox-screen inbox-screen-minimal">
      <InboxRealtimeSync
        conversationIds={visibleConversations.map((conversation) => conversation.conversationId)}
        userId={user.id}
      />

      <section className="card inbox-home-shell stack">
        <div className="inbox-topbar">
          <div className="stack inbox-topbar-copy">
            <h1 className="inbox-home-title">{headerTitle}</h1>
            <p className="muted inbox-home-subtitle">{headerSubtitle}</p>
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

        <div className="stack inbox-toolbar">
          <form
            action="/inbox"
            className="inbox-search-form inbox-search-form-minimal"
            aria-label={searchAria}
            role="search"
          >
            <label className="field inbox-search-field inbox-search-shell">
              <span className="sr-only">{searchAria}</span>
              <span aria-hidden="true" className="inbox-search-icon">
                ⌕
              </span>
              <input
                className="input inbox-search-input"
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

          <div className="inbox-filter-row" role="tablist" aria-label={t.inbox.filtersAria}>
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
            <div className="inbox-search-meta">
              <div className="stack inbox-search-copy">
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
        <section className="stack conversation-list conversation-list-minimal">
          {filteredConversationItems.map((conversation) => (
            <article
              key={conversation.conversationId}
              className={
                conversation.hasUnread
                  ? 'conversation-card conversation-card-unread conversation-card-minimal'
                  : 'conversation-card conversation-card-minimal'
              }
            >
              <div
                className={
                  activeView === 'archived'
                    ? 'conversation-row conversation-row-with-action'
                    : 'conversation-row'
                }
              >
                <Link
                  className="conversation-row-link"
                  href={withSpaceParam(
                    `/chat/${conversation.conversationId}`,
                    activeSpaceId,
                  )}
                >
                  {conversation.isGroupConversation ? (
                    <GroupIdentityAvatar
                      label={conversation.title}
                      size="sm"
                    />
                  ) : (
                    <IdentityAvatar
                      identity={conversation.participants[0]}
                      label={conversation.title}
                      size="sm"
                    />
                  )}

                  <div className="stack conversation-card-copy">
                    <div className="stack conversation-main-copy">
                      <div className="conversation-title-row">
                        <h3
                          className={
                            conversation.hasUnread
                              ? 'conversation-title conversation-title-unread'
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
                              ? 'muted conversation-preview conversation-preview-unread'
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

                    <div className="conversation-footer">
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
