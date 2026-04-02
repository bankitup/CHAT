import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getAvailableUsers,
  getArchivedConversations,
  getConversationDisplayName,
  getConversationParticipantIdentities,
  getConversationParticipantSummary,
  getInboxConversations,
} from '@/modules/messaging/data/server';
import {
  getIdentityLabel,
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/messaging/ui/identity';
import { InboxRealtimeSync } from '@/modules/messaging/realtime/inbox-sync';
import Link from 'next/link';
import {
  createDmAction,
  createGroupAction,
  restoreConversationAction,
} from './actions';

type InboxPageProps = {
  searchParams: Promise<{
    create?: string;
    error?: string;
    filter?: string;
    q?: string;
    view?: string;
  }>;
};

type InboxFilter = 'all' | 'dm' | 'groups';
type InboxView = 'main' | 'archived';

type ConversationListItem = {
  conversationId: string;
  isGroupConversation: boolean;
  title: string;
  preview: string;
  kindLabel: string;
  readStateLabel: string;
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

function formatSearchResultLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

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

function formatTimestamp(value: string | null) {
  if (!value) {
    return 'No activity yet';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatRecency(value: string | null) {
  if (!value) {
    return 'New';
  }

  const target = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h`;
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
    return 'Yesterday';
  }

  if (dayDiff < 7) {
    return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(target);
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(target);
}

function getFallbackIdentityLabel(
  userId: string,
  fallbackLabels: Map<string, string>,
  prefix = 'Person',
) {
  const existing = fallbackLabels.get(userId);

  if (existing) {
    return existing;
  }

  const nextLabel = `${prefix} ${fallbackLabels.size + 1}`;
  fallbackLabels.set(userId, nextLabel);

  return nextLabel;
}

function buildFilterHref(
  filter: InboxFilter,
  query?: string,
  view?: InboxView,
) {
  const params = new URLSearchParams();

  if (filter !== 'all') {
    params.set('filter', filter);
  }

  if (view === 'archived') {
    params.set('view', 'archived');
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
  view,
}: {
  filter: InboxFilter;
  query?: string;
  create?: boolean;
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
  const isCreateOpen = query.create === 'open';
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [conversations, archivedConversations, availableUsers] = await Promise.all([
    getInboxConversations(user.id),
    getArchivedConversations(user.id),
    getAvailableUsers(user.id),
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
        availableUser.userId,
        fallbackIdentityLabels,
        'Member',
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
        getFallbackIdentityLabel(participant.userId, fallbackIdentityLabels),
      ),
    );
    const isGroupConversation = conversation.kind === 'group';
    const title = getConversationDisplayName({
      kind: conversation.kind ?? null,
      title: conversation.title,
      participantLabels: otherParticipantLabels,
    });
    const participantSummary = getConversationParticipantSummary(
      otherParticipantLabels,
      isGroupConversation ? 3 : undefined,
    );
    const preview = isGroupConversation
      ? participantSummary
        ? participantSummary
        : 'People in this chat'
      : otherParticipantLabels[0]
        ? `${otherParticipantLabels[0]}`
        : 'Conversation';
    const lastActivityAt = conversation.lastMessageAt ?? conversation.createdAt;
    const hasUnread = conversation.unreadCount > 0;
    const readStateLabel = hasUnread
      ? 'New'
      : conversation.lastMessageAt
        ? 'Read'
        : 'Start';

    return {
      conversationId: conversation.conversationId,
      isGroupConversation,
      title,
      preview,
      kindLabel: isGroupConversation ? 'Group' : 'DM',
      readStateLabel,
      recencyLabel: formatRecency(lastActivityAt),
      timestampLabel: formatTimestamp(lastActivityAt),
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

    const haystack = [
      conversation.title,
      conversation.preview,
      ...conversation.participantLabels,
      conversation.isGroupConversation ? 'group' : 'direct',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(searchTerm);
  });

  const unreadConversationCount = conversationItems.filter(
    (conversation) => conversation.hasUnread,
  ).length;
  const archivedConversationCount = archivedConversations.length;
  const searchScopeSummary = searchTerm
    ? [
        formatSearchResultLabel(filteredConversationItems.length, 'chat', 'chats'),
        formatSearchResultLabel(filteredAvailableUserEntries.length, 'person', 'people'),
      ].join(' · ')
    : activeView === 'archived'
      ? 'Search archived chats and people'
      : 'Search chats and people';

  return (
    <section className="stack inbox-screen inbox-screen-minimal">
      <InboxRealtimeSync
        conversationIds={visibleConversations.map((conversation) => conversation.conversationId)}
        userId={user.id}
      />

      <section className="card inbox-home-shell stack">
        <div className="inbox-topbar">
          <div className="stack inbox-topbar-copy">
            <h1 className="inbox-home-title">Chats</h1>
            <p className="muted inbox-home-subtitle">
              {activeView === 'archived'
                ? archivedConversationCount > 0
                  ? `${archivedConversationCount} archived`
                  : 'Archived chats live here'
                : unreadConversationCount > 0
                  ? `${unreadConversationCount} new`
                  : conversationItems.length > 0
                    ? 'All caught up'
                    : 'Start a chat'}
            </p>
          </div>
          <div className="inbox-topbar-actions">
            <Link
              aria-label="Open settings"
              className="inbox-settings-trigger"
              href="/settings"
            >
              <span aria-hidden="true">⚙</span>
            </Link>
            <Link
              aria-label="Start a chat"
              className="inbox-compose-trigger"
              href={buildInboxHref({
                filter: activeFilter,
                query: query.q,
                create: true,
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
            role="search"
          >
            <label className="field inbox-search-field inbox-search-shell">
              <span className="sr-only">Search chats</span>
              <span aria-hidden="true" className="inbox-search-icon">
                ⌕
              </span>
              <input
                className="input inbox-search-input"
                defaultValue={query.q ?? ''}
                enterKeyHint="search"
                name="q"
                placeholder="Search chats or people"
                type="search"
              />
            </label>
            {activeFilter !== 'all' ? (
              <input name="filter" type="hidden" value={activeFilter} />
            ) : null}
            {activeView === 'archived' ? (
              <input name="view" type="hidden" value="archived" />
            ) : null}
          </form>

          <div className="inbox-filter-row" role="tablist" aria-label="Chat filters">
            <Link
              aria-selected={activeFilter === 'all'}
              className={
                activeFilter === 'all'
                  ? 'inbox-filter-pill inbox-filter-pill-active'
                  : 'inbox-filter-pill'
              }
              href={buildFilterHref('all', query.q, activeView)}
            >
              All
            </Link>
            <Link
              aria-selected={activeFilter === 'dm'}
              className={
                activeFilter === 'dm'
                  ? 'inbox-filter-pill inbox-filter-pill-active'
                  : 'inbox-filter-pill'
              }
              href={buildFilterHref('dm', query.q, activeView)}
            >
              DM
            </Link>
            <Link
              aria-selected={activeFilter === 'groups'}
              className={
                activeFilter === 'groups'
                  ? 'inbox-filter-pill inbox-filter-pill-active'
                  : 'inbox-filter-pill'
              }
              href={buildFilterHref('groups', query.q, activeView)}
            >
              Groups
            </Link>
          </div>

          <div className="inbox-search-meta">
            <p className="muted inbox-search-scope">{searchScopeSummary}</p>
            <div className="inbox-search-meta-actions">
              {(archivedConversationCount > 0 || activeView === 'archived') ? (
                <Link
                  className={
                    activeView === 'archived'
                      ? 'inbox-archive-link inbox-archive-link-active'
                      : 'inbox-archive-link'
                  }
                  href={
                    activeView === 'archived'
                      ? buildInboxHref({
                          filter: activeFilter,
                          query: query.q,
                        })
                      : buildInboxHref({
                          filter: activeFilter,
                          query: query.q,
                          view: 'archived',
                        })
                  }
                >
                  {activeView === 'archived'
                    ? 'Back to chats'
                    : `Archived${archivedConversationCount > 0 ? ` (${archivedConversationCount})` : ''}`}
                </Link>
              ) : null}
              {searchTerm ? (
                <Link
                  className="inbox-search-clear"
                  href={buildFilterHref(activeFilter, undefined, activeView)}
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {query.error ? <p className="notice notice-error">{query.error}</p> : null}

      {conversationItems.length === 0 ? (
          <section className="card stack empty-card inbox-empty-state">
          <h2 className="card-title">
            {activeView === 'archived' ? 'No archived chats' : 'No chats here'}
          </h2>
          <p className="muted">
            {activeView === 'archived'
              ? 'Hidden chats will appear here.'
              : 'Start one from the + button.'}
          </p>
        </section>
      ) : filteredConversationItems.length === 0 ? (
        <section className="card stack empty-card inbox-empty-state">
          <h2 className="card-title">
            {activeView === 'archived'
              ? 'No matching archived chats'
              : 'No matching chats'}
          </h2>
          <p className="muted">
            Try a different filter or clear the search.
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
                  href={`/chat/${conversation.conversationId}`}
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
                              aria-label="Unread messages"
                            />
                          ) : null}
                        </div>
                      </div>
                      <p
                        className={
                          conversation.hasUnread
                            ? 'muted conversation-preview conversation-preview-unread'
                            : 'muted conversation-preview'
                        }
                      >
                        {conversation.preview}
                      </p>
                    </div>

                    <div className="conversation-footer">
                      <div className="conversation-footer-meta">
                        <span className="conversation-kind-label">
                          {conversation.kindLabel}
                        </span>
                        <span
                          className={
                            conversation.hasUnread
                              ? 'conversation-read-state conversation-read-state-unread'
                              : 'muted conversation-read-state'
                          }
                        >
                          {conversation.readStateLabel}
                        </span>
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
                    <button
                      className="button button-compact button-secondary conversation-restore-button"
                      type="submit"
                    >
                      Restore
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
              view: activeView,
            })}
          />

          <section className="card stack inbox-create-sheet">
            <div className="inbox-create-header">
              <div className="stack inbox-create-copy">
                <h2 className="section-title">New chat</h2>
                <p className="muted">Pick a person or start a group.</p>
              </div>
              <Link
                aria-label="Close create chat"
                className="pill inbox-create-close"
                href={buildInboxHref({
                  filter: activeFilter,
                  query: query.q,
                  view: activeView,
                })}
              >
                Close
              </Link>
            </div>

            <section className="stack inbox-create-section">
              <div className="stack inbox-create-copy">
                <h3 className="card-title">People</h3>
                <p className="muted">Choose one person.</p>
              </div>

              {availableUserEntries.length === 0 ? (
                <p className="muted inbox-compose-empty">
                  No other registered users are available yet.
                </p>
              ) : filteredAvailableUserEntries.length === 0 ? (
                <p className="muted inbox-compose-empty">
                  No matching people yet.
                </p>
              ) : (
                <div className="inbox-compose-user-list inbox-create-user-list">
                  {filteredAvailableUserEntries.map((availableUser) => (
                    <div
                      key={availableUser.userId}
                      className="inbox-compose-user-row inbox-create-user-row"
                    >
                      <div className="user-row">
                        <IdentityAvatar
                          identity={availableUser}
                          label={availableUser.label}
                          size="sm"
                        />
                        <div className="stack user-copy">
                          <span className="user-label">{availableUser.label}</span>
                        </div>
                      </div>

                      <form action={createDmAction}>
                        <input
                          name="participantUserId"
                          type="hidden"
                          value={availableUser.userId}
                        />
                        <button className="button button-compact" type="submit">
                          Message
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="stack inbox-create-section">
              <div className="stack inbox-create-copy">
                <h3 className="card-title">Group chat</h3>
                <p className="muted">Name it and pick people.</p>
              </div>

              <form action={createGroupAction} className="stack compact-form">
                <label className="field">
                  <span className="sr-only">Group title</span>
                  <input
                    className="input"
                    name="title"
                    placeholder="Weekend planning"
                    required
                  />
                </label>

                <fieldset className="selector-card inbox-compose-selector">
                  <legend className="selector-title">People</legend>
                  {availableUserEntries.length === 0 ? (
                    <p className="muted">No other registered users are available yet.</p>
                  ) : filteredAvailableUserEntries.length === 0 ? (
                    <p className="muted">No matching people yet.</p>
                  ) : (
                    <div className="checkbox-list inbox-compose-checkbox-list">
                      {filteredAvailableUserEntries.map((availableUser) => (
                        <label
                          key={`group-${availableUser.userId}`}
                          className="checkbox-row"
                        >
                          <input
                            name="participantUserIds"
                            type="checkbox"
                            value={availableUser.userId}
                          />
                          <span className="checkbox-copy">
                            <span className="checkbox-identity">
                              <IdentityAvatar
                                identity={availableUser}
                                label={availableUser.label}
                                size="sm"
                              />
                            </span>
                            <span className="user-label">{availableUser.label}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>

                <button className="button button-compact" type="submit">
                  Create group
                </button>
              </form>
            </section>
          </section>
        </section>
      ) : null}
    </section>
  );
}
