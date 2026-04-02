import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getAvailableUsers,
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
import { createDmAction, createGroupAction } from './actions';

type InboxPageProps = {
  searchParams: Promise<{
    create?: string;
    error?: string;
    filter?: string;
    q?: string;
  }>;
};

type InboxFilter = 'all' | 'dm' | 'groups';

type ConversationListItem = {
  conversationId: string;
  isGroupConversation: boolean;
  title: string;
  preview: string;
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

function normalizeSearchTerm(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeFilter(value: string | undefined): InboxFilter {
  if (value === 'dm' || value === 'groups') {
    return value;
  }

  return 'all';
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

function buildFilterHref(filter: InboxFilter, query?: string) {
  const params = new URLSearchParams();

  if (filter !== 'all') {
    params.set('filter', filter);
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
}: {
  filter: InboxFilter;
  query?: string;
  create?: boolean;
}) {
  const params = new URLSearchParams();

  if (filter !== 'all') {
    params.set('filter', filter);
  }

  if (query?.trim()) {
    params.set('q', query.trim());
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
  const isCreateOpen = query.create === 'open';
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [conversations, availableUsers] = await Promise.all([
    getInboxConversations(user.id),
    getAvailableUsers(user.id),
  ]);
  const participantIdentities = await getConversationParticipantIdentities(
    conversations.map((conversation) => conversation.conversationId),
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
  const conversationItems = conversations.map((conversation) => {
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
      ? 'New activity'
      : conversation.lastMessageAt
        ? 'Up to date'
        : 'Ready to start';

    return {
      conversationId: conversation.conversationId,
      isGroupConversation,
      title,
      preview,
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

  return (
    <section className="stack inbox-screen inbox-screen-minimal">
      <InboxRealtimeSync
        conversationIds={conversations.map((conversation) => conversation.conversationId)}
        userId={user.id}
      />

      <section className="card inbox-home-shell stack">
        <div className="inbox-topbar">
          <div className="stack inbox-topbar-copy">
            <h1 className="inbox-home-title">Chats</h1>
            <p className="muted inbox-home-subtitle">
              {unreadConversationCount > 0
                ? `${unreadConversationCount} new`
                : conversationItems.length > 0
                  ? 'Caught up'
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
            <label className="field inbox-search-field">
              <span className="sr-only">Search chats</span>
              <input
                className="input inbox-search-input"
                defaultValue={query.q ?? ''}
                name="q"
                placeholder="Search"
                type="search"
              />
            </label>
            {activeFilter !== 'all' ? (
              <input name="filter" type="hidden" value={activeFilter} />
            ) : null}
            {searchTerm ? (
              <Link
                className="pill inbox-search-clear"
                href={buildFilterHref(activeFilter)}
              >
                Clear
              </Link>
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
              href={buildFilterHref('all', query.q)}
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
              href={buildFilterHref('dm', query.q)}
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
              href={buildFilterHref('groups', query.q)}
            >
              Groups
            </Link>
          </div>
        </div>
      </section>

      {query.error ? <p className="notice notice-error">{query.error}</p> : null}

      {conversationItems.length === 0 ? (
          <section className="card stack empty-card inbox-empty-state">
          <h2 className="card-title">No chats yet</h2>
          <p className="muted">
            Start one from the + button.
          </p>
        </section>
      ) : filteredConversationItems.length === 0 ? (
        <section className="card stack empty-card inbox-empty-state">
          <h2 className="card-title">No matching chats</h2>
          <p className="muted">
            Try a different filter or clear the search.
          </p>
        </section>
      ) : (
        <section className="stack conversation-list conversation-list-minimal">
          {filteredConversationItems.map((conversation) => (
            <Link
              key={conversation.conversationId}
              className={
                conversation.hasUnread
                  ? 'conversation-card conversation-card-unread conversation-card-minimal'
                  : 'conversation-card conversation-card-minimal'
              }
              href={`/chat/${conversation.conversationId}`}
            >
              <div className="conversation-row">
                {conversation.isGroupConversation ? (
                  <GroupIdentityAvatar
                    label={conversation.title}
                    size="md"
                  />
                ) : (
                  <IdentityAvatar
                    identity={conversation.participants[0]}
                    label={conversation.title}
                    size="md"
                  />
                )}

                <div className="stack conversation-card-copy">
                  <div className="stack conversation-main-copy">
                    <div className="conversation-title-row">
                      <h3 className="conversation-title">{conversation.title}</h3>
                      <div className="conversation-title-meta">
                        <span className="conversation-recency">
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
                    <span
                      className={
                        conversation.hasUnread
                          ? 'conversation-read-state conversation-read-state-unread'
                          : 'muted conversation-read-state'
                      }
                    >
                      {conversation.readStateLabel}
                    </span>
                    <p className="muted conversation-timestamp">
                      {conversation.timestampLabel}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
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
