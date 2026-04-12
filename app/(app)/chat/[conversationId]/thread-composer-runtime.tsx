'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getChatClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client';
import {
  DmReplyTargetSnippet,
  type ReplyTargetAttachmentKind,
} from './dm-reply-target-snippet';
import {
  DmThreadClientSubtree,
  DmThreadComposerFallback,
  type DmThreadClientDiagnostics,
} from './dm-thread-client-diagnostics';
import { EncryptedDmComposerForm } from './encrypted-dm-composer-form';
import { JumpToLatestButton } from './jump-to-latest-button';
import { PlaintextChatComposerForm } from './plaintext-chat-composer-form';
import { TypingIndicator } from './typing-indicator';
import {
  clearReplyTargetFromCurrentUrl,
  focusThreadComposer,
  subscribeToThreadLocalReplyTargetSelection,
  type ThreadLocalReplyTarget,
} from './thread-local-reply-target';

type MentionParticipant = {
  label: string;
  userId: string;
};

type ThreadComposerRuntimeProps = {
  accept: string;
  attachmentHelpText: string;
  attachmentMaxSizeBytes: number;
  attachmentMaxSizeLabel: string;
  conversationId: string;
  conversationKind: 'dm' | 'group';
  currentUserId: string;
  currentUserLabel: string;
  encryptedDmEnabled: boolean;
  initialReplyTarget: ThreadLocalReplyTarget | null;
  language: AppLanguage;
  latestVisibleMessageSeq: number | null;
  mentionParticipants: MentionParticipant[];
  mentionSuggestionsLabel: string;
  messagePlaceholder: string;
  recipientUserId: string | null;
  threadClientDiagnostics: DmThreadClientDiagnostics;
};

function getReplyTargetSenderLabel(input: {
  replyTarget: ThreadLocalReplyTarget;
  unknownUserLabel: string;
}) {
  if (input.replyTarget.deletedAt) {
    return null;
  }

  return input.replyTarget.senderLabel || input.unknownUserLabel;
}

