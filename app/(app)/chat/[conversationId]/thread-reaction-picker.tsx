'use client';

import { useCallback, useRef, useState } from 'react';
import {
  applyThreadReactionMutationResult,
  reconcileThreadReactionOptimisticMutation,
  rollbackThreadReactionOptimisticMutation,
  useThreadLiveReactionGroups,
} from '@/modules/messaging/realtime/thread-live-state-store';
import type { MessageReactionGroup } from '@/modules/messaging/data/thread-read-server';
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
  const lastPointerHandledReactionRef = useRef<{
    emoji: string;
    handledAt: number;
  } | null>(null);

  const selectReaction = useCallback(
    async (input: {
      emoji: string;
      optimisticSelected: boolean;
    }) => {
      if (pendingEmoji) {
        return;
      }

      applyThreadReactionMutationResult({
        conversationId,
        currentUserId,
        emoji: input.emoji,
        messageId,
        selected: input.optimisticSelected,
      });
      onReactionSelected?.();
      setPendingEmoji(input.emoji);

      try {
        const formData = new FormData();
        formData.set('conversationId', conversationId);
        formData.set('emoji', input.emoji);
        formData.set('messageId', messageId);
        const result = await toggleReactionMutationAction(formData);

        if (!result.ok) {
          rollbackThreadReactionOptimisticMutation({
            conversationId,
            currentUserId,
            emoji: input.emoji,
            messageId,
            optimisticSelected: input.optimisticSelected,
          });
          return;
        }

        reconcileThreadReactionOptimisticMutation({
          conversationId,
          currentUserId,
          emoji: result.data.emoji,
          messageId: result.data.messageId,
          optimisticSelected: input.optimisticSelected,
          selected: result.data.selected,
        });
      } finally {
        setPendingEmoji(null);
      }
    },
    [
      conversationId,
      currentUserId,
      messageId,
      onReactionSelected,
      pendingEmoji,
    ],
  );

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
            onClick={(event) => {
              event.stopPropagation();

              const lastPointerHandledReaction =
                lastPointerHandledReactionRef.current;

              if (
                lastPointerHandledReaction?.emoji === emoji &&
                Date.now() - lastPointerHandledReaction.handledAt < 800
              ) {
                lastPointerHandledReactionRef.current = null;
                return;
              }

              void selectReaction({
                emoji,
                optimisticSelected: !Boolean(
                  currentReaction?.selectedByCurrentUser,
                ),
              });
            }}
            onPointerUp={(event) => {
              if (
                event.pointerType === 'mouse' ||
                event.button !== 0 ||
                pendingEmoji
              ) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              lastPointerHandledReactionRef.current = {
                emoji,
                handledAt: Date.now(),
              };

              void selectReaction({
                emoji,
                optimisticSelected: !Boolean(
                  currentReaction?.selectedByCurrentUser,
                ),
              });
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
