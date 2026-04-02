import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getConversationForUser,
  getConversationMessages,
  getConversationParticipants,
  getConversationReadState,
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
    replyToMessageId?: string;
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

function getCalendarDayKey(value: string | null) {
  if (!value) {
    return 'unknown';
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDaySeparatorLabel(value: string | null) {
  if (!value) {
    return 'Earlier';
  }

  const targetDate = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const compareDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );

  if (compareDate.getTime() === today.getTime()) {
    return 'Today';
  }

  if (compareDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year:
      targetDate.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(targetDate);
}

function formatConversationCreatedDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
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

function getMessageSnippet(value: string | null, maxLength = 90) {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return 'Empty message';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function formatGroupMemberSummary(
  participantIds: string[],
  currentUserId: string,
  displayNames: Map<string, string | null>,
) {
  const fallbackNames = new Map<string, string>();

  const labels = participantIds.map((participantId) => {
    if (participantId === currentUserId) {
      return 'You';
    }

    const displayName = displayNames.get(participantId)?.trim();

    if (displayName) {
      return displayName;
    }

    const existing = fallbackNames.get(participantId);

    if (existing) {
      return existing;
    }

    const nextLabel = `Person ${fallbackNames.size + 1}`;
    fallbackNames.set(participantId, nextLabel);

    return nextLabel;
  });

  const otherLabels = labels.filter((label) => label !== 'You');
  const previewNames = otherLabels.slice(0, 2);
  const remainingCount = Math.max(0, otherLabels.length - previewNames.length);
  const memberLabel = `${participantIds.length} member${participantIds.length === 1 ? '' : 's'}`;

  if (previewNames.length === 0) {
    return memberLabel;
  }

  return `${memberLabel} · ${previewNames.join(', ')}${
    remainingCount > 0 ? ` +${remainingCount}` : ''
  }`;
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
  const readState = await getConversationReadState(conversationId, user.id);
  const participants =
    conversation.kind === 'group'
      ? await getConversationParticipants(conversationId)
      : [];
  const senderProfiles = await getMessageSenderProfiles(
    Array.from(
      new Set([
        ...messages.map((message) => message.sender_id ?? ''),
        ...participants.map((participant) => participant.userId),
      ]),
    ),
  );
  const reactionsByMessage = await getGroupedReactionsForMessages(
    messages.map((message) => message.id),
    user.id,
  );
  const senderNames = new Map(
    senderProfiles.map((profile) => [profile.userId, profile.displayName]),
  );
  const fallbackNames = new Map<string, string>();
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const groupMemberSummary =
    conversation.kind === 'group'
      ? formatGroupMemberSummary(
          participants.map((participant) => participant.userId),
          user.id,
          senderNames,
        )
      : null;
  const conversationCreatedLabel = formatConversationCreatedDate(
    conversation.createdAt ?? null,
  );
  const introTitle =
    conversation.kind === 'group' ? 'Conversation info' : 'Start of chat';
  const introBody =
    conversation.kind === 'group'
      ? groupMemberSummary
        ? `${groupMemberSummary}. Use this space to keep the group moving with quick updates.`
        : 'This group is ready for quick updates and conversation.'
      : 'This direct conversation is ready for a first message or a quick follow-up.';
  const activeReplyTarget = query.replyToMessageId
    ? messagesById.get(query.replyToMessageId) ?? null
    : null;
  const timelineItems = messages.flatMap((message, index) => {
    const previousMessage = messages[index - 1];
    const currentDayKey = getCalendarDayKey(message.created_at);
    const previousDayKey = previousMessage
      ? getCalendarDayKey(previousMessage.created_at)
      : null;
    const items: Array<
      | { type: 'separator'; key: string; label: string }
      | { type: 'unread'; key: string; label: string }
      | { type: 'message'; key: string; message: (typeof messages)[number] }
    > = [];

    if (currentDayKey !== previousDayKey) {
      items.push({
        type: 'separator',
        key: `day-${currentDayKey}-${message.id}`,
        label: formatDaySeparatorLabel(message.created_at),
      });
    }

    const messageSeq =
      typeof message.seq === 'number' ? message.seq : Number(message.seq);
    const previousSeq = previousMessage
      ? typeof previousMessage.seq === 'number'
        ? previousMessage.seq
        : Number(previousMessage.seq)
      : null;
    const hasUnreadBoundary =
      readState.lastReadMessageSeq !== null &&
      Number.isFinite(messageSeq) &&
      messageSeq > readState.lastReadMessageSeq &&
      (previousSeq === null || previousSeq <= readState.lastReadMessageSeq);

    if (hasUnreadBoundary) {
      items.push({
        type: 'unread',
        key: `unread-${message.id}`,
        label: 'Unread messages',
      });
    }

    items.push({
      type: 'message',
      key: message.id,
      message,
    });

    return items;
  });

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
            {conversation.kind === 'group' ? (
              <p className="muted chat-member-summary">{groupMemberSummary}</p>
            ) : (
              <p className="muted chat-header-subtitle">
                A simple conversation view built for quick, lightweight
                messaging.
              </p>
            )}
          </div>

          <div className="chat-header-meta">
            <span className="summary-pill">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </span>
          </div>
        </section>
      </section>

      <section className="card chat-intro-card">
        <div className="chat-intro-copy">
          <p className="chat-intro-label">{introTitle}</p>
          <p className="chat-intro-text">{introBody}</p>
        </div>
        <div className="chat-intro-meta">
          <span className="chat-intro-pill">
            {conversation.kind === 'group' ? 'Group' : 'Direct'}
          </span>
          <span className="chat-intro-meta-text">
            {messages.length} message{messages.length === 1 ? '' : 's'}
            {conversationCreatedLabel ? ` · Started ${conversationCreatedLabel}` : ''}
          </span>
        </div>
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
            timelineItems.map((item) => {
              if (item.type === 'separator') {
                return (
                  <div
                    key={item.key}
                    className="message-day-separator"
                    aria-label={`Messages from ${item.label}`}
                  >
                    <span className="message-day-label">{item.label}</span>
                  </div>
                );
              }

              if (item.type === 'unread') {
                return (
                  <div
                    key={item.key}
                    className="message-unread-separator"
                    aria-label={item.label}
                  >
                    <span className="message-unread-label">{item.label}</span>
                  </div>
                );
              }

              const { message } = item;
              const isOwnMessage = message.sender_id === user.id;

              return (
                <article
                  key={item.key}
                  className={isOwnMessage ? 'message-row message-row-own' : 'message-row'}
                >
                  <div
                    className={
                      isOwnMessage
                        ? 'message-swipe-track message-swipe-track-own'
                        : 'message-swipe-track'
                    }
                  >
                    <div
                      className={
                        isOwnMessage
                          ? 'message-action-rail message-action-rail-own'
                          : 'message-action-rail'
                      }
                      aria-label="Message actions"
                    >
                      <a
                        className="message-action-chip"
                        href={`/chat/${conversationId}?replyToMessageId=${message.id}#message-composer`}
                      >
                        Reply
                      </a>
                      <a
                        className="message-action-chip"
                        href={`#message-reactions-${message.id}`}
                      >
                        React
                      </a>
                    </div>

                      <div
                        className={
                          isOwnMessage ? 'message-card message-card-own' : 'message-card'
                        }
                      >
                      <div
                        className={
                          isOwnMessage
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
                            isOwnMessage
                              ? 'message-meta message-meta-own'
                              : 'message-meta'
                          }
                        >
                          <span>{formatMessageTimestamp(message.created_at) || 'Just now'}</span>
                          {isOwnMessage ? (
                            <span className="message-status" aria-label="Sent">
                              Sent
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div
                        className={
                          isOwnMessage
                            ? 'message-bubble message-bubble-own'
                            : 'message-bubble'
                        }
                      >
                        {message.reply_to_message_id ? (
                          <div className="message-reply-reference">
                            <span className="message-reply-sender">
                              {(() => {
                                const repliedMessage = messagesById.get(
                                  message.reply_to_message_id,
                                );

                                if (!repliedMessage) {
                                  return 'Earlier message';
                                }

                                return (
                                  senderNames.get(repliedMessage.sender_id ?? '') ||
                                  createFallbackSenderName(
                                    repliedMessage.sender_id,
                                    user.id,
                                    fallbackNames,
                                  )
                                );
                              })()}
                            </span>
                            <span className="message-reply-snippet">
                              {getMessageSnippet(
                                messagesById.get(message.reply_to_message_id)
                                  ?.body ?? null,
                                72,
                              )}
                            </span>
                          </div>
                        ) : null}
                        <p className="message-body">
                          {message.body?.trim() || 'Empty message'}
                        </p>
                      </div>

                      {reactionsByMessage.get(message.id)?.length ? (
                        <div
                          className={
                            isOwnMessage
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
                              <input
                                name="messageId"
                                type="hidden"
                                value={message.id}
                              />
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
                        id={`message-reactions-${message.id}`}
                        className={
                          isOwnMessage
                            ? 'reaction-picker-block stack reaction-picker-block-own'
                            : 'reaction-picker-block stack'
                        }
                      >
                        <p className="reaction-picker-label">Quick reactions</p>
                        <div
                          className={
                            isOwnMessage
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
                  </div>
                </article>
              );
            })
          )}
        </section>

        <section className="card stack composer-card" id="message-composer">
          <div className="stack composer-header">
            <h2 className="card-title">New message</h2>
            <p className="muted">Send a simple text message to this chat.</p>
          </div>
          {activeReplyTarget ? (
            <div className="composer-reply-preview">
              <div className="stack composer-reply-copy">
                <span className="composer-reply-label">Replying to</span>
                <span className="composer-reply-sender">
                  {senderNames.get(activeReplyTarget.sender_id ?? '') ||
                    createFallbackSenderName(
                      activeReplyTarget.sender_id,
                      user.id,
                      fallbackNames,
                    )}
                </span>
                <span className="composer-reply-snippet">
                  {getMessageSnippet(activeReplyTarget.body, 88)}
                </span>
              </div>
              <Link
                className="pill composer-reply-cancel"
                href={`/chat/${conversationId}#message-composer`}
              >
                Cancel
              </Link>
            </div>
          ) : null}
          <form action={sendMessageAction} className="stack composer-form">
            <input name="conversationId" type="hidden" value={conversationId} />
            {activeReplyTarget ? (
              <input
                name="replyToMessageId"
                type="hidden"
                value={activeReplyTarget.id}
              />
            ) : null}
            <div className="composer-entry-row">
              <details className="attachment-entry">
                <summary className="attachment-trigger" aria-label="Attachment options">
                  +
                </summary>
                <div className="attachment-menu" role="menu" aria-label="Attachment options">
                  <button className="attachment-option" type="button">
                    <span>Photo</span>
                    <span className="attachment-option-note">Soon</span>
                  </button>
                  <button className="attachment-option" type="button">
                    <span>File</span>
                    <span className="attachment-option-note">Soon</span>
                  </button>
                  <button className="attachment-option" type="button">
                    <span>Camera</span>
                    <span className="attachment-option-note">Soon</span>
                  </button>
                </div>
              </details>

              <label className="field composer-input-field">
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
            </div>
          </form>
        </section>
      </section>
    </section>
  );
}
