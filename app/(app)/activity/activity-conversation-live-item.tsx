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
} from '@/modules/profile/ui/identity';
import { withSpaceParam } from '@/modules/spaces/url';

type ActivityConversationLiveItemProps = {
  activeSpaceId: string | null;
  initialSummary: InboxConversationLiveSummary;
  item: {
    conversationId: string;
    groupAvatarPath: string | null;
    isGroupConversation: boolean;
    primaryParticipant:
      | {
          userId: string;
          displayName: string | null;
          avatarPath?: string | null;
        }
      | null;
    title: string;
    variant: 'attention' | 'recent';
  };
  language: 'en' | 'ru';
  labels: {
    audio: string;
    attachment: string;
    deletedMessage: string;
    encryptedMessage: string;
    file: string;
    newEncryptedMessage: string;
    noActivityYet: string;
    unreadMessages: string;
    voiceMessage: string;
    yesterday: string;
    group: string;
    image: string;
    attentionBadge: string;
    recentBadge: string;
  };
  shouldPrefetch?: boolean;
};

function formatActivityRecency(value: string | null, language: 'en' | 'ru', yesterdayLabel: string) {
  if (!value) {
    return '';
  }

  const target = new Date(value);

  if (Number.isNaN(target.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return language === 'ru' ? 'Сейчас' : 'Now';
  }

  if (diffMs < hourMs) {
    const minutes = Math.max(1, Math.round(diffMs / minuteMs));
    return language === 'ru' ? `${minutes} мин` : `${minutes}m`;
  }

  if (diffMs < dayMs) {
    return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(target);
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / dayMs,
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

type ActivityConversationAvatarVisualProps = {
  groupAvatarPath: string | null;
  isGroupConversation: boolean;
  primaryParticipant:
    | {
        userId: string;
        displayName: string | null;
        avatarPath?: string | null;
      }
    | null;
  title: string;
};

function areActivityParticipantsEqual(
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

const ActivityConversationAvatarVisual = memo(function ActivityConversationAvatarVisual({
  groupAvatarPath,
  isGroupConversation,
  primaryParticipant,
  title,
}: ActivityConversationAvatarVisualProps) {
  if (isGroupConversation) {
    return <GroupIdentityAvatar avatarPath={groupAvatarPath} label={title} size="sm" />;
  }

  return (
    <IdentityAvatar
      diagnosticsSurface="activity:conversation-live-avatar"
      identity={primaryParticipant}
      label={title}
      size="sm"
    />
  );
}, (previous, next) => {
  return (
    previous.groupAvatarPath === next.groupAvatarPath &&
    previous.isGroupConversation === next.isGroupConversation &&
    previous.title === next.title &&
    areActivityParticipantsEqual(previous.primaryParticipant, next.primaryParticipant)
  );
});

type ActivityConversationTitleVisualProps = {
  title: string;
};

const ActivityConversationTitleVisual = memo(function ActivityConversationTitleVisual({
  title,
}: ActivityConversationTitleVisualProps) {
  return <h3 className="activity-item-title">{title}</h3>;
});

export function ActivityConversationLiveItem({
  activeSpaceId,
  initialSummary,
  item,
  language,
  labels,
  shouldPrefetch = false,
}: ActivityConversationLiveItemProps) {
  const liveSummary = useSyncExternalStore(
    (listener) =>
      subscribeToInboxConversationSummary(item.conversationId, listener),
    () => getInboxConversationSummarySnapshot(item.conversationId, initialSummary),
    () => initialSummary,
  );

  if (liveSummary.removed || liveSummary.hiddenAt) {
    return null;
  }

  const lastActivityAt = liveSummary.lastMessageAt ?? liveSummary.createdAt;
  const preview = getInboxPreviewText(
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
      newEncryptedMessage: labels.newEncryptedMessage,
      voiceMessage: labels.voiceMessage,
    },
  );
  const chatHrefBase = activeSpaceId?.trim()
    ? withSpaceParam(`/chat/${item.conversationId}`, activeSpaceId)
    : `/chat/${item.conversationId}`;
  const latestMessageHash = liveSummary.latestMessageId?.trim()
    ? `#message-${liveSummary.latestMessageId.trim()}`
    : '';
  const chatHref = latestMessageHash ? `${chatHrefBase}${latestMessageHash}` : chatHrefBase;
  const itemKindLabel =
    item.variant === 'attention' ? labels.attentionBadge : labels.recentBadge;
  const unreadSummary =
    item.variant === 'attention' && liveSummary.unreadCount > 0
      ? `${liveSummary.unreadCount} ${labels.unreadMessages.toLowerCase()}`
      : null;

  return (
    <Link
      aria-label={
        item.variant === 'attention'
          ? `${item.title}. ${itemKindLabel}. ${unreadSummary ?? ''}`.trim()
          : `${item.title}. ${itemKindLabel}`.trim()
      }
      className={
        item.variant === 'recent'
          ? 'activity-item activity-item-messenger activity-item-recent'
          : 'activity-item activity-item-messenger activity-item-attention'
      }
      href={chatHref}
      prefetch={shouldPrefetch}
    >
      <ActivityConversationAvatarVisual
        groupAvatarPath={item.groupAvatarPath}
        isGroupConversation={item.isGroupConversation}
        primaryParticipant={item.primaryParticipant}
        title={item.title}
      />

      <div className="stack activity-item-copy">
        <div className="activity-item-title-row">
          <ActivityConversationTitleVisual title={item.title} />
          <span className="activity-item-recency">
            {formatActivityRecency(lastActivityAt, language, labels.yesterday)}
          </span>
        </div>

        {preview ? (
          <p className="muted activity-item-preview">{preview}</p>
        ) : (
          <p className="muted activity-item-preview activity-item-preview-empty">
            {labels.noActivityYet}
          </p>
        )}

        <div className="activity-item-meta">
          <div className="activity-item-meta-left">
            <span className="activity-item-kind-pill">{itemKindLabel}</span>
            {unreadSummary ? (
              <span className="activity-unread-pill">
                {unreadSummary}
              </span>
            ) : null}
            {item.isGroupConversation ? (
              <span className="conversation-kind-label">{labels.group}</span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
