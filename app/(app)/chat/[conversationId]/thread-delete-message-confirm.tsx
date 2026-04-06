'use client';

import Link from 'next/link';
import { useState } from 'react';
import { patchInboxConversationSummary } from '@/modules/messaging/realtime/inbox-summary-store';
import { emitThreadHistorySyncRequest } from '@/modules/messaging/realtime/thread-history-sync-events';
import { deleteMessageMutationAction } from './actions';

type ThreadDeleteMessageConfirmProps = {
  cancelHref: string;
  conversationId: string;
  labels: {
    cancel: string;
    confirm: string;
    prompt: string;
  };
  messageId: string;
};

export function ThreadDeleteMessageConfirm({
  cancelHref,
  conversationId,
  labels,
  messageId,
}: ThreadDeleteMessageConfirmProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  if (isResolved) {
    return null;
  }

  return (
    <form
      action={async (formData) => {
        if (isPending) {
          return;
        }

        setIsPending(true);
        setErrorMessage(null);

        try {
          const result = await deleteMessageMutationAction(formData);

          if (!result.ok) {
            setErrorMessage(result.error);
            return;
          }

          if (result.data.summary) {
            patchInboxConversationSummary(result.data.summary);
          }

          emitThreadHistorySyncRequest({
            conversationId,
            messageIds: [messageId],
            reason: 'local-delete-mutation',
          });

          if (typeof window !== 'undefined') {
            window.history.replaceState(window.history.state, '', cancelHref);
          }

          setIsResolved(true);
        } catch {
          setErrorMessage('Unable to delete that message right now.');
        } finally {
          setIsPending(false);
        }
      }}
      className="message-delete-confirm"
    >
      <input name="conversationId" type="hidden" value={conversationId} />
      <input name="messageId" type="hidden" value={messageId} />
      <input name="confirmDelete" type="hidden" value="true" />
      <span className="message-delete-copy">{labels.prompt}</span>
      {errorMessage ? <p className="notice notice-error">{errorMessage}</p> : null}
      <div className="message-delete-actions">
        <button className="button button-compact" disabled={isPending} type="submit">
          {labels.confirm}
        </button>
        <Link className="pill message-edit-cancel" href={cancelHref} prefetch={false}>
          {labels.cancel}
        </Link>
      </div>
    </form>
  );
}
