'use client';

import type { MouseEventHandler } from 'react';
import { ThreadReactionPicker } from './thread-reaction-picker';
import type { MessageReactionGroup } from './thread-history-types';

type ThreadMessageQuickActionsProps = {
  conversationId: string;
  currentUserId: string;
  initialReactions: MessageReactionGroup[];
  isOwnMessage: boolean;
  messageId: string;
  onReactionSelected: () => void;
  onReplyAction: MouseEventHandler<HTMLButtonElement>;
  placement: 'above' | 'below';
  replyLabel: string;
};

export function ThreadMessageQuickActions({
  conversationId,
  currentUserId,
  initialReactions,
  isOwnMessage,
  messageId,
  onReactionSelected,
  onReplyAction,
  placement,
  replyLabel,
}: ThreadMessageQuickActionsProps) {
  return (
    <div
      className={
        isOwnMessage
          ? 'message-quick-actions message-quick-actions-own'
          : 'message-quick-actions'
      }
      data-message-quick-actions-surface="true"
      data-placement={placement}
    >
      <div className="message-quick-actions-primary">
        <ThreadReactionPicker
          className="message-quick-actions-reactions"
          conversationId={conversationId}
          currentUserId={currentUserId}
          emojis={['❤️', '👍', '😂', '😮', '🎉']}
          initialReactions={initialReactions}
          isOwnMessage={isOwnMessage}
          messageId={messageId}
          onReactionSelected={onReactionSelected}
          showCounts={false}
        />
      </div>
      <div className="message-quick-actions-secondary">
        <button
          aria-label={replyLabel}
          className="message-quick-actions-action"
          onClick={onReplyAction}
          title={replyLabel}
          type="button"
        >
          <span
            aria-hidden="true"
            className="message-quick-actions-action-icon"
          >
            ↩
          </span>
          <span className="message-quick-actions-action-label">
            {replyLabel}
          </span>
        </button>
      </div>
    </div>
  );
}
