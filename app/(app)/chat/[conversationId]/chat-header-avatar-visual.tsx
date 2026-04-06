'use client';

import { memo } from 'react';
import {
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/messaging/ui/identity';

export type ChatHeaderParticipantIdentity = {
  avatarPath?: string | null;
  displayName: string | null;
  userId: string;
} | null | undefined;

type ChatHeaderAvatarVisualProps = {
  className?: string;
  conversationKind: 'dm' | 'group';
  groupAvatarPath: string | null;
  participant: ChatHeaderParticipantIdentity;
  size?: 'sm' | 'md' | 'lg';
  title: string;
};

function areHeaderParticipantsEqual(
  previous: ChatHeaderParticipantIdentity,
  next: ChatHeaderParticipantIdentity,
) {
  return (
    previous?.userId === next?.userId &&
    previous?.displayName === next?.displayName &&
    previous?.avatarPath === next?.avatarPath
  );
}

export const ChatHeaderAvatarVisual = memo(function ChatHeaderAvatarVisual({
  className,
  conversationKind,
  groupAvatarPath,
  participant,
  size = 'lg',
  title,
}: ChatHeaderAvatarVisualProps) {
  if (conversationKind === 'group') {
    return (
      <GroupIdentityAvatar
        avatarPath={groupAvatarPath}
        className={className}
        label={title}
        size={size}
      />
    );
  }

  return (
    <IdentityAvatar
      className={className}
      diagnosticsSurface="chat:header"
      identity={participant}
      label={title}
      size={size}
    />
  );
}, (previous, next) => {
  return (
    previous.className === next.className &&
    previous.conversationKind === next.conversationKind &&
    previous.groupAvatarPath === next.groupAvatarPath &&
    previous.size === next.size &&
    previous.title === next.title &&
    areHeaderParticipantsEqual(previous.participant, next.participant)
  );
});
