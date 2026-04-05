'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { getInboxPreviewText } from '@/modules/messaging/e2ee/inbox-policy';
import {
  getInboxConversationSummarySnapshot,
  hydrateInboxConversationSummaries,
  subscribeToInboxConversationSummary,
  type InboxConversationLiveSummary,
} from '@/modules/messaging/realtime/inbox-summary-store';
import {
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/messaging/ui/identity';

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
    variant: 'recent' | 'unread';
  };
  language: 'en' | 'ru';
  labels: {
    attachment: string;
    deletedMessage: string;
    encryptedMessage: string;
    newEncryptedMessage: string;
    noActivityYet: string;
    unreadMessages: string;
    voiceMessage: string;
    yesterday: string;
    group: string;
  };
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

function formatActivityTimestamp(value: string | null, language: 'en' | 'ru', noActivityLabel: string) {
  if (!value) {
    return noActivityLabel;
  }

  const target = new Date(value);

  if (Number.isNaN(target.getTime())) {
    return noActivityLabel;
  }

  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(target);
}

export function ActivityConversationLiveItem({
  activeSpaceId,
  initialSummary,
  item,
  language,
  labels,
}: ActivityConversationLiveItemProps) {
  useEffect(() => {
    hydrateInboxConversationSummaries([initialSummary]);
  }, [initialSummary]);

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

  return (
    <Link
      className={
        item.variant === 'recent'
          ? 'activity-item activity-item-recent'
          : 'activity-item'
      }
      href={
        activeSpaceId?.trim()
          ? `/chat/${item.conversationId}?space=${encodeURIComponent(activeSpaceId)}`
          : `/chat/${item.conversationId}`
      }
      prefetch={false}
    >
      {item.isGroupConversation ? (
        <GroupIdentityAvatar
          avatarPath={item.groupAvatarPath}
          label={item.title}
          size="sm"
        />
      ) : (
        <IdentityAvatar
          diagnosticsSurface={`activity:${item.variant}-item-live`}
          identity={item.primaryParticipant}
          label={item.title}
          size="sm"
        />
      )}

      <div className="stack activity-item-copy">
        <div className="activity-item-title-row">
          <h3 className="activity-item-title">{item.title}</h3>
          <span className="activity-item-recency">
            {formatActivityRecency(lastActivityAt, language, labels.yesterday)}
          </span>
        </div>

        {preview ? <p className="muted activity-item-preview">{preview}</p> : null}

        <div className="activity-item-meta">
          {item.variant === 'unread' ? (
            <span className="activity-unread-pill">
              {labels.unreadMessages}: {liveSummary.unreadCount}
            </span>
          ) : item.isGroupConversation ? (
            <span className="conversation-kind-label">{labels.group}</span>
          ) : null}
          <span className="muted activity-item-timestamp">
            {formatActivityTimestamp(lastActivityAt, language, labels.noActivityYet)}
          </span>
        </div>
      </div>
    </Link>
  );
}
