'use client';

import { useEffect, useRef, useState } from 'react';
import { patchInboxConversationSummary } from '@/modules/messaging/realtime/inbox-summary-store';
import { broadcastMessageCommitted } from '@/modules/messaging/realtime/live-refresh';
import {
  LOCAL_OPTIMISTIC_MESSAGE_RETRY_EVENT,
  type OptimisticThreadRetryPayload,
} from '@/modules/messaging/realtime/optimistic-thread';
import { emitThreadHistorySyncRequest } from '@/modules/messaging/realtime/thread-history-sync-events';
import { patchThreadConversationReadState } from '@/modules/messaging/realtime/thread-live-state-store';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { ComposerAttachmentPicker } from './composer-attachment-picker';
import { ComposerTypingTextarea } from './composer-typing-textarea';
import { ComposerVoiceDraftPanel } from './composer-voice-draft-panel';
import { sendMessageMutationAction } from './actions';
import { useComposerVoiceDraft } from './use-composer-voice-draft';
import { useConversationOutgoingQueue } from './use-conversation-outgoing-queue';

type MentionParticipant = {
  userId: string;
  label: string;
};

type PlaintextOutgoingPayload =
  | {
      attachment: File | null;
      kind: 'text' | 'attachment';
      voiceDurationMs: null;
    }
  | {
      attachment: File;
      kind: 'voice';
      voiceDurationMs: number | null;
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
  const lastVoiceEntryAttemptAtRef = useRef(0);
  const [composerResetKey, setComposerResetKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const voiceDraft = useComposerVoiceDraft({
    contentMode: 'plaintext',
    conversationId,
    replyToMessageId: replyToMessageId ?? null,
  });
  const voiceEntryDisabledReason =
    voiceDraft.captureState === 'requesting-permission'
      ? 'requesting-permission'
      : voiceDraft.captureState === 'recording'
        ? 'recording'
        : voiceDraft.draft
          ? 'draft-ready'
          : null;
  const { enqueue } = useConversationOutgoingQueue({
    conversationId,
    processItem: async (item) => {
      const nextFormData = new FormData();
      nextFormData.set('conversationId', conversationId);
      nextFormData.set('clientId', item.clientId);
      const payload = item.payload as PlaintextOutgoingPayload;
      const attachment = payload.attachment ?? item.attachment ?? null;

      if (item.body.trim()) {
        nextFormData.set('body', item.body);
      }

      if (item.replyToMessageId) {
        nextFormData.set('replyToMessageId', item.replyToMessageId);
      }

      if (attachment) {
        nextFormData.set('attachment', attachment);
      }

      if (payload.kind === 'voice') {
        nextFormData.set(
          'voiceDurationMs',
          payload.voiceDurationMs !== null
            ? String(payload.voiceDurationMs)
            : '',
        );
      }

      const result = await sendMessageMutationAction(nextFormData);

      if (!result.ok) {
        throw new Error(result.error);
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

      await broadcastMessageCommitted(`chat-sync:${conversationId}`, {
        clientId: result.data.clientId,
        conversationId,
        messageId: result.data.messageId,
        source: 'plaintext-chat-send',
      });
    },
    resolveErrorMessage: (error) =>
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Unable to send that message right now.',
  });

  function attemptVoiceEntry(source: 'click' | 'pointer') {
    const now = Date.now();

    if (now - lastVoiceEntryAttemptAtRef.current < 480) {
      if (
        process.env.NEXT_PUBLIC_CHAT_DEBUG_VOICE === '1' &&
        typeof window !== 'undefined'
      ) {
        console.info('[voice-composer-button]', 'mic:trigger-suppressed', {
          captureState: voiceDraft.captureState,
          conversationId,
          disabledReason: voiceEntryDisabledReason,
          isSupported: voiceDraft.isSupported,
          source,
        });
      }

      return;
    }

    lastVoiceEntryAttemptAtRef.current = now;

    if (
      process.env.NEXT_PUBLIC_CHAT_DEBUG_VOICE === '1' &&
      typeof window !== 'undefined'
    ) {
      console.info('[voice-composer-button]', 'mic:triggered', {
        captureState: voiceDraft.captureState,
        conversationId,
        disabledReason: voiceEntryDisabledReason,
        isSupported: voiceDraft.isSupported,
        source,
      });
    }

    const activeElement = document.activeElement;

    if (
      activeElement instanceof HTMLElement &&
      (activeElement.tagName === 'TEXTAREA' ||
        (activeElement.tagName === 'INPUT' &&
          activeElement.getAttribute('type') !== 'file'))
    ) {
      activeElement.blur();
    }

    window.setTimeout(() => {
      if (
        process.env.NEXT_PUBLIC_CHAT_DEBUG_VOICE === '1' &&
        typeof window !== 'undefined'
      ) {
        console.info('[voice-composer-button]', 'mic:entry-attempt', {
          captureState: voiceDraft.captureState,
          conversationId,
          source,
        });
      }

      void voiceDraft.startRecording();
    }, 0);
  }

  useEffect(() => {
    const handleRetryRequest = (event: Event) => {
      const detail = (event as CustomEvent<OptimisticThreadRetryPayload>).detail;

      if (!detail || detail.conversationId !== conversationId) {
        return;
      }

      enqueue({
        attachment: detail.attachment ?? null,
        attachmentLabel: detail.attachmentLabel ?? null,
        body: detail.body,
        clientId: detail.clientId,
        createdAt: detail.createdAt,
        kind:
          detail.kind === 'voice'
            ? 'voice'
            : detail.attachment
              ? 'attachment'
              : 'text',
        payload: {
          attachment: detail.attachment ?? null,
          kind:
            detail.kind === 'voice'
              ? 'voice'
              : detail.attachment
                ? 'attachment'
                : 'text',
          voiceDurationMs:
            detail.kind === 'voice' ? detail.voiceDurationMs ?? null : null,
        },
        replyToMessageId: detail.replyToMessageId ?? null,
        voiceDurationMs:
          detail.kind === 'voice' ? detail.voiceDurationMs ?? null : null,
      });
    };

    window.addEventListener(
      LOCAL_OPTIMISTIC_MESSAGE_RETRY_EVENT,
      handleRetryRequest as EventListener,
    );

    return () => {
      window.removeEventListener(
        LOCAL_OPTIMISTIC_MESSAGE_RETRY_EVENT,
        handleRetryRequest as EventListener,
      );
    };
  }, [conversationId, enqueue]);

  return (
    <form
      ref={formRef}
      className="stack composer-form"
      onSubmit={async (event) => {
        event.preventDefault();

        const form = event.currentTarget;
        const nextFormData = new FormData(form);
        const body = String(nextFormData.get('body') ?? '').trim();
        const attachmentEntry = nextFormData.get('attachment');
        const attachment =
          attachmentEntry instanceof File && attachmentEntry.size > 0
            ? attachmentEntry
            : null;

        if (!body && !attachment) {
          return;
        }

        setErrorMessage(null);
        enqueue({
          attachment,
          attachmentLabel: attachment?.name ?? (attachment ? t.chat.attachment : null),
          body,
          kind: attachment ? 'attachment' : 'text',
          payload: {
            attachment,
            kind: attachment ? 'attachment' : 'text',
            voiceDurationMs: null,
          },
          replyToMessageId: replyToMessageId ?? null,
        });

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
      }}
    >
      <input name="conversationId" type="hidden" value={conversationId} />
      {replyToMessageId ? (
        <input name="replyToMessageId" type="hidden" value={replyToMessageId} />
      ) : null}
      <ComposerVoiceDraftPanel
        captureState={voiceDraft.captureState}
        draft={voiceDraft.draft}
        elapsedMs={voiceDraft.elapsedMs}
        errorCode={voiceDraft.errorCode}
        language={language}
        onCancel={voiceDraft.cancelRecording}
        onRetry={voiceDraft.startRecording}
        onSend={() => {
          const draftFile = voiceDraft.buildDraftFile();

          if (!draftFile || !voiceDraft.draft) {
            return;
          }

          setErrorMessage(null);
          enqueue({
            attachment: draftFile,
            attachmentLabel: t.chat.voiceMessage,
            body: '',
            kind: 'voice',
            payload: {
              attachment: draftFile,
              kind: 'voice',
              voiceDurationMs: voiceDraft.draft.durationMs ?? null,
            },
            replyToMessageId: replyToMessageId ?? null,
            voiceDurationMs: voiceDraft.draft.durationMs ?? null,
          });
          voiceDraft.clearDraft();
          clearReplyTargetFromCurrentUrl();
        }}
        onStop={voiceDraft.stopRecording}
      />
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
            data-voice-entry-state={
              voiceEntryDisabledReason ??
              (voiceDraft.isSupported ? 'ready' : 'unsupported')
            }
            disabled={Boolean(voiceEntryDisabledReason)}
            title={
              voiceDraft.isSupported
                ? t.chat.microphone
                : t.chat.voiceRecorderUnavailable
            }
            type="button"
            onPointerUp={(event) => {
              if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
                return;
              }

              event.preventDefault();
              attemptVoiceEntry('pointer');
            }}
            onClick={() => {
              if (
                process.env.NEXT_PUBLIC_CHAT_DEBUG_VOICE === '1' &&
                typeof window !== 'undefined'
              ) {
                console.info('[voice-composer-button]', 'mic:tapped', {
                  captureState: voiceDraft.captureState,
                  conversationId,
                  disabledReason: voiceEntryDisabledReason,
                  isSupported: voiceDraft.isSupported,
                });
              }
              attemptVoiceEntry('click');
            }}
          >
            <span aria-hidden="true" className="composer-mic-icon" />
          </button>

          <button
            aria-label={t.chat.sendMessage}
            className="button composer-button composer-button-icon"
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
