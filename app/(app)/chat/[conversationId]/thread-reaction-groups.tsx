'use client';

import type { MessageReactionGroup } from '@/modules/messaging/data/server';
import { useThreadLiveReactionGroups } from '@/modules/messaging/realtime/thread-live-state-store';
import { GuardedServerActionForm } from '../../guarded-server-action-form';

type ThreadReactionGroupsProps = {
  action: (formData: FormData) => void | Promise<void>;
  ariaLabel: string;
  conversationId: string;
  initialReactions: MessageReactionGroup[];
  isOwnMessage: boolean;
  messageId: string;
};

export function ThreadReactionGroups({
  action,
  ariaLabel,
  conversationId,
  initialReactions,
  isOwnMessage,
  messageId,
}: ThreadReactionGroupsProps) {
  const reactions = useThreadLiveReactionGroups(
    conversationId,
    messageId,
    initialReactions,
  );

  if (!reactions.length) {
    return null;
  }

  return (
    <div
      className={isOwnMessage ? 'reaction-groups reaction-groups-own' : 'reaction-groups'}
      aria-label={ariaLabel}
    >
      {reactions.map((reaction) => (
        <GuardedServerActionForm
          key={`${messageId}-${reaction.emoji}`}
          action={action}
        >
          <input name="conversationId" type="hidden" value={conversationId} />
          <input name="messageId" type="hidden" value={messageId} />
          <input name="emoji" type="hidden" value={reaction.emoji} />
          <button
            className={
              reaction.selectedByCurrentUser
                ? 'reaction-pill reaction-pill-selected'
                : 'reaction-pill'
            }
            type="submit"
          >
            <span>{reaction.emoji}</span>
            <span className="reaction-count">{reaction.count}</span>
          </button>
        </GuardedServerActionForm>
      ))}
    </div>
  );
}
