'use client';

import Link from 'next/link';
import { memo, useSyncExternalStore } from 'react';
import { getInboxDisplayPreviewText } from '@/modules/messaging/e2ee/inbox-policy';
import type { InboxPreviewDisplayMode } from '@/modules/messaging/inbox/preferences';
import {
  getInboxConversationSummarySnapshot,
  subscribeToInboxConversationSummary,
  type InboxConversationLiveSummary,
} from '@/modules/messaging/realtime/inbox-summary-store';
import {
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/messaging/ui/identity';
import { EncryptedDmInboxPreview } from './encrypted-dm-inbox-preview';

type InboxConversationLiveRowProps = {
  activeSpaceId: string | null;
  currentUserId: string;
  initialSummary: InboxConversationLiveSummary;
  isPrimaryChatsView: boolean;
  isArchivedView: boolean;
  previewMode: InboxPreviewDisplayMode;
  item: {
    conversationId: string;
    groupAvatarPath: string | null;
    isGroupConversation: boolean;
    metaLabels: Array<{
      label: string;
      tone: 'default' | 'archived';
    }>;
    participants: Array<{
      userId: string;
      displayName: string | null;
      avatarPath?: string | null;
    }>;
    title: string;
  };
  language: 'en' | 'ru';
  labels: {
    audio: string;
    attachment: string;
    deletedMessage: string;
    encryptedMessage: string;
    file: string;
    group: string;
    image: string;
    newMessage: string;
    newEncryptedMessage: string;
    noActivityYet: string;
    unreadAria: string;
    voiceMessage: string;
    yesterday: string;
  };
  restoreAction?: ((formData: FormData) => void | Promise<void>) | null;
  restoreLabel?: string;
  shouldPrefetch?: boolean;
};

function formatTimestamp(value: string | null, language: 'en' | 'ru', noActivityLabel: string) {
  if (!value) {
    return noActivityLabel;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return noActivityLabel;
  }

  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatRecency(value: string | null, language: 'en' | 'ru', yesterdayLabel: string) {
  if (!value) {
    return language === 'ru' ? 'Новый' : 'New';
  }

  const target = new Date(value);

  if (Number.isNaN(target.getTime())) {
    return language === 'ru' ? 'Новый' : 'New';
  }

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
    return yesterdayLabel;
  }

  if (dayDiff < 7) {
    return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      weekday: 'short',
    }).format(target);
  }

  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(target);
}

type InboxConversationAvatarVisualProps = {
  groupAvatarPath: string | null;
  isGroupConversation: boolean;
  isPrimaryChatsView: boolean;
  participant:
    | {
        userId: string;
        displayName: string | null;
        avatarPath?: string | null;
      }
    | null;
  title: string;
};

function areInboxParticipantsEqual(
  previous:
    | {
        userId: string;
        displayName: string | null;
        avatarPath?: string | null;
      }
    | null,
  next:
    | {
        userId: string;
        displayName: string | null;
        avatarPath?: string | null;
      }
    | null,
) {
  return (
    previous?.userId === next?.userId &&
    previous?.displayName === next?.displayName &&
    previous?.avatarPath === next?.avatarPath
  );
}

function areInboxParticipantListsEqual(
  previous: Array<{
    userId: string;
    displayName: string | null;
    avatarPath?: string | null;
  }>,
  next: Array<{
    userId: string;
    displayName: string | null;
    avatarPath?: string | null;
  }>,
) {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((participant, index) =>
    areInboxParticipantsEqual(participant, next[index] ?? null),
  );
}

function areInboxMetaLabelsEqual(
  previous: Array<{
    label: string;
    tone: 'default' | 'archived';
  }>,
  next: Array<{
    label: string;
    tone: 'default' | 'archived';
  }>,
) {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every(
    (label, index) =>
      label.label === next[index]?.label && label.tone === next[index]?.tone,
  );
}

function areInboxConversationSummariesEqual(
  previous: InboxConversationLiveSummary,
  next: InboxConversationLiveSummary,
) {
  return (
    previous.conversationId === next.conversationId &&
    previous.createdAt === next.createdAt &&
    previous.hiddenAt === next.hiddenAt &&
    previous.lastMessageAt === next.lastMessageAt &&
    previous.lastReadAt === next.lastReadAt &&
    previous.lastReadMessageSeq === next.lastReadMessageSeq &&
    previous.latestMessageAttachmentKind === next.latestMessageAttachmentKind &&
    previous.latestMessageBody === next.latestMessageBody &&
    previous.latestMessageContentMode === next.latestMessageContentMode &&
    previous.latestMessageDeletedAt === next.latestMessageDeletedAt &&
    previous.latestMessageId === next.latestMessageId &&
    previous.latestMessageKind === next.latestMessageKind &&
    previous.latestMessageSenderId === next.latestMessageSenderId &&
    previous.latestMessageSeq === next.latestMessageSeq &&
    previous.removed === next.removed &&
    previous.unreadCount === next.unreadCount
  );
}

