'use client';

import Link from 'next/link';
import { memo, useSyncExternalStore } from 'react';
import { getInboxPreviewText } from '@/modules/messaging/e2ee/inbox-policy';
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
    attachment: string;
    deletedMessage: string;
    encryptedMessage: string;
    group: string;
    newEncryptedMessage: string;
    noActivityYet: string;
    unreadAria: string;
    voiceMessage: string;
    yesterday: string;
  };
  restoreAction?: ((formData: FormData) => void | Promise<void>) | null;
  restoreLabel?: string;
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
  item,
  language,
  labels,
  restoreAction,
  restoreLabel,
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

  const preview = getInboxPreviewText(
    {
      lastMessageAt: liveSummary.lastMessageAt,
      latestMessageBody: liveSummary.latestMessageBody,
      latestMessageContentMode: liveSummary.latestMessageContentMode,
      latestMessageDeletedAt: liveSummary.latestMessageDeletedAt,
      latestMessageKind: liveSummary.latestMessageKind,
      unreadCount: liveSummary.unreadCount,
    },
    {
      attachment: labels.attachment,
      deletedMessage: labels.deletedMessage,
      encryptedMessage: labels.encryptedMessage,
      newEncryptedMessage: labels.newEncryptedMessage,
      voiceMessage: labels.voiceMessage,
    },
  );
  const hasUnread = liveSummary.unreadCount > 0;
  const lastActivityAt = liveSummary.lastMessageAt ?? liveSummary.createdAt;
  const recencyLabel = formatRecency(lastActivityAt, language, labels.yesterday);
  const timestampLabel = formatTimestamp(
    lastActivityAt,
    language,
    labels.noActivityYet,
  );

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
          href={
            activeSpaceId?.trim()
              ? `/chat/${item.conversationId}?space=${encodeURIComponent(activeSpaceId)}`
              : `/chat/${item.conversationId}`
          }
          prefetch={false}
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
    previous.initialSummary === next.initialSummary &&
    previous.isArchivedView === next.isArchivedView &&
    previous.isPrimaryChatsView === next.isPrimaryChatsView &&
    previous.item === next.item &&
    previous.language === next.language &&
    previous.labels === next.labels &&
    previous.restoreAction === next.restoreAction &&
    previous.restoreLabel === next.restoreLabel,
);
