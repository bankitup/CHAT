import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getAvailableUsers,
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_ATTACHMENT_HELP_TEXT,
  CHAT_ATTACHMENT_MAX_SIZE_BYTES,
  getConversationDisplayName,
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
import { AutoScrollToLatest } from './auto-scroll-to-latest';
import { ComposerKeyboardOffset } from './composer-keyboard-offset';
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
    actionMessageId?: string;
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

function formatParticipantRoleLabel(role: string | null) {
  if (role === 'owner') {
    return 'Owner';
  }

  if (role === 'admin') {
    return 'Admin';
  }

  return 'Member';
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
  const conversationDisplayTitle = getConversationDisplayName({
    kind: conversation.kind ?? null,
    title: conversation.title,
    participantLabels: otherParticipantLabels,
  });
  const groupMemberSummary =
    conversation.kind === 'group'
      ? formatGroupMemberSummary(
          participants.map((participant) => participant.userId),
          user.id,
          senderNames,
        )
      : null;
  const activeReplyTarget = query.replyToMessageId
    ? messagesById.get(query.replyToMessageId) ?? null
    : null;
  const activeEditMessageId = query.editMessageId?.trim() || null;
  const activeDeleteMessageId = query.deleteMessageId?.trim() || null;
  const activeActionMessageId = query.actionMessageId?.trim() || null;
  const activeActionMessage =
    activeActionMessageId && !activeEditMessageId && !activeDeleteMessageId
      ? messagesById.get(activeActionMessageId) ?? null
      : null;
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
      roleLabel: formatParticipantRoleLabel(participant.role ?? 'member'),
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
  const isConversationCaughtUp =
    latestVisibleMessageSeq !== null &&
    readState.lastReadMessageSeq !== null &&
    Number.isFinite(latestVisibleMessageSeq) &&
    readState.lastReadMessageSeq >= latestVisibleMessageSeq;
  const otherParticipantReadState =
    conversation.kind === 'dm'
      ? memberReadStates.find((state) => state.userId !== user.id) ?? null
      : null;
  const latestOwnVisibleMessage = [...messages]
    .reverse()
    .find((message) => message.sender_id === user.id && !message.deleted_at);
  const activeActionMessageSenderLabel = activeActionMessage
    ? senderNames.get(activeActionMessage.sender_id ?? '') ||
      createFallbackSenderName(
        activeActionMessage.sender_id,
        user.id,
        fallbackNames,
      )
    : null;
  const activeActionMessageIsOwn =
    activeActionMessage?.sender_id === user.id && !activeActionMessage.deleted_at;
  const activeActionReactions = activeActionMessage
    ? reactionsByMessage.get(activeActionMessage.id) ?? []
    : [];
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
      <ComposerKeyboardOffset />

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
                label={conversationDisplayTitle}
                size="lg"
              />
            )}

            <div className="stack chat-header-copy">
              <h1 className="conversation-screen-title">
                {conversationDisplayTitle}
              </h1>
              {conversation.kind === 'group' ? (
                <p className="muted chat-member-summary">{groupMemberSummary}</p>
              ) : null}
            </div>
          </div>

          <div className="chat-header-meta">
            <Link
              className="pill conversation-settings-trigger"
              href={
                isSettingsOpen
                  ? `/chat/${conversationId}`
                  : `/chat/${conversationId}?settings=open#conversation-settings`
              }
            >
              {isSettingsOpen ? 'Close' : 'Info'}
            </Link>
          </div>
        </section>
      </section>

      {isSettingsOpen ? (
        <section className="card stack conversation-settings-card" id="conversation-settings">
          <div className="conversation-settings-header">
            <div className="stack conversation-settings-copy">
              <h2 className="section-title">Info</h2>
            </div>
            <Link className="pill conversation-settings-close" href={`/chat/${conversationId}`}>
              Done
            </Link>
          </div>

          <section className="conversation-info-summary">
            <div className="conversation-info-identity">
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
                  label={conversationDisplayTitle}
                  size="lg"
                />
              )}

              <div className="stack conversation-info-copy">
                <h3 className="conversation-info-title">{conversationDisplayTitle}</h3>
                <p className="muted conversation-info-subtitle">
                  {conversation.kind === 'group'
                    ? groupMemberSummary
                    : 'Person'}
                </p>
              </div>
            </div>

            <div className="conversation-info-meta">
              <span className="conversation-info-meta-item">
                {conversation.kind === 'group' ? 'Group' : 'Person'}
              </span>
              <span className="conversation-info-meta-item">
                Started {formatLongDate(conversation.createdAt ?? null)}
              </span>
              {conversation.kind === 'group' ? (
                <span className="conversation-info-meta-item">
                  {participants.length} member{participants.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </section>

          {conversation.kind === 'group' ? (
            <section className="conversation-settings-panel stack">
              <div className="stack conversation-settings-panel-copy">
                <h3 className="card-title">Name</h3>
                <p className="conversation-settings-static conversation-settings-title-preview">
                  {conversationDisplayTitle}
                </p>
                {canEditGroupTitle ? null : (
                  <p className="muted">Only the group owner can change it.</p>
                )}
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
                      placeholder="Enter a group name"
                      required
                    />
                  </label>
                  <button className="button button-compact" type="submit">
                    Save name
                  </button>
                </form>
              ) : null}
            </section>
          ) : (
            <section className="conversation-settings-panel stack">
              <div className="stack conversation-settings-panel-copy">
                <h3 className="card-title">About</h3>
              </div>
              <p className="conversation-settings-static">
                This conversation is with {conversationDisplayTitle}.
              </p>
            </section>
          )}

          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">Participants</h3>
              <p className="muted">
                {participants.length} active member{participants.length === 1 ? '' : 's'}
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
                          {participant.roleLabel}
                        </span>
                        {participant.isCurrentUser ? (
                          <span className="conversation-member-self-chip">You</span>
                        ) : null}
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
                      <h4 className="card-title">Add people</h4>
                      <p className="muted">Choose people to add.</p>
                    </div>

                    {availableParticipantsToAdd.length === 0 ? (
                      <p className="muted conversation-settings-static">
                        Everyone is already here.
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
                              </span>
                            </label>
                          ))}
                        </div>
                        <button className="button button-compact" type="submit">
                          Add people
                        </button>
                      </form>
                    )}
                  </section>
                ) : (
                  <p className="muted conversation-settings-static">
                    Only the owner can add or remove people.
                  </p>
                )}

                <section className="stack conversation-leave-panel">
                  <div className="stack conversation-settings-panel-copy">
                    <h4 className="card-title">Leave group</h4>
                    <p className="muted">Leave this chat.</p>
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

      {query.error ? <p className="notice notice-error">{query.error}</p> : null}

      <section className="chat-main">
        <section className="message-thread" id="message-thread-scroll">
          <AutoScrollToLatest
            latestVisibleMessageSeq={latestVisibleMessageSeq}
            targetId="message-thread-scroll"
          />
          {messages.length === 0 ? (
            <section className="card stack empty-card chat-empty-card">
              <h2 className="card-title">New chat</h2>
              <p className="muted">Say hello.</p>
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
              const isMessageActionActive = activeActionMessage?.id === message.id;

              return (
                <article
                  key={item.key}
                  className={isOwnMessage ? 'message-row message-row-own' : 'message-row'}
                >
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
                          </div>
                        </div>
                        <div className="message-header-side">
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
                          {!isDeletedMessage ? (
                            <Link
                              aria-label="Open message actions"
                              className={
                                isMessageActionActive
                                  ? 'message-actions-trigger message-actions-trigger-active'
                                  : 'message-actions-trigger'
                              }
                              href={`/chat/${conversationId}?actionMessageId=${message.id}#message-${message.id}`}
                            >
                              <span aria-hidden="true">⋯</span>
                            </Link>
                          ) : null}
                        </div>
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
                                      {!attachment.signedUrl
                                        ? ' · Unavailable right now'
                                        : ''}
                                    </span>
                                  </span>
                                </>
                              );

                              if (!attachment.signedUrl) {
                                return (
                                  <div
                                    key={attachment.id}
                                    className="message-attachment-card message-attachment-card-unavailable"
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
                </article>
              );
            })
          )}
          {messages.length > 0 && isConversationCaughtUp ? (
            <div className="message-caught-up-state" aria-label="Conversation read up to date">
              <span className="message-caught-up-label">You&apos;re caught up</span>
            </div>
          ) : null}
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
                helperText={CHAT_ATTACHMENT_HELP_TEXT}
                maxSizeBytes={CHAT_ATTACHMENT_MAX_SIZE_BYTES}
                maxSizeLabel="Up to 10 MB"
              />

              <label className="field composer-input-field">
                <span className="sr-only">Message</span>
                <AutoGrowTextarea
                  className="input textarea"
                  name="body"
                  placeholder="Message"
                  rows={2}
                  maxHeight={160}
                />
              </label>

              <button
                aria-label="Send message"
                className="button composer-button composer-button-icon"
                type="submit"
              >
                <span aria-hidden="true">➤</span>
              </button>
            </div>
          </form>
        </section>
      </section>

      {activeActionMessage && !activeActionMessage.deleted_at ? (
        <section className="message-sheet-overlay" aria-label="Message actions">
          <Link
            aria-label="Close message actions"
            className="message-sheet-backdrop"
            href={`/chat/${conversationId}#message-${activeActionMessage.id}`}
          />
          <section className="message-sheet-card card stack">
            <div className="message-sheet-header">
              <div className="stack message-sheet-copy">
                <span className="message-sheet-title">
                  {activeActionMessageSenderLabel}
                </span>
                <span className="message-sheet-snippet">
                  {activeActionMessage.body?.trim()
                    ? getMessageSnippet(activeActionMessage.body, 96)
                    : activeActionMessage.reply_to_message_id
                      ? 'Reply message'
                      : 'Choose an action'}
                </span>
              </div>
              <Link
                aria-label="Close message actions"
                className="message-sheet-close"
                href={`/chat/${conversationId}#message-${activeActionMessage.id}`}
              >
                <span aria-hidden="true">×</span>
              </Link>
            </div>

            <div className="stack message-sheet-section">
              <div
                className={
                  activeActionMessage.sender_id === user.id
                    ? 'reaction-picker reaction-picker-own message-sheet-reactions'
                    : 'reaction-picker message-sheet-reactions'
                }
              >
                {STARTER_REACTIONS.map((emoji) => {
                  const currentReaction = activeActionReactions.find(
                    (reaction) => reaction.emoji === emoji,
                  );

                  return (
                    <form
                      key={`${activeActionMessage.id}-sheet-${emoji}`}
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
                        value={activeActionMessage.id}
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
                          <span className="reaction-count">{currentReaction.count}</span>
                        ) : null}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>

            <div className="stack message-sheet-section">
              <div className="message-sheet-action-list">
                <Link
                  className="message-sheet-action"
                  href={`/chat/${conversationId}?replyToMessageId=${activeActionMessage.id}#message-composer`}
                >
                  <span className="message-sheet-action-icon" aria-hidden="true">
                    ↩
                  </span>
                  <span className="message-sheet-action-copy">
                    <span className="message-sheet-action-label">Reply</span>
                  </span>
                </Link>

                {activeActionMessageIsOwn ? (
                  <>
                    <Link
                      className="message-sheet-action"
                      href={`/chat/${conversationId}?editMessageId=${activeActionMessage.id}#message-${activeActionMessage.id}`}
                    >
                      <span className="message-sheet-action-icon" aria-hidden="true">
                        ✎
                      </span>
                      <span className="message-sheet-action-copy">
                        <span className="message-sheet-action-label">Edit</span>
                      </span>
                    </Link>

                    <Link
                      className="message-sheet-action message-sheet-action-danger"
                      href={`/chat/${conversationId}?deleteMessageId=${activeActionMessage.id}#message-${activeActionMessage.id}`}
                    >
                      <span className="message-sheet-action-icon" aria-hidden="true">
                        🗑
                      </span>
                      <span className="message-sheet-action-copy">
                        <span className="message-sheet-action-label">Delete</span>
                      </span>
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          </section>
        </section>
      ) : null}
    </section>
  );
}
