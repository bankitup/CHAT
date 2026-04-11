'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getDmThreadVisibleMessageState,
  subscribeToDmThreadVisibleMessages,
} from './dm-thread-visible-message-store';

export type ReplyTargetResolutionCode =
  | 'target-not-loaded'
  | 'target-deleted'
  | 'target-voice'
  | 'target-photo'
  | 'target-file'
  | 'target-audio'
  | 'target-attachment'
  | 'target-empty-body'
  | 'target-plain-body'
  | 'resolved-from-visible-plaintext'
  | 'temporary-loading'
  | 'missing-envelope'
  | 'policy-blocked-history'
  | 'same-user-new-device-history-gap'
  | 'device-retired-or-mismatched'
  | 'client-session-lookup-failed'
  | 'client-key-material-missing'
  | 'local-device-record-missing'
  | 'malformed-envelope'
  | 'decrypt-failed'
  | 'stale-cached-failure-state';

export type ReplyTargetAttachmentKind =
  | 'attachment'
  | 'audio'
  | 'file'
  | 'photo'
  | null;

type ReplyTargetAttachmentLike = {
  isAudio?: boolean | null;
  isImage?: boolean | null;
  isVoiceMessage?: boolean | null;
};

type DmReplyTargetSnippetProps = {
  body: unknown;
  conversationId: string;
  currentUserId: string;
  debugRequestId?: string | null;
  deletedFallbackLabel: string;
  emptyFallbackLabel: string;
  encryptedFallbackLabel: string;
  historicalEncryptedFallbackLabel?: string | null;
  encryptedReferenceNote?: string | null;
  loadedFallbackLabel: string;
  messageId: string;
  surface: 'composer-reply-preview' | 'message-reply-reference';
  attachmentFallbackLabel: string;
  audioFallbackLabel: string;
  fileFallbackLabel: string;
  photoFallbackLabel: string;
  targetDeleted: boolean;
  targetAttachmentKind?: ReplyTargetAttachmentKind;
  targetIsEncrypted: boolean;
  targetIsLoaded: boolean;
  targetKind: string | null;
  targetMessageId: string;
  voiceFallbackLabel: string;
};

export function resolveReplyTargetAttachmentKind(
  attachments: ReplyTargetAttachmentLike[] | null | undefined,
): ReplyTargetAttachmentKind {
  const normalizedAttachments = attachments ?? [];

  if (normalizedAttachments.length === 0) {
    return null;
  }

  if (normalizedAttachments.some((attachment) => attachment?.isImage)) {
    return 'photo';
  }

  if (
    normalizedAttachments.some(
      (attachment) => attachment?.isAudio && !attachment?.isVoiceMessage,
    )
  ) {
    return 'audio';
  }

  if (normalizedAttachments.length > 0) {
    return 'file';
  }

  return 'attachment';
}

function isDiagnosticsEnabled() {
  return process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1';
}

function normalizeBodySnippet(value: unknown, maxLength = 90) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, ' ');

  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function logReplyTargetResolution(
  stage: string,
  details: Record<string, unknown>,
) {
  if (!isDiagnosticsEnabled() || typeof window === 'undefined') {
    return;
  }

  console.info('[chat-reply-target]', stage, details);
}

function isHistoricalEncryptedReplyTargetDiagnostic(
  code: ReplyTargetResolutionCode | null,
) {
  return (
    code === 'missing-envelope' ||
    code === 'policy-blocked-history' ||
    code === 'same-user-new-device-history-gap' ||
    code === 'device-retired-or-mismatched' ||
    code === 'client-key-material-missing' ||
    code === 'local-device-record-missing'
  );
}

