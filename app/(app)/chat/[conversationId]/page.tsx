import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getAvailableUsers,
  CHAT_ATTACHMENT_ACCEPT,
  getConversationForUser,
  getConversationMessages,
  getConversationMemberReadStates,
  getConversationParticipants,
  getConversationReadState,
  getMessageAttachments,
  getMessageSenderProfiles,
  getGroupedReactionsForMessages,
  STARTER_REACTIONS,
} from '@/modules/messaging/data/server';
import { ActiveChatRealtimeSync } from '@/modules/messaging/realtime/active-chat-sync';
import {
  getIdentityLabel,
  IdentityAvatar,
  IdentityAvatarStack,
} from '@/modules/messaging/ui/identity';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  addGroupParticipantsAction,
  deleteMessageAction,
  editMessageAction,
  leaveGroupAction,
  removeGroupParticipantAction,
  sendMessageAction,
  toggleReactionAction,
  updateConversationTitleAction,
} from './actions';
import { AutoGrowTextarea } from './auto-grow-textarea';
import { ComposerAttachmentPicker } from './composer-attachment-picker';
import { MarkConversationRead } from './mark-conversation-read';

type ChatPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    replyToMessageId?: string;
    editMessageId?: string;
    deleteMessageId?: string;
    settings?: string;
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

