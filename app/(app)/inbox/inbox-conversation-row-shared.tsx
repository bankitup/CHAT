'use client';

import { memo } from 'react';
import {
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/profile/ui/identity';

export type InboxConversationRowParticipant = {
  avatarPath?: string | null;
  displayName: string | null;
  userId: string;
};

export type InboxConversationRowMetaLabel = {
  label: string;
  tone: 'default' | 'archived';
};

type InboxConversationAvatarVisualProps = {
  groupAvatarPath: string | null;
  isGroupConversation: boolean;
  isPrimaryChatsView: boolean;
  participant: InboxConversationRowParticipant | null;
  title: string;
};

type InboxConversationTitleVisualProps = {
  className?: string;
  hasUnread: boolean;
  isPrimaryChatsView: boolean;
  title: string;
};

export function joinClassNames(
  ...values: Array<string | null | undefined | false>
) {
  return values.filter(Boolean).join(' ');
}

export function formatInboxTimestamp(
  value: string | null,
  language: 'en' | 'ru',
  noActivityLabel: string,
) {
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

export function formatInboxRecency(
  value: string | null,
  language: 'en' | 'ru',
  yesterdayLabel: string,
) {
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
    day: 'numeric',
    month: 'short',
  }).format(target);
}

export function formatInboxUnreadBadgeCount(value: number) {
  if (value <= 0) {
    return null;
  }

  if (value > 99) {
    return '99+';
  }

  return String(value);
}

export function areInboxParticipantsEqual(
  previous: InboxConversationRowParticipant | null,
  next: InboxConversationRowParticipant | null,
) {
  return (
    previous?.userId === next?.userId &&
    previous?.displayName === next?.displayName &&
    previous?.avatarPath === next?.avatarPath
  );
}

export function areInboxParticipantListsEqual(
  previous: InboxConversationRowParticipant[],
  next: InboxConversationRowParticipant[],
) {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((participant, index) =>
    areInboxParticipantsEqual(participant, next[index] ?? null),
  );
}

export function areInboxMetaLabelsEqual(
  previous: InboxConversationRowMetaLabel[],
  next: InboxConversationRowMetaLabel[],
) {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every(
    (label, index) =>
      label.label === next[index]?.label && label.tone === next[index]?.tone,
  );
}

export const InboxConversationAvatarVisual = memo(
  function InboxConversationAvatarVisual({
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
        diagnosticsSurface="inbox:conversation-row"
        identity={participant}
        label={title}
        size={isPrimaryChatsView ? 'lg' : 'md'}
      />
    );
  },
  (previous, next) =>
    previous.groupAvatarPath === next.groupAvatarPath &&
    previous.isGroupConversation === next.isGroupConversation &&
    previous.isPrimaryChatsView === next.isPrimaryChatsView &&
    previous.title === next.title &&
    areInboxParticipantsEqual(previous.participant, next.participant),
);

export const InboxConversationTitleVisual = memo(
  function InboxConversationTitleVisual({
    className,
    hasUnread,
    isPrimaryChatsView,
    title,
  }: InboxConversationTitleVisualProps) {
    return (
      <h3
        className={joinClassNames(
          hasUnread
            ? isPrimaryChatsView
              ? 'conversation-title conversation-title-unread conversation-title-dm'
              : 'conversation-title conversation-title-unread'
            : isPrimaryChatsView
              ? 'conversation-title conversation-title-dm'
              : 'conversation-title',
          className,
        )}
      >
        {title}
      </h3>
    );
  },
  (previous, next) =>
    previous.className === next.className &&
    previous.hasUnread === next.hasUnread &&
    previous.isPrimaryChatsView === next.isPrimaryChatsView &&
    previous.title === next.title,
);
