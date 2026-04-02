import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getConversationForUser,
  getConversationMessages,
  getMessageSenderProfiles,
  getGroupedReactionsForMessages,
  STARTER_REACTIONS,
} from '@/modules/messaging/data/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sendMessageAction, toggleReactionAction } from './actions';
import { AutoGrowTextarea } from './auto-grow-textarea';

type ChatPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

function formatMessageTimestamp(value: string | null) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function createFallbackSenderName(
  senderId: string | null,
  currentUserId: string,
  fallbackNames: Map<string, string>,
) {
  if (!senderId) {
    return 'Unknown sender';
  }

  if (senderId === currentUserId) {
    return 'You';
  }

  const existing = fallbackNames.get(senderId);

  if (existing) {
    return existing;
  }

  const nextName = `Person ${fallbackNames.size + 1}`;
  fallbackNames.set(senderId, nextName);

  return nextName;
}

export default async function ChatPage({
  params,
  searchParams,
}: ChatPageProps) {
  const { conversationId } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const conversation = await getConversationForUser(conversationId, user.id);

  if (!conversation) {
    notFound();
  }

  const messages = await getConversationMessages(conversationId);
  const senderProfiles = await getMessageSenderProfiles(
    messages.map((message) => message.sender_id ?? ''),
  );
  const reactionsByMessage = await getGroupedReactionsForMessages(
    messages.map((message) => message.id),
    user.id,
  );
  const senderNames = new Map(
    senderProfiles.map((profile) => [profile.userId, profile.displayName]),
  );
  const fallbackNames = new Map<string, string>();

  return (
    <section className="stack chat-screen">
      <section className="stack chat-header-stack">
        <Link className="pill conversation-back" href="/inbox">
          Back
        </Link>

        <section className="card stack chat-header-card">
          <div className="stack chat-header-copy">
            <p className="eyebrow">
              {conversation.kind === 'group' ? 'Group chat' : 'Direct chat'}
            </p>
                <h1 className="conversation-screen-title">
              {conversation.title?.trim() ||
                (conversation.kind === 'group'
                  ? 'Untitled group'
                  : 'Direct message')}
            </h1>
            <p className="muted chat-header-subtitle">
              A simple conversation view built for quick, lightweight messaging.
            </p>
          </div>

          <div className="chat-header-meta">
            <span className="summary-pill">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </span>
          </div>
        </section>
      </section>

      {query.error ? <p className="notice notice-error">{query.error}</p> : null}

      <section className="chat-main">
        <section className="message-thread">
          {messages.length === 0 ? (
            <section className="card stack empty-card chat-empty-card">
              <span className="chat-empty-kicker">New conversation</span>
              <h2 className="card-title">Say the first hello</h2>
              <p className="muted">
                This chat is ready to start. Send a short message below to open
                the conversation naturally.
              </p>
              <Link className="pill pill-accent chat-empty-cta" href="#message-composer">
                Write a message
              </Link>
            </section>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.sender_id === user.id
                    ? 'message-row message-row-own'
                    : 'message-row'
                }
              >
                <div
                  className={
                    message.sender_id === user.id
                      ? 'message-card message-card-own'
                      : 'message-card'
                  }
                >
                  <div
                    className={
                      message.sender_id === user.id
                        ? 'message-header message-header-own'
                        : 'message-header'
                    }
                  >
                    <div className="stack message-header-copy">
                      <span className="message-sender">
                        {senderNames.get(message.sender_id ?? '') ||
                          createFallbackSenderName(
                            message.sender_id,
                            user.id,
                            fallbackNames,
                          )}
                      </span>
                      <span className="message-kind">Text message</span>
                    </div>
                    <span
                      className={
                        message.sender_id === user.id
                          ? 'message-meta message-meta-own'
                          : 'message-meta'
                      }
                    >
                      {formatMessageTimestamp(message.created_at) || 'Just now'}
                    </span>
                  </div>
                  <div
                    className={
                      message.sender_id === user.id
                        ? 'message-bubble message-bubble-own'
                        : 'message-bubble'
                    }
                  >
                    <p className="message-body">
                      {message.body?.trim() || 'Empty message'}
                    </p>
                  </div>

                  {reactionsByMessage.get(message.id)?.length ? (
                    <div
                      className={
                        message.sender_id === user.id
                          ? 'reaction-groups reaction-groups-own'
                          : 'reaction-groups'
                      }
                      aria-label="Message reactions"
                    >
                      {reactionsByMessage.get(message.id)?.map((reaction) => (
                        <form
                          key={`${message.id}-${reaction.emoji}`}
                          action={toggleReactionAction}
                        >
                          <input
                            name="conversationId"
                            type="hidden"
                            value={conversationId}
                          />
                          <input name="messageId" type="hidden" value={message.id} />
                          <input name="emoji" type="hidden" value={reaction.emoji} />
                          <button
                            className={
                              reaction.selectedByCurrentUser
                                ? 'reaction-pill reaction-pill-selected'
                                : 'reaction-pill'
                            }
                            type="submit"
                          >
                            <span>{reaction.emoji}</span>
                            <span className="reaction-count">{reaction.count}</span>
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : null}

                  <div
                    className={
                      message.sender_id === user.id
                        ? 'reaction-picker-block stack reaction-picker-block-own'
                        : 'reaction-picker-block stack'
                    }
                  >
                    <p className="reaction-picker-label">Quick reactions</p>
                    <div
                      className={
                        message.sender_id === user.id
                          ? 'reaction-picker reaction-picker-own'
                          : 'reaction-picker'
                      }
                      aria-label="Add a reaction"
                    >
                      {STARTER_REACTIONS.map((emoji) => {
                        const currentReaction = reactionsByMessage
                          .get(message.id)
                          ?.find((reaction) => reaction.emoji === emoji);

                        return (
                          <form
                            key={`${message.id}-picker-${emoji}`}
                            action={toggleReactionAction}
                          >
                            <input
                              name="conversationId"
                              type="hidden"
                              value={conversationId}
                            />
                            <input
                              name="messageId"
                              type="hidden"
                              value={message.id}
                            />
                            <input name="emoji" type="hidden" value={emoji} />
                            <button
                              className={
                                currentReaction?.selectedByCurrentUser
                                  ? 'reaction-toggle reaction-toggle-selected'
                                  : 'reaction-toggle'
                              }
                              type="submit"
                            >
                              <span>{emoji}</span>
                              {currentReaction ? (
                                <span className="reaction-count">
                                  {currentReaction.count}
                                </span>
                              ) : null}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        <section className="card stack composer-card" id="message-composer">
          <div className="stack composer-header">
            <h2 className="card-title">New message</h2>
            <p className="muted">Send a simple text message to this chat.</p>
          </div>
          <form action={sendMessageAction} className="stack composer-form">
            <input name="conversationId" type="hidden" value={conversationId} />
            <label className="field">
              <span className="sr-only">Message</span>
              <AutoGrowTextarea
                className="input textarea"
                name="body"
                placeholder="Write a message"
                rows={2}
                required
                maxHeight={160}
              />
            </label>
            <button className="button composer-button" type="submit">
              Send
            </button>
          </form>
        </section>
      </section>
    </section>
  );
}
