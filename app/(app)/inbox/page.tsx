import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getAvailableUsers,
  getInboxConversations,
} from '@/modules/messaging/data/server';
import Link from 'next/link';
import { createDmAction, createGroupAction } from './actions';

type InboxPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function getDirectoryLabel(index: number) {
  return `Person ${index + 1}`;
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

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const query = await searchParams;
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
        </div>
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
        ) : (
          <section className="stack conversation-list">
            {conversations.map((conversation) => (
              <Link
                key={conversation.conversationId}
                className="conversation-card"
                href={`/chat/${conversation.conversationId}`}
              >
                <div className="stack conversation-card-copy">
                  <div className="conversation-row">
                    <h3 className="conversation-title">
                      {conversation.title?.trim() ||
                        (conversation.kind === 'dm'
                          ? 'Direct message'
                          : 'Untitled group')}
                    </h3>
                    <span className="conversation-meta">
                      {conversation.kind === 'group' ? 'Group' : 'Direct'}
                    </span>
                  </div>
                  <p className="muted conversation-timestamp">
                    Last activity {formatTimestamp(conversation.lastMessageAt)}
                  </p>
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
          ) : (
            <div className="user-list">
              {availableUsers.map((availableUser, index) => (
                <div key={availableUser.userId} className="user-card">
                  <div className="stack user-copy">
                    <span className="user-label">{getDirectoryLabel(index)}</span>
                    <span className="muted">Available to message</span>
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
                  {availableUsers.map((availableUser, index) => (
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
                        <span className="user-label">
                          {getDirectoryLabel(index)}
                        </span>
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