const InboxConversationAvatarVisual = memo(function InboxConversationAvatarVisual({
  groupAvatarPath,
  isGroupConversation,
  isPrimaryChatsView,
  participant,
  title,
}: InboxConversationAvatarVisualProps) {
  if (isGroupConversation) {
    return (
      <GroupIdentityAvatar
        avatarPath={groupAvatarPath}
        label={title}
        size={isPrimaryChatsView ? 'lg' : 'md'}
      />
    );
  }

  return (
    <IdentityAvatar
      diagnosticsSurface="inbox:conversation-row-live"
      identity={participant}
      label={title}
      size={isPrimaryChatsView ? 'lg' : 'md'}
    />
  );
}, (previous, next) => {
  return (
    previous.groupAvatarPath === next.groupAvatarPath &&
    previous.isGroupConversation === next.isGroupConversation &&
    previous.isPrimaryChatsView === next.isPrimaryChatsView &&
    previous.title === next.title &&
    areInboxParticipantsEqual(previous.participant, next.participant)
  );
});

type InboxConversationTitleVisualProps = {
  hasUnread: boolean;
  isPrimaryChatsView: boolean;
  title: string;
};

const InboxConversationTitleVisual = memo(function InboxConversationTitleVisual({
  hasUnread,
  isPrimaryChatsView,
  title,
}: InboxConversationTitleVisualProps) {
  return (
    <h3
      className={
        hasUnread
          ? isPrimaryChatsView
            ? 'conversation-title conversation-title-unread conversation-title-dm'
            : 'conversation-title conversation-title-unread'
          : isPrimaryChatsView
            ? 'conversation-title conversation-title-dm'
            : 'conversation-title'
      }
    >
      {title}
    </h3>
  );
});

