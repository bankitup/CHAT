'use client';

import { memo } from 'react';
import {
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/messaging/ui/identity';

type ChatHeaderParticipantIdentity = {
  avatarPath?: string | null;
  displayName: string | null;
  userId: string;
} | null | undefined;

type ChatHeaderAvatarVisualProps = {
  conversationKind: 'dm' | 'group';
  groupAvatarPath: string | null;
  participant: ChatHeaderParticipantIdentity;
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
  conversationKind,
  groupAvatarPath,
  participant,
  title,
}: ChatHeaderAvatarVisualProps) {
  if (conversationKind === 'group') {
    return (
      <GroupIdentityAvatar
        avatarPath={groupAvatarPath}
        label={title}
        size="lg"
      />
    );
  }

  return (
    <IdentityAvatar
      diagnosticsSurface="chat:header"
      identity={participant}
      label={title}
      size="lg"
    />
  );
}, (previous, next) => {
  return (
    previous.conversationKind === next.conversationKind &&
    previous.groupAvatarPath === next.groupAvatarPath &&
    previous.title === next.title &&
    areHeaderParticipantsEqual(previous.participant, next.participant)
  );
});
