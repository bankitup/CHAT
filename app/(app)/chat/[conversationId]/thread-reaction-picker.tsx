'use client';

import { useState } from 'react';
import {
  applyThreadReactionMutationResult,
  useThreadLiveReactionGroups,
} from '@/modules/messaging/realtime/thread-live-state-store';
import type { MessageReactionGroup } from '@/modules/messaging/data/server';
import { toggleReactionMutationAction } from './actions';

type ThreadReactionPickerProps = {
  className?: string;
  conversationId: string;
  currentUserId: string;
  emojis: readonly string[];
  initialReactions: MessageReactionGroup[];
  isOwnMessage?: boolean;
  messageId: string;
  onReactionSelected?: () => void;
  showCounts?: boolean;
};

export function ThreadReactionPicker({
  className,
  conversationId,
  currentUserId,
  emojis,
  initialReactions,
  isOwnMessage = false,
  messageId,
  onReactionSelected,
  showCounts = true,
}: ThreadReactionPickerProps) {
  const reactions = useThreadLiveReactionGroups(
    conversationId,
    messageId,
    initialReactions,
  );
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null);

  return (
    <div
      className={[
        'reaction-picker',
        isOwnMessage ? 'reaction-picker-own' : null,
        className ?? null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {emojis.map((emoji) => {
        const currentReaction = reactions.find((reaction) => reaction.emoji === emoji);

        return (
          <button
            key={`${messageId}-picker-${emoji}`}
            className={
              currentReaction?.selectedByCurrentUser
                ? 'reaction-toggle reaction-toggle-selected'
                : 'reaction-toggle'
            }
            disabled={pendingEmoji === emoji}
            onClick={async () => {
              if (pendingEmoji) {
                return;
              }

              setPendingEmoji(emoji);
              try {
                const formData = new FormData();
                formData.set('conversationId', conversationId);
                formData.set('emoji', emoji);
                formData.set('messageId', messageId);
                const result = await toggleReactionMutationAction(formData);

                if (!result.ok) {
                  return;
                }

                applyThreadReactionMutationResult({
                  conversationId,
                  currentUserId,
                  emoji: result.data.emoji,
                  messageId: result.data.messageId,
                  selected: result.data.selected,
                });
                onReactionSelected?.();
              } finally {
                setPendingEmoji(null);
              }
            }}
            type="button"
          >
            <span>{emoji}</span>
            {showCounts && currentReaction ? (
              <span className="reaction-count">{currentReaction.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
