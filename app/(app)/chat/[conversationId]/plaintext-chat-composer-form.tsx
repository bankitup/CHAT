'use client';

import { useRef, useState } from 'react';
import { patchInboxConversationSummary } from '@/modules/messaging/realtime/inbox-summary-store';
import { broadcastMessageCommitted } from '@/modules/messaging/realtime/live-refresh';
import {
  emitOptimisticThreadMessage,
  type OptimisticThreadMessagePayload,
} from '@/modules/messaging/realtime/optimistic-thread';
import { emitThreadHistorySyncRequest } from '@/modules/messaging/realtime/thread-history-sync-events';
import { patchThreadConversationReadState } from '@/modules/messaging/realtime/thread-live-state-store';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { ComposerAttachmentPicker } from './composer-attachment-picker';
import { ComposerTypingTextarea } from './composer-typing-textarea';
import { sendMessageMutationAction } from './actions';

type MentionParticipant = {
  userId: string;
  label: string;
};

type PlaintextChatComposerFormProps = {
  accept: string;
  attachmentHelpText: string;
  attachmentMaxSizeBytes: number;
  attachmentMaxSizeLabel: string;
  conversationId: string;
  currentUserId: string;
  currentUserLabel: string;
  language: AppLanguage;
  mentionParticipants?: MentionParticipant[];
  mentionSuggestionsLabel: string;
  messagePlaceholder: string;
  replyToMessageId?: string | null;
};

function clearReplyTargetFromCurrentUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete('replyToMessageId');
  window.history.replaceState(
    window.history.state,
    '',
    `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
  );
}

export function PlaintextChatComposerForm({
  accept,
  attachmentHelpText,
  attachmentMaxSizeBytes,
  attachmentMaxSizeLabel,
  conversationId,
  currentUserId,
  currentUserLabel,
  language,
  mentionParticipants,
  mentionSuggestionsLabel,
  messagePlaceholder,
  replyToMessageId,
}: PlaintextChatComposerFormProps) {
  const t = getTranslations(language);
  const formRef = useRef<HTMLFormElement | null>(null);
  const isSubmittingRef = useRef(false);
  const sendSignatureRef = useRef<string | null>(null);
  const [composerResetKey, setComposerResetKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  return (
    <form
      ref={formRef}
      className="stack composer-form"
      onSubmit={async (event) => {
        event.preventDefault();

        const form = event.currentTarget;
        const formData = new FormData(form);
        const body = String(formData.get('body') ?? '').trim();
        const attachmentEntry = formData.get('attachment');
        const attachment =
          attachmentEntry instanceof File && attachmentEntry.size > 0
            ? attachmentEntry
            : null;

        if (!body && !attachment) {
          return;
        }

        const sendSignature = [
          conversationId,
          replyToMessageId ?? '',
          body,
          attachment?.name ?? '',
          attachment ? String(attachment.size) : '',
          attachment?.type ?? '',
        ].join(':');

        if (isSubmittingRef.current || sendSignatureRef.current === sendSignature) {
          return;
        }

        isSubmittingRef.current = true;
        sendSignatureRef.current = sendSignature;
        setIsSending(true);
        setErrorMessage(null);

        const canUseOptimisticTextOnly = Boolean(body && !attachment);
        const optimisticClientId = crypto.randomUUID();
        const optimisticCreatedAt = new Date().toISOString();
        formData.set('clientId', optimisticClientId);

        if (canUseOptimisticTextOnly) {
          emitOptimisticThreadMessage({
            body,
            clientId: optimisticClientId,
            conversationId,
            createdAt: optimisticCreatedAt,
            replyToMessageId: replyToMessageId ?? null,
            status: 'pending',
          } satisfies OptimisticThreadMessagePayload);
        }

        try {
          const result = await sendMessageMutationAction(formData);

          if (!result.ok) {
            setErrorMessage(result.error);

            if (canUseOptimisticTextOnly) {
              emitOptimisticThreadMessage({
                body,
                clientId: optimisticClientId,
                conversationId,
                createdAt: optimisticCreatedAt,
                errorMessage: result.error,
                replyToMessageId: replyToMessageId ?? null,
                status: 'failed',
              } satisfies OptimisticThreadMessagePayload);
            }

            return;
          }

          if (result.data.summary) {
            patchInboxConversationSummary(result.data.summary);
          }

          patchThreadConversationReadState({
            conversationId,
            isCurrentUser: true,
            lastReadMessageSeq: result.data.lastReadMessageSeq,
          });
          emitThreadHistorySyncRequest({
            conversationId,
            messageIds: [result.data.messageId],
            reason: 'local-send-mutation',
          });

          if (canUseOptimisticTextOnly) {
            emitOptimisticThreadMessage({
              body,
              clientId: result.data.clientId ?? optimisticClientId,
              conversationId,
              createdAt: result.data.timestamp ?? optimisticCreatedAt,
              replyToMessageId: replyToMessageId ?? null,
              status: 'sent',
            } satisfies OptimisticThreadMessagePayload);
          }

          form.reset();
          setComposerResetKey((current) => current + 1);
          clearReplyTargetFromCurrentUrl();

          window.requestAnimationFrame(() => {
            const textarea =
              formRef.current?.querySelector<HTMLTextAreaElement>('textarea[name="body"]');

            if (!textarea) {
              return;
            }

            textarea.focus();
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          });

          await broadcastMessageCommitted(`chat-sync:${conversationId}`, {
            clientId: result.data.clientId,
            conversationId,
            messageId: result.data.messageId,
            source: 'plaintext-chat-send',
          });
        } catch {
          const fallbackError = 'Unable to send that message right now.';
          setErrorMessage(fallbackError);

          if (canUseOptimisticTextOnly) {
            emitOptimisticThreadMessage({
              body,
              clientId: optimisticClientId,
              conversationId,
              createdAt: optimisticCreatedAt,
              errorMessage: fallbackError,
              replyToMessageId: replyToMessageId ?? null,
              status: 'failed',
            } satisfies OptimisticThreadMessagePayload);
          }
        } finally {
          isSubmittingRef.current = false;
          sendSignatureRef.current = null;
          setIsSending(false);
        }
      }}
    >
      <input name="conversationId" type="hidden" value={conversationId} />
      {replyToMessageId ? (
        <input name="replyToMessageId" type="hidden" value={replyToMessageId} />
      ) : null}
      <div className="composer-input-shell">
        <ComposerAttachmentPicker
          key={`attachment-${composerResetKey}`}
          accept={accept}
          helperText={attachmentHelpText}
          maxSizeBytes={attachmentMaxSizeBytes}
          maxSizeLabel={attachmentMaxSizeLabel}
          language={language}
        />

        <label className="field composer-input-field">
          <span className="sr-only">{messagePlaceholder}</span>
          <ComposerTypingTextarea
            key={`textarea-${composerResetKey}`}
            className="input textarea"
            conversationId={conversationId}
            currentUserId={currentUserId}
            currentUserLabel={currentUserLabel}
            mentionParticipants={mentionParticipants}
            mentionSuggestionsLabel={mentionSuggestionsLabel}
            name="body"
            placeholder={messagePlaceholder}
            rows={1}
            maxHeight={136}
          />
        </label>

        <div className="composer-action-cluster">
          <button
            aria-label={t.chat.microphone}
            className="button button-secondary composer-button composer-button-mic"
            disabled
            title={t.chat.voiceMessagesSoon}
            type="button"
          >
            <span aria-hidden="true" className="composer-mic-icon" />
          </button>

          <button
            aria-label={t.chat.sendMessage}
            className="button composer-button composer-button-icon"
            disabled={isSending}
            type="submit"
          >
            <span aria-hidden="true">➤</span>
          </button>
        </div>
      </div>
      {errorMessage ? <p className="notice notice-error">{errorMessage}</p> : null}
    </form>
  );
}