export function DmReplyTargetSnippet({
  body,
  conversationId,
  currentUserId,
  debugRequestId = null,
  deletedFallbackLabel,
  emptyFallbackLabel,
  encryptedFallbackLabel,
  historicalEncryptedFallbackLabel = null,
  encryptedReferenceNote = null,
  loadedFallbackLabel,
  messageId,
  surface,
  attachmentFallbackLabel,
  audioFallbackLabel,
  fileFallbackLabel,
  photoFallbackLabel,
  targetDeleted,
  targetAttachmentKind = null,
  targetIsEncrypted,
  targetIsLoaded,
  targetKind,
  targetMessageId,
  voiceFallbackLabel,
}: DmReplyTargetSnippetProps) {
  const visibleMessageState = useSyncExternalStore(
    subscribeToDmThreadVisibleMessages,
    () => getDmThreadVisibleMessageState(conversationId, targetMessageId),
    () => ({ diagnosticCode: null, plaintextSnippet: null }),
  );

  const resolution = useMemo(() => {
    if (!targetIsLoaded) {
      return {
        diagnosticCode: 'target-not-loaded' as const,
        note: null,
        text: loadedFallbackLabel,
      };
    }

    if (targetDeleted) {
      return {
        diagnosticCode: 'target-deleted' as const,
        note: null,
        text: deletedFallbackLabel,
      };
    }

    if (targetKind === 'voice') {
      return {
        diagnosticCode: 'target-voice' as const,
        note: null,
        text: voiceFallbackLabel,
      };
    }

    if (targetKind === 'attachment') {
      if (targetAttachmentKind === 'photo') {
        return {
          diagnosticCode: 'target-photo' as const,
          note: null,
          text: photoFallbackLabel,
        };
      }

      if (targetAttachmentKind === 'audio') {
        return {
          diagnosticCode: 'target-audio' as const,
          note: null,
          text: audioFallbackLabel,
        };
      }

      if (targetAttachmentKind === 'file') {
        return {
          diagnosticCode: 'target-file' as const,
          note: null,
          text: fileFallbackLabel,
        };
      }

      return {
        diagnosticCode: 'target-attachment' as const,
        note: null,
        text: attachmentFallbackLabel,
      };
    }

    if (targetIsEncrypted) {
      if (visibleMessageState.plaintextSnippet) {
        return {
          diagnosticCode: 'resolved-from-visible-plaintext' as const,
          note: null,
          text: visibleMessageState.plaintextSnippet,
        };
      }

      return {
        diagnosticCode: (
          visibleMessageState.diagnosticCode ?? 'temporary-loading'
        ) as ReplyTargetResolutionCode,
        note: visibleMessageState.diagnosticCode,
        text: isHistoricalEncryptedReplyTargetDiagnostic(
          (visibleMessageState.diagnosticCode ??
            'temporary-loading') as ReplyTargetResolutionCode,
        )
          ? historicalEncryptedFallbackLabel ?? encryptedFallbackLabel
          : encryptedFallbackLabel,
      };
    }

    const normalizedBody = normalizeBodySnippet(body);

    if (!normalizedBody) {
      return {
        diagnosticCode: 'target-empty-body' as const,
        note: null,
        text: emptyFallbackLabel,
      };
    }

    return {
      diagnosticCode: 'target-plain-body' as const,
      note: null,
      text: normalizedBody,
    };
  }, [
    body,
    attachmentFallbackLabel,
    audioFallbackLabel,
    deletedFallbackLabel,
    emptyFallbackLabel,
    encryptedFallbackLabel,
    fileFallbackLabel,
    historicalEncryptedFallbackLabel,
    loadedFallbackLabel,
    photoFallbackLabel,
    targetDeleted,
    targetAttachmentKind,
    targetIsEncrypted,
    targetIsLoaded,
    targetKind,
    visibleMessageState.diagnosticCode,
    visibleMessageState.plaintextSnippet,
    voiceFallbackLabel,
  ]);

  useEffect(() => {
    logReplyTargetResolution('resolve', {
      bodyType: body === null ? 'null' : typeof body,
      conversationId,
      currentUserId,
      debugRequestId,
      diagnosticCode: resolution.diagnosticCode,
      messageId,
      surface,
      targetIsEncrypted,
      targetIsLoaded,
      targetMessageId,
      visibleDiagnosticCode: visibleMessageState.diagnosticCode,
      usedVisiblePlaintext: Boolean(visibleMessageState.plaintextSnippet),
    });
  }, [
    body,
    conversationId,
    currentUserId,
    debugRequestId,
    messageId,
    resolution.diagnosticCode,
    surface,
    targetIsEncrypted,
    targetIsLoaded,
    targetMessageId,
    visibleMessageState.diagnosticCode,
    visibleMessageState.plaintextSnippet,
  ]);

  return (
    <>
      <span
        className={
          surface === 'composer-reply-preview'
            ? 'composer-reply-snippet'
            : 'message-reply-snippet'
        }
        data-reply-target-diagnostic={
          isDiagnosticsEnabled() ? resolution.diagnosticCode : undefined
        }
      >
        {resolution.text}
      </span>
      {isDiagnosticsEnabled() && resolution.note ? (
        <span className="reply-target-debug-label">{resolution.note}</span>
      ) : null}
      {encryptedReferenceNote &&
      targetIsEncrypted &&
      resolution.diagnosticCode !== 'resolved-from-visible-plaintext' ? (
        <span className="composer-reply-note">{encryptedReferenceNote}</span>
      ) : null}
    </>
  );
}
