import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getAvailableUsers,
  getConversationParticipantIdentities,
  getInboxConversations,
} from '@/modules/messaging/data/server';
import {
  getIdentityLabel,
  IdentityAvatar,
  IdentityAvatarStack,
} from '@/modules/messaging/ui/identity';
import Link from 'next/link';
import { createDmAction, createGroupAction } from './actions';

type InboxPageProps = {
  searchParams: Promise<{
    error?: string;
    q?: string;
  }>;
};

type ConversationListItem = {
  conversationId: string;
  isGroupConversation: boolean;
  title: string;
  preview: string;
  recencyLabel: string;
  timestampLabel: string;
  lastActivityAt: string | null;
  participants: Array<{
    userId: string;
    displayName: string | null;
    avatarPath?: string | null;
  }>;
  participantLabels: string[];
  unreadCount: number;
  hasUnread: boolean;
};

function normalizeSearchTerm(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
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

function formatConversationIdentitySummary(
  labels: string[],
  maxVisible = 2,
) {
  if (labels.length === 0) {
    return null;
  }

  const preview = labels.slice(0, maxVisible);
  const remaining = Math.max(0, labels.length - preview.length);

  return `${preview.join(', ')}${remaining > 0 ? ` +${remaining}` : ''}`;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const query = await searchParams;
  const searchTerm = normalizeSearchTerm(query.q);
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
  const availableUserLabels = new Map(
    availableUsers.map((availableUser) => [
      availableUser.userId,
      getIdentityLabel(
        availableUser,
        getFallbackIdentityLabel(
          availableUser.userId,
          fallbackIdentityLabels,
          'Member',
        ),
      ),
    ]),
  );
  const availableUserEntries = availableUsers.map((availableUser) => ({
    ...availableUser,
    label: availableUserLabels.get(availableUser.userId) ?? 'Available user',
  }));
  const conversationItems = conversations.map((conversation) => {
    const participantOptions =
      participantIdentitiesByConversation.get(conversation.conversationId) ?? [];
    const otherParticipants = participantOptions.filter(
      (participant) => participant.userId !== user.id,
    );
    const otherParticipantLabels = otherParticipants.map((participant) =>
      getIdentityLabel(
        participant,
        getFallbackIdentityLabel(
          participant.userId,
          fallbackIdentityLabels,
        ),
      ),
    );
    const isGroupConversation = conversation.kind === 'group';
    const title =
      conversation.title?.trim() ||
      (isGroupConversation
        ? formatConversationIdentitySummary(otherParticipantLabels) || 'New group'
        : otherParticipantLabels[0] || 'Direct message');
    const preview = isGroupConversation
      ? formatConversationIdentitySummary(otherParticipantLabels, 3)
        ? `${formatConversationIdentitySummary(otherParticipantLabels, 3)} in this group`
        : 'Group conversation ready for updates.'
      : otherParticipantLabels[0]
        ? `Direct conversation with ${otherParticipantLabels[0]}`
        : 'Direct conversation ready for messages.';
    const lastActivityAt = conversation.lastMessageAt ?? conversation.createdAt;

    return {
      conversationId: conversation.conversationId,
      isGroupConversation,
      title,
      preview,
      recencyLabel: formatRecency(lastActivityAt),
      timestampLabel: formatTimestamp(lastActivityAt),
      lastActivityAt,
      participants: otherParticipants,
      participantLabels: otherParticipantLabels,
      unreadCount: conversation.unreadCount,
      hasUnread: conversation.unreadCount > 0,
    } satisfies ConversationListItem;
  });
  const filteredConversationItems = searchTerm
    ? conversationItems.filter((conversation) => {
        const haystack = [
          conversation.title,
          conversation.preview,
          ...conversation.participantLabels,
          conversation.isGroupConversation ? 'group' : 'direct',
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(searchTerm);
      })
    : conversationItems;
  const filteredAvailableUsers = searchTerm
    ? availableUserEntries.filter((availableUser) =>
        availableUser.label.toLowerCase().includes(searchTerm),
      )
    : availableUserEntries;

  return (
    <section className="stack inbox-screen">
      <section className="card inbox-hero stack">
        <div className="stack inbox-hero-copy">
          <p className="eyebrow">Inbox</p>
          <h1 className="inbox-title">Your conversations</h1>
          <p className="muted inbox-subtitle">
            Jump back into an existing chat, start a direct message, or open a
            new group.
          </p>
        </div>

        <div className="cluster inbox-summary">
          <span className="summary-pill">
            {conversations.length} chat{conversations.length === 1 ? '' : 's'}
          </span>
          <span className="summary-pill summary-pill-muted">
            {availableUsers.length} available user
            {availableUsers.length === 1 ? '' : 's'}
          </span>
          {searchTerm ? (
            <span className="summary-pill summary-pill-muted">
              {filteredConversationItems.length + filteredAvailableUsers.length} matches
            </span>
          ) : null}
        </div>

        <form action="/inbox" className="inbox-search-form" role="search">
          <label className="field inbox-search-field">
            <span className="sr-only">Search chats and people</span>
            <input
              className="input inbox-search-input"
              defaultValue={query.q ?? ''}
              name="q"
              placeholder="Search chats and people"
              type="search"
            />
          </label>
          <button className="button button-compact" type="submit">
            Search
          </button>
          {searchTerm ? (
            <Link className="pill inbox-search-clear" href="/inbox">
              Clear
            </Link>
          ) : null}
        </form>

        <p className="muted inbox-search-note">
          This first pass filters conversation names and people. Message text
          search is not included yet.
        </p>
      </section>

      {query.error ? <p className="notice notice-error">{query.error}</p> : null}

      <section className="section-block stack">
        <div className="section-heading stack">
          <p className="eyebrow">Chats</p>
          <h2 className="section-title">Recent conversations</h2>
          <p className="muted">
            Direct messages and groups connected to your account.
          </p>
        </div>

        {conversations.length === 0 ? (
          <section className="card stack empty-card">
            <h3 className="card-title">No chats yet</h3>
            <p className="muted">
              Start with a direct message below or create a group to begin your
              inbox.
            </p>
          </section>
        ) : filteredConversationItems.length === 0 ? (
          <section className="card stack empty-card">
            <h3 className="card-title">No matching chats</h3>
            <p className="muted">
              Try a different name or clear the search to see all conversations.
            </p>
          </section>
        ) : (
          <section className="stack conversation-list">
            {filteredConversationItems.map((conversation) => (
              <Link
                key={conversation.conversationId}
                className={
                  conversation.hasUnread
                    ? 'conversation-card conversation-card-unread'
                    : 'conversation-card'
                }
                href={`/chat/${conversation.conversationId}`}
              >
                <div className="conversation-row">
                  {conversation.isGroupConversation ? (
                    <IdentityAvatarStack
                      identities={conversation.participants}
                      labels={conversation.participantLabels}
                    />
                  ) : (
                    <IdentityAvatar
                      identity={conversation.participants[0]}
                      label={conversation.participantLabels[0] || 'Direct message'}
                      size="md"
                    />
                  )}

                  <div className="stack conversation-card-copy">
                    <div className="stack conversation-main-copy">
                      <div className="conversation-title-row">
                        <h3 className="conversation-title">{conversation.title}</h3>
                        <div className="conversation-title-meta">
                          {conversation.hasUnread ? (
                            <span className="conversation-unread-badge" aria-label="Unread messages">
                              New
                            </span>
                          ) : null}
                          <span className="conversation-recency">
                            {conversation.recencyLabel}
                          </span>
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
                            ? 'conversation-meta conversation-meta-unread'
                            : 'conversation-meta'
                        }
                      >
                        {conversation.isGroupConversation ? 'Group' : 'Direct'}
                      </span>
                      <p className="muted conversation-timestamp">
                        {conversation.hasUnread
                          ? `${conversation.timestampLabel} · New activity`
                          : conversation.timestampLabel}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </section>

      <section className="section-block stack">
        <div className="section-heading stack">
          <p className="eyebrow">People</p>
          <h2 className="section-title">Start a direct chat</h2>
          <p className="muted">
            Pick someone from the internal user list to open a conversation.
          </p>
        </div>

        <section className="card stack create-card">
          {availableUsers.length === 0 ? (
            <section className="empty-card stack">
              <h3 className="card-title">No people available yet</h3>
              <p className="muted">
                When more profiles appear in the system, you’ll be able to start
                a direct chat from here.
              </p>
            </section>
          ) : filteredAvailableUsers.length === 0 ? (
            <section className="empty-card stack">
              <h3 className="card-title">No matching people</h3>
              <p className="muted">
                Try a different name or clear the search to browse everyone in
                this workspace.
              </p>
            </section>
          ) : (
            <div className="user-list">
              {filteredAvailableUsers.map((availableUser) => (
                <div key={availableUser.userId} className="user-card">
                  <div className="user-row">
                    <IdentityAvatar
                      identity={availableUser}
                      label={
                        availableUser.label
                      }
                      size="sm"
                    />
                    <div className="stack user-copy">
                      <span className="user-label">{availableUser.label}</span>
                      <span className="muted">Available to message</span>
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
      </section>

      <section className="section-block stack">
        <div className="section-heading stack">
          <p className="eyebrow">Groups</p>
          <h2 className="section-title">Create a group</h2>
          <p className="muted">
            Add a title and choose who should be included from the start.
          </p>
        </div>

        <section className="card stack create-card">
          <form action={createGroupAction} className="stack compact-form">
            <label className="field">
              <span>Group title</span>
              <input
                className="input"
                name="title"
                placeholder="Weekend planning"
                required
              />
            </label>

            <fieldset className="selector-card">
              <legend className="selector-title">Members</legend>
              {availableUsers.length === 0 ? (
                <p className="muted">No other users available to add yet.</p>
              ) : (
                <div className="checkbox-list">
                  {filteredAvailableUsers.map((availableUser) => (
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
                        <span className="muted">Add to this group</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <button className="button" type="submit">
              Create group
            </button>
          </form>
        </section>
      </section>
    </section>
  );
}