function formatLongDate(value: string | null) {
  if (!value) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
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

function formatAttachmentSize(value: number | null) {
  if (!value || Number.isNaN(value)) {
    return null;
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isEditedMessage(value: { edited_at: string | null; deleted_at: string | null }) {
  return Boolean(value.edited_at && !value.deleted_at);
}

function getMessageSeq(value: number | string) {
  return typeof value === 'number' ? value : Number(value);
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

function formatParticipantRoleLabel(role: string | null, isCurrentUser: boolean) {
  if (role === 'owner') {
    return isCurrentUser ? 'Owner · You' : 'Owner';
  }

  if (role === 'admin') {
    return isCurrentUser ? 'Admin · You' : 'Admin';
  }

  return isCurrentUser ? 'Member · You' : 'Member';
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

  const isSettingsOpen = query.settings === 'open';
  const messages = await getConversationMessages(conversationId);
  const readState = await getConversationReadState(conversationId, user.id);
  const memberReadStates = await getConversationMemberReadStates(conversationId);
  const participants = await getConversationParticipants(conversationId);
  const availableUsers =
    conversation.kind === 'group' && isSettingsOpen
      ? await getAvailableUsers(user.id)
      : [];
  const senderProfiles = await getMessageSenderProfiles(
    Array.from(
      new Set([
        ...messages.map((message) => message.sender_id ?? ''),
        ...participants.map((participant) => participant.userId),
        ...availableUsers.map((availableUser) => availableUser.userId),
      ]),
    ),
  );
  const reactionsByMessage = await getGroupedReactionsForMessages(
    messages.map((message) => message.id),
    user.id,
  );
  const attachmentsByMessage = await getMessageAttachments(
    messages.map((message) => message.id),
  );
  const senderNames = new Map(
    senderProfiles.map((profile) => [profile.userId, profile.displayName]),
  );
  const senderIdentities = new Map(
    senderProfiles.map((profile) => [profile.userId, profile]),
  );
  const fallbackNames = new Map<string, string>();
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const otherParticipants = participants.filter(
    (participant) => participant.userId !== user.id,
  );
  const otherParticipantLabels = otherParticipants.map((participant) =>
    getIdentityLabel(
      senderIdentities.get(participant.userId),
      createFallbackSenderName(participant.userId, user.id, fallbackNames),
    ),
  );
  const directParticipantIdentity = otherParticipants[0]
    ? senderIdentities.get(otherParticipants[0].userId)
    : null;
  const conversationDisplayTitle =
    conversation.title?.trim() ||
    (conversation.kind === 'group'
      ? 'Untitled group'
      : otherParticipantLabels[0] || 'Direct message');
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
      : otherParticipantLabels[0]
        ? `A direct conversation with ${otherParticipantLabels[0]}. Send a quick update or continue where you left off.`
        : 'This direct conversation is ready for a first message or a quick follow-up.';
  const activeReplyTarget = query.replyToMessageId
    ? messagesById.get(query.replyToMessageId) ?? null
    : null;
  const activeEditMessageId = query.editMessageId?.trim() || null;
  const activeDeleteMessageId = query.deleteMessageId?.trim() || null;
  const canEditGroupTitle =
    conversation.kind === 'group' && conversation.createdBy === user.id;
  const canManageGroupParticipants =
    conversation.kind === 'group' &&
    participants.some(
      (participant) => participant.userId === user.id && participant.role === 'owner',
    );
  const participantItems = participants.map((participant) => {
    const identity = senderIdentities.get(participant.userId);
    const label = getIdentityLabel(
      identity,
      createFallbackSenderName(participant.userId, user.id, fallbackNames),
    );

    return {
      userId: participant.userId,
      identity,
      label,
      isCurrentUser: participant.userId === user.id,
      role: participant.role ?? 'member',
    };
  });
  const activeParticipantUserIds = new Set(participants.map((participant) => participant.userId));
  const availableParticipantsToAdd = availableUsers
    .filter((availableUser) => !activeParticipantUserIds.has(availableUser.userId))
    .map((availableUser) => ({
      ...availableUser,
      label: getIdentityLabel(
        senderIdentities.get(availableUser.userId),
        createFallbackSenderName(availableUser.userId, user.id, fallbackNames),
      ),
    }));
  const latestVisibleMessageSeq =
    messages.length > 0
      ? getMessageSeq(messages[messages.length - 1]?.seq ?? 0)
      : null;
  const otherParticipantReadState =
    conversation.kind === 'dm'
      ? memberReadStates.find((state) => state.userId !== user.id) ?? null
      : null;
  const latestOwnVisibleMessage = [...messages]
    .reverse()
    .find((message) => message.sender_id === user.id && !message.deleted_at);
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

    const messageSeq = getMessageSeq(message.seq);
    const previousSeq = previousMessage
      ? getMessageSeq(previousMessage.seq)
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
      <ActiveChatRealtimeSync conversationId={conversationId} />

      <section className="stack chat-header-stack">
        <Link className="pill conversation-back" href="/inbox">
          Back
        </Link>

        <section className="card stack chat-header-card">
          <div className="chat-header-identity">
            {conversation.kind === 'group' ? (
              <IdentityAvatarStack
                identities={otherParticipants.map((participant) =>
                  senderIdentities.get(participant.userId),
                )}
                labels={otherParticipantLabels}
              />
            ) : (
              <IdentityAvatar
                identity={directParticipantIdentity}
                label={otherParticipantLabels[0] || 'Direct message'}
                size="lg"
              />
            )}

            <div className="stack chat-header-copy">
              <p className="eyebrow">
                {conversation.kind === 'group' ? 'Group chat' : 'Direct chat'}
              </p>
              <h1 className="conversation-screen-title">
                {conversationDisplayTitle}
              </h1>
              {conversation.kind === 'group' ? (
                <p className="muted chat-member-summary">{groupMemberSummary}</p>
              ) : (
                <p className="muted chat-header-subtitle">
                  {otherParticipantLabels[0]
                    ? `${otherParticipantLabels[0]} is ready for a quick message.`
                    : 'A simple conversation view built for quick, lightweight messaging.'}
                </p>
              )}
            </div>
          </div>

          <div className="chat-header-meta">
            <span className="summary-pill">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </span>
            <Link
              className="pill conversation-settings-trigger"
              href={
                isSettingsOpen
                  ? `/chat/${conversationId}`
                  : `/chat/${conversationId}?settings=open#conversation-settings`
              }
            >
              {isSettingsOpen ? 'Close details' : 'Chat details'}
            </Link>
          </div>
        </section>
      </section>

      {isSettingsOpen ? (
        <section className="card stack conversation-settings-card" id="conversation-settings">
          <div className="conversation-settings-header">
            <div className="stack conversation-settings-copy">
              <p className="eyebrow">Conversation settings</p>
              <h2 className="section-title">Chat details</h2>
              <p className="muted">
                A lightweight view of this conversation and a small set of safe
                settings.
              </p>
            </div>
            <Link className="pill conversation-settings-close" href={`/chat/${conversationId}`}>
              Done
            </Link>
          </div>

          <div className="conversation-settings-grid">
            <div className="conversation-settings-item">
              <span className="conversation-settings-label">Type</span>
              <span className="conversation-settings-value">
                {conversation.kind === 'group' ? 'Group chat' : 'Direct chat'}
              </span>
            </div>
            <div className="conversation-settings-item">
              <span className="conversation-settings-label">Started</span>
              <span className="conversation-settings-value">
                {formatLongDate(conversation.createdAt ?? null)}
              </span>
            </div>
            <div className="conversation-settings-item">
              <span className="conversation-settings-label">Messages</span>
              <span className="conversation-settings-value">
                {messages.length}
              </span>
            </div>
            <div className="conversation-settings-item">
              <span className="conversation-settings-label">Participants</span>
              <span className="conversation-settings-value">
                {participants.length}
              </span>
            </div>
          </div>

          {conversation.kind === 'group' ? (
            <section className="conversation-settings-panel stack">
              <div className="stack conversation-settings-panel-copy">
                <h3 className="card-title">Group title</h3>
                <p className="muted">
                  {canEditGroupTitle
                    ? 'You can update the group name here.'
                    : 'Only the group creator can update the title in this first version.'}
                </p>
              </div>

              {canEditGroupTitle ? (
                <form
                  action={updateConversationTitleAction}
                  className="stack compact-form"
                >
                  <input
                    name="conversationId"
                    type="hidden"
                    value={conversationId}
                  />
                  <label className="field">
                    <span className="sr-only">Group title</span>
                    <input
                      className="input"
                      defaultValue={conversation.title?.trim() || ''}
                      name="title"
                      placeholder="Group title"
                      required
                    />
                  </label>
                  <button className="button button-compact" type="submit">
                    Save title
                  </button>
                </form>
              ) : (
                <p className="conversation-settings-static">
                  {conversation.title?.trim() || 'Untitled group'}
                </p>
              )}
            </section>
          ) : (
            <section className="conversation-settings-panel stack">
              <div className="stack conversation-settings-panel-copy">
                <h3 className="card-title">Direct conversation</h3>
                <p className="muted">
                  This first version keeps direct chat settings read-only.
                </p>
              </div>
              <p className="conversation-settings-static">
                {otherParticipantLabels[0]
                  ? `You are chatting with ${otherParticipantLabels[0]}.`
                  : 'This direct conversation is ready for messages.'}
              </p>
            </section>
          )}

          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">Participants</h3>
              <p className="muted">
                Everyone currently active in this conversation.
              </p>
            </div>

            <div className="conversation-member-list">
              {participantItems.map((participant) => (
                <div
                  key={participant.userId}
                  className="conversation-member-row"
                >
                  <div className="conversation-member-identity">
                    <IdentityAvatar
                      identity={participant.identity}
                      label={participant.label}
                      size="sm"
                    />
                    <div className="stack conversation-member-copy">
                      <span className="user-label">
                        {participant.label}
                      </span>
                      <div className="conversation-member-meta">
                        <span className="conversation-role-chip">
                          {formatParticipantRoleLabel(
                            participant.role,
                            participant.isCurrentUser,
                          )}
                        </span>
                        {conversation.kind === 'group' ? (
                          <span className="muted">Active in this group</span>
                        ) : (
                          <span className="muted">Direct participant</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {conversation.kind === 'group' &&
                  canManageGroupParticipants &&
                  !participant.isCurrentUser &&
                  participant.role !== 'owner' ? (
                    <form action={removeGroupParticipantAction}>
                      <input
                        name="conversationId"
                        type="hidden"
                        value={conversationId}
                      />
                      <input
                        name="targetUserId"
                        type="hidden"
                        value={participant.userId}
                      />
                      <button
                        className="button button-compact button-danger-subtle"
                        type="submit"
                      >
                        Remove
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>

            {conversation.kind === 'group' ? (
              <div className="conversation-member-actions">
                {canManageGroupParticipants ? (
                  <section className="stack conversation-participant-manager">
                    <div className="stack conversation-settings-panel-copy">
                      <h4 className="card-title">Add participants</h4>
                      <p className="muted">
                        Choose people to add to this group. New members join as
                        active participants.
                      </p>
                    </div>

                    {availableParticipantsToAdd.length === 0 ? (
                      <p className="muted conversation-settings-static">
                        Everyone available is already in this group.
                      </p>
                    ) : (
                      <form action={addGroupParticipantsAction} className="stack compact-form">
                        <input
                          name="conversationId"
                          type="hidden"
                          value={conversationId}
                        />
                        <div className="checkbox-list conversation-checkbox-list">
                          {availableParticipantsToAdd.map((participant) => (
                            <label
                              key={`add-${participant.userId}`}
                              className="checkbox-row"
                            >
                              <input
                                name="participantUserIds"
                                type="checkbox"
                                value={participant.userId}
                              />
                              <span className="checkbox-copy">
                                <span className="checkbox-identity">
                                  <IdentityAvatar
                                    identity={participant}
                                    label={participant.label}
                                    size="sm"
                                  />
                                </span>
                                <span className="user-label">{participant.label}</span>
                                <span className="muted">Add to this group</span>
                              </span>
                            </label>
                          ))}
                        </div>
                        <button className="button button-compact" type="submit">
                          Add selected people
                        </button>
                      </form>
                    )}
                  </section>
                ) : (
                  <p className="muted conversation-settings-static">
                    Only the group owner can add or remove participants in this
                    first version.
                  </p>
                )}

                <section className="stack conversation-leave-panel">
                  <div className="stack conversation-settings-panel-copy">
                    <h4 className="card-title">Leave group</h4>
                    <p className="muted">
                      You can leave this group at any time. If you are the
                      current owner, the next active member becomes owner
                      automatically.
                    </p>
                  </div>
                  <form action={leaveGroupAction}>
                    <input
                      name="conversationId"
                      type="hidden"
                      value={conversationId}
                    />
                    <button
                      className="button button-compact button-danger-subtle"
                      type="submit"
                    >
                      Leave group
                    </button>
                  </form>
                </section>
              </div>
            ) : null}
          </section>
        </section>
      ) : null}

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
              const isDeletedMessage = Boolean(message.deleted_at);
              const isMessageInEditMode =
                activeEditMessageId === message.id && isOwnMessage && !isDeletedMessage;
              const isMessageInDeleteMode =
                activeDeleteMessageId === message.id && isOwnMessage && !isDeletedMessage;
              const messageAttachments = attachmentsByMessage.get(message.id) ?? [];
              const messageSeq = getMessageSeq(message.seq);
              const senderLabel =
                senderNames.get(message.sender_id ?? '') ||
                createFallbackSenderName(
                  message.sender_id,
                  user.id,
                  fallbackNames,
                );
              const senderIdentity = senderIdentities.get(message.sender_id ?? '');
              const otherParticipantReadSeq =
                otherParticipantReadState?.lastReadMessageSeq ?? null;
              const showSeenState =
                conversation.kind === 'dm' &&
                isOwnMessage &&
                latestOwnVisibleMessage?.id === message.id &&
                !isDeletedMessage &&
                otherParticipantReadSeq !== null &&
                Number.isFinite(messageSeq) &&
                otherParticipantReadSeq >= messageSeq;
              const ownMessageStatusLabel = showSeenState ? 'Seen' : 'Sent';

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
                      {!isDeletedMessage ? (
                        <>
                          <a
                            className="message-action-chip"
                            href={`/chat/${conversationId}?replyToMessageId=${message.id}#message-composer`}
                          >
                            Reply
                          </a>
                          {isOwnMessage ? (
                            <>
                              <a
                                className="message-action-chip"
                                href={`/chat/${conversationId}?editMessageId=${message.id}#message-${message.id}`}
                              >
                                Edit
                              </a>
                              <a
                                className="message-action-chip message-action-chip-danger"
                                href={`/chat/${conversationId}?deleteMessageId=${message.id}#message-${message.id}`}
                              >
                                Delete
                              </a>
                            </>
                          ) : (
                            <a
                              className="message-action-chip"
                              href={`#message-reactions-${message.id}`}
                            >
                              React
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="message-action-chip message-action-chip-muted">
                          Archived
                        </span>
                      )}
                    </div>

                      <div
                        className={
                          isDeletedMessage
                            ? isOwnMessage
                              ? 'message-card message-card-own message-card-deleted'
                              : 'message-card message-card-deleted'
                            : isOwnMessage
                              ? 'message-card message-card-own'
                              : 'message-card'
                        }
                        id={`message-${message.id}`}
                      >
                      <div
                        className={
                          isOwnMessage
                            ? 'message-header message-header-own'
                            : 'message-header'
                        }
                      >
                        <div
                          className={
                            isOwnMessage
                              ? 'message-sender-row message-sender-row-own'
                              : 'message-sender-row'
                          }
                        >
                          <IdentityAvatar
                            identity={senderIdentity}
                            label={senderLabel}
                            size="sm"
                          />
                        <div className="stack message-header-copy">
                            <span className="message-sender">{senderLabel}</span>
                            <span className="message-kind">
                              {isDeletedMessage
                                ? 'Deleted message'
                                : messageAttachments.length
                                ? messageAttachments[0]?.isImage
                                  ? 'Photo attachment'
                                  : 'File attachment'
                                : 'Text message'}
                            </span>
                          </div>
                        </div>
                        <span
                          className={
                            isOwnMessage
                              ? 'message-meta message-meta-own'
                              : 'message-meta'
                          }
                        >
                          <span>{formatMessageTimestamp(message.created_at) || 'Just now'}</span>
                          {isEditedMessage(message) ? (
                            <span className="message-edited" aria-label="Edited">
                              Edited
                            </span>
                          ) : null}
                          {isOwnMessage ? (
                            <span
                              className={
                                showSeenState
                                  ? 'message-status message-status-seen'
                                  : 'message-status'
                              }
                              aria-label={ownMessageStatusLabel}
                            >
                              {ownMessageStatusLabel}
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
                        {message.reply_to_message_id && !isDeletedMessage ? (
                          <div className="message-reply-reference">
                            <span className="message-reply-sender">
                              {(() => {
                                const repliedMessage = messagesById.get(
                                  message.reply_to_message_id,
                                );

                                if (!repliedMessage) {
                                  return 'Earlier message';
                                }

                                if (repliedMessage.deleted_at) {
                                  return 'Deleted message';
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
                              {(() => {
                                const repliedMessage = messagesById.get(
                                  message.reply_to_message_id,
                                );

                                if (repliedMessage?.deleted_at) {
                                  return 'Message deleted';
                                }

                                return getMessageSnippet(repliedMessage?.body ?? null, 72);
                              })()}
                            </span>
                          </div>
                        ) : null}
                        {isDeletedMessage ? (
                          <p className="message-deleted-text">Message deleted</p>
                        ) : isMessageInEditMode ? (
                          <form action={editMessageAction} className="stack message-edit-form">
                            <input
                              name="conversationId"
                              type="hidden"
                              value={conversationId}
                            />
                            <input name="messageId" type="hidden" value={message.id} />
                            <label className="field">
                              <span className="sr-only">Edit message</span>
                              <AutoGrowTextarea
                                className="input textarea"
                                defaultValue={message.body?.trim() ?? ''}
                                maxHeight={160}
                                name="body"
                                required
                                rows={2}
                              />
                            </label>
                            <div className="message-edit-actions">
                              <button className="button button-compact" type="submit">
                                Save
                              </button>
                              <Link
                                className="pill message-edit-cancel"
                                href={`/chat/${conversationId}#message-${message.id}`}
                              >
                                Cancel
                              </Link>
                            </div>
                          </form>
                        ) : message.body?.trim() ? (
                          <p className="message-body">{message.body.trim()}</p>
                        ) : !messageAttachments.length ? (
                          <p className="message-body">Empty message</p>
                        ) : null}
                        {messageAttachments.length && !isDeletedMessage ? (
                          <div className="message-attachments">
                            {messageAttachments.map((attachment) => {
                              const attachmentContent = (
                                <>
                                  {attachment.isImage && attachment.signedUrl ? (
                                    <span
                                      aria-hidden="true"
                                      className="message-attachment-preview"
                                      style={{
                                        backgroundImage: `url("${attachment.signedUrl}")`,
                                      }}
                                    />
                                  ) : (
                                    <span
                                      aria-hidden="true"
                                      className="message-attachment-file"
                                    >
                                      File
                                    </span>
                                  )}
                                  <span className="message-attachment-copy">
                                    <span className="message-attachment-name">
                                      {attachment.fileName}
                                    </span>
                                    <span className="message-attachment-meta">
                                      {attachment.isImage ? 'Image' : 'Attachment'}
                                      {formatAttachmentSize(attachment.sizeBytes)
                                        ? ` · ${formatAttachmentSize(
                                            attachment.sizeBytes,
                                          )}`
                                        : ''}
                                    </span>
                                  </span>
                                </>
                              );

                              if (!attachment.signedUrl) {
                                return (
                                  <div
                                    key={attachment.id}
                                    className="message-attachment-card"
                                  >
                                    {attachmentContent}
                                  </div>
                                );
                              }

                              return (
                                <a
                                  key={attachment.id}
                                  className="message-attachment-card"
                                  href={attachment.signedUrl}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {attachmentContent}
                                </a>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      {reactionsByMessage.get(message.id)?.length && !isDeletedMessage ? (
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

                      {!isDeletedMessage ? (
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
                      ) : null}
                      {isMessageInDeleteMode ? (
                        <form action={deleteMessageAction} className="message-delete-confirm">
                          <input
                            name="conversationId"
                            type="hidden"
                            value={conversationId}
                          />
                          <input name="messageId" type="hidden" value={message.id} />
                          <input name="confirmDelete" type="hidden" value="true" />
                          <span className="message-delete-copy">
                            Delete this message for everyone in this chat?
                          </span>
                          <div className="message-delete-actions">
                            <button className="button button-compact" type="submit">
                              Delete
                            </button>
                            <Link
                              className="pill message-edit-cancel"
                              href={`/chat/${conversationId}#message-${message.id}`}
                            >
                              Cancel
                            </Link>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
          <MarkConversationRead
            conversationId={conversationId}
            currentReadMessageSeq={readState.lastReadMessageSeq}
            latestVisibleMessageSeq={
              latestVisibleMessageSeq !== null && Number.isFinite(latestVisibleMessageSeq)
                ? latestVisibleMessageSeq
                : null
            }
          />
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
                  {activeReplyTarget.deleted_at
                    ? 'Deleted message'
                    : senderNames.get(activeReplyTarget.sender_id ?? '') ||
                      createFallbackSenderName(
                        activeReplyTarget.sender_id,
                        user.id,
                        fallbackNames,
                      )}
                </span>
                <span className="composer-reply-snippet">
                  {activeReplyTarget.deleted_at
                    ? 'This message was deleted.'
                    : getMessageSnippet(activeReplyTarget.body, 88)}
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
              <ComposerAttachmentPicker
                accept={CHAT_ATTACHMENT_ACCEPT}
                maxSizeLabel="Up to 10 MB"
              />

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
