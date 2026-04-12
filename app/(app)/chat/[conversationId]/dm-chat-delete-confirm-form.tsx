'use client';

import { useState } from 'react';
import { deleteDirectConversationAction } from './actions';
import { GuardedServerActionForm } from '../../guarded-server-action-form';
import { PendingSubmitButton } from '../../pending-submit-button';

type DmChatDeleteConfirmFormProps = {
  cancelLabel: string;
  confirmBody: string;
  confirmButtonLabel: string;
  confirmHint: string;
  confirmPlaceholder: string;
  confirmTitle: string;
  conversationId: string;
  deleteButtonLabel: string;
  returnTo?: 'settings-overlay' | 'settings-screen';
  spaceId?: string | null;
};

export function DmChatDeleteConfirmForm({
  cancelLabel,
  confirmBody,
  confirmButtonLabel,
  confirmHint,
  confirmPlaceholder,
  confirmTitle,
  conversationId,
  deleteButtonLabel,
  returnTo = 'settings-screen',
  spaceId,
}: DmChatDeleteConfirmFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const isConfirmed = confirmationText.trim() === 'Удалить';

  return (
    <>
      <button
        className="button button-compact button-danger-subtle"
        onClick={() => {
          setConfirmationText('');
          setIsOpen(true);
        }}
        type="button"
      >
        {deleteButtonLabel}
      </button>

      {isOpen ? (
        <section
          aria-label={confirmTitle}
          className="conversation-settings-overlay chat-delete-confirm-overlay"
        >
          <button
            aria-label={cancelLabel}
            className="conversation-settings-backdrop chat-delete-confirm-backdrop"
            onClick={() => setIsOpen(false)}
            type="button"
          />

          <section className="card stack conversation-settings-card chat-delete-confirm-card">
            <div className="conversation-settings-header">
              <button
                aria-label={cancelLabel}
                className="back-arrow-link conversation-settings-back-link"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <span aria-hidden="true">←</span>
              </button>
            </div>

            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">{confirmTitle}</h3>
              <p className="muted conversation-settings-note">{confirmBody}</p>
            </div>

            <p className="chat-delete-confirm-hint">{confirmHint}</p>

            <GuardedServerActionForm
              action={deleteDirectConversationAction}
              className="stack"
            >
              <input name="deleteMode" type="hidden" value="hard-delete-direct-chat" />
              <input name="confirmationMode" type="hidden" value="typed-delete-ru" />
              <input name="conversationId" type="hidden" value={conversationId} />
              <input name="returnTo" type="hidden" value={returnTo} />
              <input name="spaceId" type="hidden" value={spaceId ?? ''} />

              <label className="field">
                <span className="sr-only">{confirmHint}</span>
                <input
                  autoFocus
                  className="input"
                  name="confirmationText"
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder={confirmPlaceholder}
                  value={confirmationText}
                />
              </label>

              <div className="chat-delete-confirm-actions">
                <button
                  className="button button-secondary button-compact"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  {cancelLabel}
                </button>
                <PendingSubmitButton
                  className="button button-compact button-danger-subtle"
                  disabled={!isConfirmed}
                  type="submit"
                >
                  {confirmButtonLabel}
                </PendingSubmitButton>
              </div>
            </GuardedServerActionForm>
          </section>
        </section>
      ) : null}
    </>
  );
}