export function ThreadComposerRuntime({
  accept,
  attachmentHelpText,
  attachmentMaxSizeBytes,
  attachmentMaxSizeLabel,
  conversationId,
  conversationKind,
  currentUserId,
  currentUserLabel,
  encryptedDmEnabled,
  initialReplyTarget,
  language,
  latestVisibleMessageSeq,
  mentionParticipants,
  mentionSuggestionsLabel,
  messagePlaceholder,
  recipientUserId,
  threadClientDiagnostics,
}: ThreadComposerRuntimeProps) {
  const t = getChatClientTranslations(language);
  const [activeReplyTarget, setActiveReplyTarget] =
    useState<ThreadLocalReplyTarget | null>(initialReplyTarget);

  useEffect(() => {
    setActiveReplyTarget(initialReplyTarget);
  }, [initialReplyTarget]);

  useEffect(() => {
    return subscribeToThreadLocalReplyTargetSelection((detail) => {
      if (detail.conversationId !== conversationId) {
        return;
      }

      setActiveReplyTarget(detail.target);

      if (detail.target) {
        window.requestAnimationFrame(() => {
          focusThreadComposer();
        });
      }
    });
  }, [conversationId]);

  const clearActiveReplyTarget = useCallback((shouldFocusComposer = false) => {
    setActiveReplyTarget(null);
    clearReplyTargetFromCurrentUrl();

    if (shouldFocusComposer) {
      window.requestAnimationFrame(() => {
        focusThreadComposer();
      });
    }
  }, []);

  const handleReplyTargetConsumed = useCallback(() => {
    setActiveReplyTarget(null);
  }, []);

  const activeReplyTargetAttachmentKind: ReplyTargetAttachmentKind =
    activeReplyTarget?.attachmentKind ?? null;
  const replyTargetSenderLabel = activeReplyTarget
    ? getReplyTargetSenderLabel({
        replyTarget: activeReplyTarget,
        unknownUserLabel: t.chat.unknownUser,
      })
    : null;

  return (
    <section className="stack composer-card" id="message-composer">
      <JumpToLatestButton
        label={t.chat.jumpToLatest}
        latestVisibleMessageSeq={latestVisibleMessageSeq}
        targetId="message-thread-scroll"
      />
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="typing-indicator"
        >
          <TypingIndicator
            conversationId={conversationId}
            currentUserId={currentUserId}
            language={language}
          />
        </DmThreadClientSubtree>
      ) : (
        <TypingIndicator
          conversationId={conversationId}
          currentUserId={currentUserId}
          language={language}
        />
      )}
      {activeReplyTarget ? (
        <div className="composer-reply-preview">
          <span aria-hidden="true" className="composer-reply-accent" />
          <div className="stack composer-reply-main">
            <div className="stack composer-reply-copy">
              <span className="composer-reply-label">{t.chat.replyingTo}</span>
              <span className="composer-reply-sender">
                {activeReplyTarget.deletedAt
                  ? t.chat.deletedMessage
                  : replyTargetSenderLabel}
              </span>
              <DmReplyTargetSnippet
                attachmentFallbackLabel={t.chat.attachment}
                audioFallbackLabel={t.chat.audio}
                body={activeReplyTarget.body}
                conversationId={conversationId}
                currentUserId={currentUserId}
                deletedFallbackLabel={t.chat.thisMessageWasDeleted}
                emptyFallbackLabel={t.chat.emptyMessage}
                encryptedFallbackLabel={t.chat.replyToEncryptedMessage}
                encryptedReferenceNote={t.chat.encryptedReplyInfo}
                fileFallbackLabel={t.chat.file}
                historicalEncryptedFallbackLabel={t.chat.olderEncryptedMessage}
                loadedFallbackLabel={t.chat.earlierMessage}
                messageId={activeReplyTarget.id}
                photoFallbackLabel={t.chat.photo}
                surface="composer-reply-preview"
                targetAttachmentKind={activeReplyTargetAttachmentKind}
                targetDeleted={Boolean(activeReplyTarget.deletedAt)}
                targetIsEncrypted={activeReplyTarget.isEncrypted}
                targetIsLoaded
                targetKind={activeReplyTarget.kind}
                targetMessageId={activeReplyTarget.id}
                voiceFallbackLabel={t.chat.voiceMessage}
              />
            </div>
          </div>
          <button
            aria-label={t.chat.cancel}
            className="composer-reply-dismiss"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              clearActiveReplyTarget(true);
            }}
            type="button"
          >
            <span aria-hidden="true" className="composer-reply-dismiss-glyph">
              ×
            </span>
            <span className="sr-only">{t.chat.cancel}</span>
          </button>
        </div>
      ) : null}
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          fallback={
            <DmThreadComposerFallback
              copy={t.chat.encryptionNeedsRefresh}
              reloadLabel={t.chat.reloadConversation}
            />
          }
          surface="encrypted-dm-composer-form"
        >
          <EncryptedDmComposerForm
            accept={accept}
            attachmentHelpText={attachmentHelpText}
            attachmentMaxSizeBytes={attachmentMaxSizeBytes}
            attachmentMaxSizeLabel={attachmentMaxSizeLabel}
            conversationId={conversationId}
            currentUserId={currentUserId}
            currentUserLabel={currentUserLabel}
            encryptedDmEnabled={encryptedDmEnabled}
            language={language}
            mentionParticipants={mentionParticipants}
            mentionSuggestionsLabel={mentionSuggestionsLabel}
            messagePlaceholder={messagePlaceholder}
            onReplyTargetConsumed={handleReplyTargetConsumed}
            recipientUserId={recipientUserId}
            replyToMessageId={activeReplyTarget?.id ?? null}
          />
        </DmThreadClientSubtree>
      ) : (
        <PlaintextChatComposerForm
          accept={accept}
          attachmentHelpText={attachmentHelpText}
          attachmentMaxSizeBytes={attachmentMaxSizeBytes}
          attachmentMaxSizeLabel={attachmentMaxSizeLabel}
          conversationId={conversationId}
          currentUserId={currentUserId}
          currentUserLabel={currentUserLabel}
          language={language}
          mentionParticipants={mentionParticipants}
          mentionSuggestionsLabel={mentionSuggestionsLabel}
          messagePlaceholder={messagePlaceholder}
          onReplyTargetConsumed={handleReplyTargetConsumed}
          replyToMessageId={activeReplyTarget?.id ?? null}
        />
      )}
    </section>
  );
}