function InboxConversationLiveRowComponent({
  activeSpaceId,
  currentUserId,
  initialSummary,
  isArchivedView,
  isPrimaryChatsView,
  previewMode,
  item,
  language,
  labels,
  restoreAction,
  restoreLabel,
  shouldPrefetch = false,
}: InboxConversationLiveRowProps) {
  const liveSummary = useSyncExternalStore(
    (listener) =>
      subscribeToInboxConversationSummary(item.conversationId, listener),
    () => getInboxConversationSummarySnapshot(item.conversationId, initialSummary),
    () => initialSummary,
  );

  if (liveSummary.removed) {
    return null;
  }

  const isHidden = Boolean(liveSummary.hiddenAt);

  if (isArchivedView ? !isHidden : isHidden) {
    return null;
  }

  const preview = getInboxDisplayPreviewText(
    {
      lastMessageAt: liveSummary.lastMessageAt,
      latestMessageAttachmentKind: liveSummary.latestMessageAttachmentKind,
      latestMessageBody: liveSummary.latestMessageBody,
      latestMessageContentMode: liveSummary.latestMessageContentMode,
      latestMessageDeletedAt: liveSummary.latestMessageDeletedAt,
      latestMessageKind: liveSummary.latestMessageKind,
      unreadCount: liveSummary.unreadCount,
    },
    {
      audio: labels.audio,
      attachment: labels.attachment,
      deletedMessage: labels.deletedMessage,
      encryptedMessage: labels.encryptedMessage,
      file: labels.file,
      image: labels.image,
      newMessage: labels.newMessage,
      newEncryptedMessage: labels.newEncryptedMessage,
      voiceMessage: labels.voiceMessage,
    },
    previewMode,
  );
  const hasUnread = liveSummary.unreadCount > 0;
  const lastActivityAt = liveSummary.lastMessageAt ?? liveSummary.createdAt;
  const recencyLabel = formatRecency(lastActivityAt, language, labels.yesterday);
  const timestampLabel = formatTimestamp(
    lastActivityAt,
    language,
    labels.noActivityYet,
  );
  const chatHref =
    activeSpaceId?.trim()
      ? `/chat/${item.conversationId}?space=${encodeURIComponent(activeSpaceId)}`
      : `/chat/${item.conversationId}`;
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_INBOX_NAV === '1';

  const logNavigationDiagnostics = (
    stage: string,
    details?: Record<string, unknown>,
  ) => {
    if (!diagnosticsEnabled) {
      return;
    }

    if (details) {
      console.info('[inbox-nav]', stage, details);
      return;
    }

    console.info('[inbox-nav]', stage);
  };

  return (
    <article
      className={
        hasUnread
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
          isArchivedView
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
          href={chatHref}
          onClick={(event) => {
            if (
              event.defaultPrevented ||
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
            event.altKey
            ) {
              logNavigationDiagnostics('row:navigation-bypassed', {
                conversationId: item.conversationId,
                defaultPrevented: event.defaultPrevented,
                href: chatHref,
                reason: 'modified-or-nonprimary-click',
              });
              return;
            }

            logNavigationDiagnostics('row:navigation-attempt', {
              conversationId: item.conversationId,
              href: chatHref,
              isGroupConversation: item.isGroupConversation,
            });
          }}
          prefetch={shouldPrefetch}
        >
          <InboxConversationAvatarVisual
            groupAvatarPath={item.groupAvatarPath}
            isGroupConversation={item.isGroupConversation}
            isPrimaryChatsView={isPrimaryChatsView}
            participant={item.participants[0] ?? null}
            title={item.title}
          />

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
                <InboxConversationTitleVisual
                  hasUnread={hasUnread}
                  isPrimaryChatsView={isPrimaryChatsView}
                  title={item.title}
                />
                <div className="conversation-title-meta">
                  <span
                    className={
                      hasUnread
                        ? 'conversation-recency conversation-recency-unread'
                        : 'conversation-recency'
                    }
                  >
                    {recencyLabel}
                  </span>
                  {hasUnread ? (
                    <span
                      className="conversation-unread-dot"
                      aria-label={labels.unreadAria}
                    />
                  ) : null}
                </div>
              </div>
              {preview ? (
                <EncryptedDmInboxPreview
                  className={
                    hasUnread
                      ? isPrimaryChatsView
                        ? 'muted conversation-preview conversation-preview-unread conversation-preview-dm'
                        : 'muted conversation-preview conversation-preview-unread'
                      : isPrimaryChatsView
                        ? 'muted conversation-preview conversation-preview-dm'
                        : 'muted conversation-preview'
                  }
                  conversationId={item.conversationId}
                  currentUserId={currentUserId}
                  fallbackPreview={preview}
                  latestMessageContentMode={liveSummary.latestMessageContentMode}
                  latestMessageDeletedAt={liveSummary.latestMessageDeletedAt}
                  latestMessageId={liveSummary.latestMessageId}
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
                {item.metaLabels.map((metaLabel) => (
                  <span
                    key={metaLabel.label}
                    className={
                      metaLabel.tone === 'archived'
                        ? 'conversation-kind-label conversation-kind-label-archived'
                        : 'conversation-kind-label'
                    }
                  >
                    {metaLabel.tone === 'archived' ? metaLabel.label : labels.group}
                  </span>
                ))}
              </div>
              <p className="muted conversation-timestamp">{timestampLabel}</p>
            </div>
          </div>
        </Link>
        {isArchivedView && restoreAction && restoreLabel ? (
          <form action={restoreAction}>
            <input name="conversationId" type="hidden" value={item.conversationId} />
            <input name="spaceId" type="hidden" value={activeSpaceId ?? ''} />
            <button
              className="button button-compact button-secondary conversation-restore-button"
              type="submit"
            >
              {restoreLabel}
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export const InboxConversationLiveRow = memo(
  InboxConversationLiveRowComponent,
  (previous, next) =>
    previous.activeSpaceId === next.activeSpaceId &&
    previous.currentUserId === next.currentUserId &&
    areInboxConversationSummariesEqual(previous.initialSummary, next.initialSummary) &&
    previous.isArchivedView === next.isArchivedView &&
    previous.isPrimaryChatsView === next.isPrimaryChatsView &&
    previous.item.conversationId === next.item.conversationId &&
    previous.item.groupAvatarPath === next.item.groupAvatarPath &&
    previous.item.isGroupConversation === next.item.isGroupConversation &&
    previous.item.title === next.item.title &&
    areInboxMetaLabelsEqual(previous.item.metaLabels, next.item.metaLabels) &&
    areInboxParticipantListsEqual(previous.item.participants, next.item.participants) &&
    previous.language === next.language &&
    previous.labels === next.labels &&
    previous.restoreAction === next.restoreAction &&
    previous.restoreLabel === next.restoreLabel,
);
