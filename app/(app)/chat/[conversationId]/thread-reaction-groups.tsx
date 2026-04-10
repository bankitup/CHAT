'use client';

import type { MessageReactionGroup } from '@/modules/messaging/data/server';
import {
  applyThreadReactionMutationResult,
  reconcileThreadReactionOptimisticMutation,
  rollbackThreadReactionOptimisticMutation,
  useThreadLiveReactionGroups,
} from '@/modules/messaging/realtime/thread-live-state-store';
import { useState } from 'react';
import { toggleReactionMutationAction } from './actions';

type ThreadReactionGroupsProps = {
  ariaLabel: string;
  conversationId: string;
  currentUserId: string;
  initialReactions: MessageReactionGroup[];
  isOwnMessage: boolean;
  messageId: string;
};

export function ThreadReactionGroups({
  ariaLabel,
  conversationId,
  currentUserId,
  initialReactions,
  isOwnMessage,
  messageId,
}: ThreadReactionGroupsProps) {
  const reactions = useThreadLiveReactionGroups(
    conversationId,
    messageId,
    initialReactions,
  );
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null);

  if (!reactions.length) {
    return null;
  }

  return (
    <div
      className={isOwnMessage ? 'reaction-groups reaction-groups-own' : 'reaction-groups'}
      aria-label={ariaLabel}
    >
      {reactions.map((reaction) => (
        <button
          key={`${messageId}-${reaction.emoji}`}
          className={
            reaction.selectedByCurrentUser
              ? 'reaction-pill reaction-pill-selected'
              : 'reaction-pill'
          }
          disabled={pendingEmoji === reaction.emoji}
          onClick={async () => {
            if (pendingEmoji) {
              return;
            }

            const optimisticSelected = !reaction.selectedByCurrentUser;

            applyThreadReactionMutationResult({
              conversationId,
              currentUserId,
              emoji: reaction.emoji,
              messageId,
              selected: optimisticSelected,
            });
            setPendingEmoji(reaction.emoji);
            try {
              const formData = new FormData();
              formData.set('conversationId', conversationId);
              formData.set('messageId', messageId);
              formData.set('emoji', reaction.emoji);
              const result = await toggleReactionMutationAction(formData);

              if (!result.ok) {
                rollbackThreadReactionOptimisticMutation({
                  conversationId,
                  currentUserId,
                  emoji: reaction.emoji,
                  messageId,
                  optimisticSelected,
                });
                return;
              }

              reconcileThreadReactionOptimisticMutation({
                conversationId,
                currentUserId,
                emoji: result.data.emoji,
                messageId: result.data.messageId,
                optimisticSelected,
                selected: result.data.selected,
              });
            } finally {
              setPendingEmoji(null);
            }
          }}
          type="button"
        >
          <span>{reaction.emoji}</span>
          <span className="reaction-count">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}
