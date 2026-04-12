'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import {
  getChatClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client-chat';
import { configureInlineAudioElement } from './voice-playback-source';
import type {
  ConversationMessageRow,
  MessageAttachment,
} from './thread-history-types';

const ThreadInlineEditForm = dynamic(() =>
  import('./thread-inline-edit-form').then((mod) => mod.ThreadInlineEditForm),
);

function ThreadVoiceMessageBubbleLoadingFallback() {
  return (
    <div
      aria-hidden="true"
      className="message-voice-card message-voice-card-loading"
      data-message-voice-interactive="false"
    >
      <span className="message-voice-loading-play" />
      <div className="message-voice-copy">
        <div className="message-voice-head">
          <span className="message-voice-loading-line message-voice-loading-line-title" />
          <span className="message-voice-loading-line message-voice-loading-line-duration" />
        </div>
        <div className="message-voice-progress message-voice-progress-loading-shell">
          <span className="message-voice-progress-bar message-voice-progress-bar-loading" />
        </div>
      </div>
    </div>
  );
}

const MemoizedThreadVoiceMessageBubble = dynamic(
  () =>
    import('./thread-voice-message-bubble').then(
      (mod) => mod.MemoizedThreadVoiceMessageBubble,
    ),
  {
    loading: ThreadVoiceMessageBubbleLoadingFallback,
  },
);

type ThreadMessageRowContentProps = {
  bubbleClassName: string;
  canInlineMessageMeta: boolean;
  conversationId: string;
  editCancelHref: string;
  emptyMessageLabel: string;
  encryptedEditCancelHref: string;
  encryptedEditUnavailableLabel: string;
  encryptedMessageBodyContent: ReactNode | null;
  imagePreviewCaption: string | null;
  inlineEditInitialBody: string;
  inlineEditLabels: {
    cancel: string;
    save: string;
  };
  isDeletedMessage: boolean;
  isEncryptedEditFallback: boolean;
  isMessageInEditMode: boolean;
  isOwnMessage: boolean;
  language: AppLanguage;
  message: ConversationMessageRow;
  messageAttachments: MessageAttachment[];
  messageDeletedLabel: string;
  messageMetaContent: ReactNode;
  nonVoiceAttachments: MessageAttachment[];
  normalizedMessageBody: string | null;
  onImagePreviewClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onRequestQuickActions: () => void;
  primaryVoiceAttachment: MessageAttachment | null;
  replyReferenceContent: ReactNode;
  shouldRenderEncryptedAttachmentComposite: boolean;
};

function normalizeAttachmentSignedUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function formatAttachmentSize(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function normalizeAttachmentDisplayName(
  value: string | null | undefined,
  fallback: string,
) {
  const trimmed = value?.trim() || '';
  return trimmed || fallback;
}

function getRenderableAttachmentKey(
  attachment: MessageAttachment,
  index: number,
) {
  const attachmentId =
    typeof attachment.id === 'string' ? attachment.id.trim() : '';

  if (attachmentId) {
    return attachmentId;
  }

  const fallbackKey = [
    typeof attachment.messageId === 'string' ? attachment.messageId.trim() : '',
    typeof attachment.objectPath === 'string' ? attachment.objectPath.trim() : '',
    typeof attachment.fileName === 'string' ? attachment.fileName.trim() : '',
    typeof attachment.createdAt === 'string' ? attachment.createdAt.trim() : '',
    String(index),
  ]
    .filter(Boolean)
    .join(':');

  return fallbackKey || `attachment-${index}`;
}

function ThreadMessageAttachments({
  attachments,
  imagePreviewCaption,
  language,
  onImagePreviewClick,
}: {
  attachments: MessageAttachment[];
  imagePreviewCaption: string | null;
  language: AppLanguage;
  onImagePreviewClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const t = getChatClientTranslations(language);

  if (!attachments.length) {
    return null;
  }

  return (
    <div className="message-attachments">
      {attachments.map((attachment, index) => {
        const attachmentKey = getRenderableAttachmentKey(attachment, index);
        const attachmentSignedUrl = normalizeAttachmentSignedUrl(
          attachment.signedUrl,
        );

        if (attachment.isImage) {
          const previewAccessibleLabel = imagePreviewCaption ?? t.chat.photo;

          if (!attachmentSignedUrl) {
            return (
              <div
                key={attachmentKey}
                className="message-photo-card message-photo-card-committed message-photo-card-unavailable"
              >
                <span
                  aria-hidden="true"
                  className="message-photo-card-visual message-photo-card-visual-unavailable"
                />
              </div>
            );
          }

          return (
            <button
              key={attachmentKey}
              aria-haspopup="dialog"
              aria-label={t.chat.openPhotoPreviewAria(previewAccessibleLabel)}
              className="message-photo-card message-photo-card-committed message-photo-card-button"
              data-message-image-preview="true"
              data-preview-caption={imagePreviewCaption ?? ''}
              data-preview-url={attachmentSignedUrl}
              onClick={onImagePreviewClick}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={previewAccessibleLabel}
                className="message-photo-card-image"
                loading="lazy"
                src={attachmentSignedUrl}
              />
            </button>
          );
        }

        const attachmentLabel = attachment.isVoiceMessage
          ? t.chat.voiceMessage
          : attachment.isAudio
            ? t.chat.audio
            : t.chat.file;
        const attachmentName = normalizeAttachmentDisplayName(
          attachment.fileName,
          attachmentLabel,
        );
        const attachmentMeta = [
          formatAttachmentSize(attachment.sizeBytes),
          !attachmentSignedUrl ? t.chat.unavailableRightNow : null,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' · ');
        const attachmentContent = (
          <>
            <span aria-hidden="true" className="message-attachment-file">
              {attachment.isAudio ? t.chat.audio : t.chat.file}
            </span>
            <span className="message-attachment-copy">
              <span className="message-attachment-head">
                <span className="message-attachment-name">{attachmentName}</span>
                <span className="message-attachment-kind">{attachmentLabel}</span>
              </span>
              {attachmentMeta ? (
                <span className="message-attachment-meta">{attachmentMeta}</span>
              ) : null}
            </span>
          </>
        );

        if (!attachmentSignedUrl) {
          return (
            <div
              key={attachmentKey}
              className="message-attachment-card message-attachment-card-unavailable"
            >
              {attachmentContent}
            </div>
          );
        }

        if (attachment.isAudio) {
          return (
            <div
              key={attachmentKey}
              className="message-attachment-card message-attachment-card-audio"
            >
              {attachmentContent}
              <audio
                className="message-attachment-audio"
                controls
                controlsList="nodownload noplaybackrate noremoteplayback"
                playsInline
                preload="metadata"
                ref={configureInlineAudioElement}
                src={attachmentSignedUrl}
              />
            </div>
          );
        }

        return (
          <a
            key={attachmentKey}
            className="message-attachment-card"
            href={attachmentSignedUrl}
            rel="noreferrer"
            target="_blank"
          >
            {attachmentContent}
          </a>
        );
      })}
    </div>
  );
}

export function ThreadMessageRowContent({
  bubbleClassName,
  canInlineMessageMeta,
  conversationId,
  editCancelHref,
  emptyMessageLabel,
  encryptedEditCancelHref,
  encryptedEditUnavailableLabel,
  encryptedMessageBodyContent,
  imagePreviewCaption,
  inlineEditInitialBody,
  inlineEditLabels,
  isDeletedMessage,
  isEncryptedEditFallback,
  isMessageInEditMode,
  isOwnMessage,
  language,
  message,
  messageAttachments,
  messageDeletedLabel,
  messageMetaContent,
  nonVoiceAttachments,
  normalizedMessageBody,
  onImagePreviewClick,
  onRequestQuickActions,
  primaryVoiceAttachment,
  replyReferenceContent,
  shouldRenderEncryptedAttachmentComposite,
}: ThreadMessageRowContentProps) {
  return (
    <div className={bubbleClassName}>
      {replyReferenceContent}
      {isDeletedMessage ? (
        <p className="message-deleted-text">{messageDeletedLabel}</p>
      ) : isMessageInEditMode ? (
        <ThreadInlineEditForm
          cancelHref={editCancelHref}
          conversationId={conversationId}
          emptyMessageLabel={emptyMessageLabel}
          hasAttachments={messageAttachments.length > 0}
          initialBody={inlineEditInitialBody}
          labels={inlineEditLabels}
          messageId={message.id}
        />
      ) : isEncryptedEditFallback ? (
        <div className="message-edit-unavailable">
          <p className="message-edit-unavailable-copy">
            {encryptedEditUnavailableLabel}
          </p>
          <div className="message-edit-actions">
            <Link
              className="pill message-edit-cancel"
              href={encryptedEditCancelHref}
              prefetch={false}
            >
              {inlineEditLabels.cancel}
            </Link>
          </div>
        </div>
      ) : shouldRenderEncryptedAttachmentComposite ? (
        <div className="message-attachment-caption-stack">
          <ThreadMessageAttachments
            attachments={nonVoiceAttachments}
            imagePreviewCaption={normalizedMessageBody}
            language={language}
            onImagePreviewClick={onImagePreviewClick}
          />
          {encryptedMessageBodyContent}
        </div>
      ) : encryptedMessageBodyContent ? (
        encryptedMessageBodyContent
      ) : message.kind === 'voice' ? (
        <div className="message-voice-stack">
          <MemoizedThreadVoiceMessageBubble
            attachment={primaryVoiceAttachment}
            conversationId={conversationId}
            isOwnMessage={isOwnMessage}
            language={language}
            messageId={message.id}
            onRequestQuickActions={onRequestQuickActions}
          />
          {normalizedMessageBody ? (
            <p className="message-body">{normalizedMessageBody}</p>
          ) : null}
        </div>
      ) : normalizedMessageBody ? (
        canInlineMessageMeta ? (
          <div
            className={
              isOwnMessage
                ? 'message-inline-content message-inline-content-own'
                : 'message-inline-content'
            }
          >
            <p className="message-body message-body-inline">
              {normalizedMessageBody}
            </p>
            <span
              className={
                isOwnMessage
                  ? 'message-meta message-meta-own message-meta-inline'
                  : 'message-meta message-meta-inline'
              }
            >
              {messageMetaContent}
            </span>
          </div>
        ) : (
          <p className="message-body">{normalizedMessageBody}</p>
        )
      ) : !messageAttachments.length ? (
        <p className="message-body">{emptyMessageLabel}</p>
      ) : null}
      {nonVoiceAttachments.length &&
      !isDeletedMessage &&
      !shouldRenderEncryptedAttachmentComposite ? (
        <ThreadMessageAttachments
          attachments={nonVoiceAttachments}
          imagePreviewCaption={imagePreviewCaption}
          language={language}
          onImagePreviewClick={onImagePreviewClick}
        />
      ) : null}
    </div>
  );
}
