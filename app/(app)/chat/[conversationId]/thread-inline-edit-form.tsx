'use client';

import Link from 'next/link';
import { useState } from 'react';
import { patchInboxConversationSummary } from '@/modules/messaging/realtime/inbox-summary-store';
import { patchThreadMessageContent } from '@/modules/messaging/realtime/thread-message-patch-store';
import { AutoGrowTextarea } from './auto-grow-textarea';
import { editMessageMutationAction } from './actions';

type ThreadInlineEditFormProps = {
  cancelHref: string;
  conversationId: string;
  emptyMessageLabel: string;
  hasAttachments: boolean;
  initialBody: string;
  labels: {
    cancel: string;
    save: string;
  };
  messageId: string;
};

export function ThreadInlineEditForm({
  cancelHref,
  conversationId,
  emptyMessageLabel,
  hasAttachments,
  initialBody,
  labels,
  messageId,
}: ThreadInlineEditFormProps) {
  const [isEditing, setIsEditing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [resolvedBody, setResolvedBody] = useState(initialBody);

  if (!isEditing) {
    const normalizedBody = resolvedBody.trim();

    if (normalizedBody) {
      return <p className="message-body">{normalizedBody}</p>;
    }

    if (!hasAttachments) {
      return <p className="message-body">{emptyMessageLabel}</p>;
    }

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
          const result = await editMessageMutationAction(formData);

          if (!result.ok) {
            setErrorMessage(result.error);
            return;
          }

          patchThreadMessageContent({
            body: result.data.body,
            conversationId,
            editedAt: result.data.editedAt,
            messageId,
          });

          if (result.data.summary) {
            patchInboxConversationSummary(result.data.summary);
          }

          setResolvedBody(result.data.body);
          setIsEditing(false);

          if (typeof window !== 'undefined') {
            window.history.replaceState(window.history.state, '', cancelHref);
          }
        } catch {
          setErrorMessage('Unable to save that edit right now.');
        } finally {
          setIsPending(false);
        }
      }}
      className="stack message-edit-form"
    >
      <input name="conversationId" type="hidden" value={conversationId} />
      <input name="messageId" type="hidden" value={messageId} />
      <label className="field">
        <span className="sr-only">{labels.save}</span>
        <AutoGrowTextarea
          className="input textarea"
          defaultValue={initialBody}
          maxHeight={160}
          name="body"
          required
          rows={2}
        />
      </label>
      {errorMessage ? <p className="notice notice-error">{errorMessage}</p> : null}
      <div className="message-edit-actions">
        <button className="button button-compact" disabled={isPending} type="submit">
          {labels.save}
        </button>
        <Link className="pill message-edit-cancel" href={cancelHref} prefetch={false}>
          {labels.cancel}
        </Link>
      </div>
    </form>
  );
}
