'use client';

import { useState } from 'react';
import {
  applyThreadReactionMutationResult,
  useThreadLiveReactionGroups,
} from '@/modules/messaging/realtime/thread-live-state-store';
import type { MessageReactionGroup } from '@/modules/messaging/data/server';
import { toggleReactionMutationAction } from './actions';

type ThreadReactionPickerProps = {
  conversationId: string;
  currentUserId: string;
  emojis: readonly string[];
  initialReactions: MessageReactionGroup[];
  isOwnMessage?: boolean;
  messageId: string;
};

export function ThreadReactionPicker({
  conversationId,
  currentUserId,
  emojis,
  initialReactions,
  isOwnMessage = false,
  messageId,
}: ThreadReactionPickerProps) {
  const reactions = useThreadLiveReactionGroups(
    conversationId,
    messageId,
    initialReactions,
  );
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null);

  return (
    <div
      className={
        isOwnMessage
          ? 'reaction-picker reaction-picker-own message-sheet-reactions'
          : 'reaction-picker message-sheet-reactions'
      }
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
              } finally {
                setPendingEmoji(null);
              }
            }}
            type="button"
          >
            <span>{emoji}</span>
            {currentReaction ? (
              <span className="reaction-count">{currentReaction.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
