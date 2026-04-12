type BrokenThreadHistoryMessageLike = {
  body?: unknown;
  content_mode?: unknown;
  conversation_id?: unknown;
  id?: unknown;
  kind?: unknown;
  seq?: unknown;
};

type BrokenThreadHistoryAttachmentLike = {
  fileName?: unknown;
  id?: unknown;
  isAudio?: unknown;
  isVoiceMessage?: unknown;
  messageId?: unknown;
  mimeType?: unknown;
  objectPath?: unknown;
  signedUrl?: unknown;
  voicePlaybackVariants?: unknown;
};

type BrokenThreadHistoryAttachmentGroupLike = {
  attachments?: unknown;
  messageId?: unknown;
};

type BrokenThreadMessagePatchLike = {
  body?: unknown;
  deletedAt?: unknown;
  editedAt?: unknown;
  messageId?: unknown;
};

const BROKEN_THREAD_HISTORY_SAMPLE_LIMIT = 4;

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isBrokenThreadHistoryDiagnosticsEnabled() {
  return (
    process.env.CHAT_DEBUG_BROKEN_THREAD_HISTORY === '1' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_BROKEN_THREAD_HISTORY === '1'
  );
}

export function shouldLogBrokenThreadHistoryProof(
  conversationId?: string | null,
) {
  if (!isBrokenThreadHistoryDiagnosticsEnabled()) {
    return false;
  }

  const configuredTargetConversationId =
    process.env.CHAT_DEBUG_BROKEN_THREAD_HISTORY_CONVERSATION_ID?.trim() ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_BROKEN_THREAD_HISTORY_CONVERSATION_ID?.trim() ||
    '';

  if (!configuredTargetConversationId) {
    return true;
  }

  return normalizeOptionalString(conversationId) === configuredTargetConversationId;
}

export function logBrokenThreadHistoryProof(
  stage: string,
  input: {
    conversationId?: string | null;
    details?: Record<string, unknown>;
    level?: 'error' | 'info' | 'warn';
  },
) {
  if (!shouldLogBrokenThreadHistoryProof(input.conversationId ?? null)) {
    return;
  }

  const level = input.level ?? 'info';
  const payload = {
    ...(input.details ?? null),
    conversationId: normalizeOptionalString(input.conversationId),
  };

  console[level]('[broken-thread-history]', stage, payload);
}

function pushSample(samples: string[], value: string) {
  if (!value || samples.includes(value) || samples.length >= BROKEN_THREAD_HISTORY_SAMPLE_LIMIT) {
    return;
  }

  samples.push(value);
}

function incrementRecordCount(
  record: Record<string, number>,
  key: string,
) {
  record[key] = (record[key] ?? 0) + 1;
}

function hasUsableVoiceVariant(
  variants: unknown,
) {
  if (!Array.isArray(variants)) {
    return false;
  }

  return variants.some((variant) => {
    if (!variant || typeof variant !== 'object') {
      return false;
    }

    const candidate = variant as Record<string, unknown>;
    const sourceKind = normalizeOptionalString(candidate.sourceKind);
    const signedUrl = normalizeOptionalString(candidate.signedUrl);
    const variantId = normalizeOptionalString(candidate.id);

    return Boolean(sourceKind || signedUrl || variantId);
  });
}

export function summarizeBrokenThreadHistorySnapshot(input: {
  attachmentsByMessage: BrokenThreadHistoryAttachmentGroupLike[];
  conversationId?: string | null;
  messages: BrokenThreadHistoryMessageLike[];
}) {
  const normalizedConversationId = normalizeOptionalString(input.conversationId);
  const messageKinds: Record<string, number> = {};
  const malformedMessageIds: string[] = [];
  const malformedAttachmentIds: string[] = [];
  const mismatchedAttachmentIds: string[] = [];
  const voiceMessageIdsWithoutAttachment: string[] = [];
  const voiceMessageIdsWithoutSignedUrl: string[] = [];
  let invalidMessageShapeCount = 0;
  let invalidAttachmentShapeCount = 0;
  let invalidConversationMessageCount = 0;
  let invalidMessageSeqCount = 0;
  let totalAttachmentCount = 0;
  let totalVoiceAttachmentCount = 0;
  let totalVoiceAttachmentWithSignedUrlCount = 0;
  let totalVoiceAttachmentWithVariantCount = 0;
  let attachmentMessageMismatchCount = 0;

  const attachmentsByMessageId = new Map<
    string,
    BrokenThreadHistoryAttachmentLike[]
  >();

  for (const group of input.attachmentsByMessage) {
    const messageId = normalizeOptionalString(group.messageId);
    const attachments = Array.isArray(group.attachments)
      ? (group.attachments as BrokenThreadHistoryAttachmentLike[])
      : [];

    attachmentsByMessageId.set(messageId, attachments);
    totalAttachmentCount += attachments.length;

    for (const attachment of attachments) {
      const attachmentId = normalizeOptionalString(attachment.id);
      const attachmentMessageId = normalizeOptionalString(attachment.messageId);
      const attachmentFileName = normalizeOptionalString(attachment.fileName);
      const attachmentObjectPath = normalizeOptionalString(attachment.objectPath);
      const attachmentSignedUrl = normalizeOptionalString(attachment.signedUrl);
      const isVoiceMessage = attachment.isVoiceMessage === true;

      if (
        !attachmentId ||
        !attachmentFileName ||
        (!attachmentObjectPath && !attachmentSignedUrl)
      ) {
        invalidAttachmentShapeCount += 1;
        pushSample(
          malformedAttachmentIds,
          attachmentId || attachmentMessageId || attachmentFileName,
        );
      }

      if (attachmentMessageId && messageId && attachmentMessageId !== messageId) {
        attachmentMessageMismatchCount += 1;
        pushSample(
          mismatchedAttachmentIds,
          attachmentId || `${messageId}:${attachmentMessageId}`,
        );
      }

      if (isVoiceMessage) {
        totalVoiceAttachmentCount += 1;

        if (attachmentSignedUrl) {
          totalVoiceAttachmentWithSignedUrlCount += 1;
        }

        if (hasUsableVoiceVariant(attachment.voicePlaybackVariants)) {
          totalVoiceAttachmentWithVariantCount += 1;
        }
      }
    }
  }

  for (const message of input.messages) {
    const messageId = normalizeOptionalString(message.id);
    const messageKind = normalizeOptionalString(message.kind) || 'unknown';
    const messageConversationId = normalizeOptionalString(message.conversation_id);
    const messageSeq =
      typeof message.seq === 'number'
        ? message.seq
        : typeof message.seq === 'string'
          ? Number(message.seq)
          : Number.NaN;

    incrementRecordCount(messageKinds, messageKind);

    if (
      !messageId ||
      !messageKind ||
      (!Number.isFinite(messageSeq) && message.seq !== 0)
    ) {
      invalidMessageShapeCount += 1;
      pushSample(malformedMessageIds, messageId || messageKind);
    }

    if (
      normalizedConversationId &&
      messageConversationId &&
      messageConversationId !== normalizedConversationId
    ) {
      invalidConversationMessageCount += 1;
      pushSample(malformedMessageIds, messageId || messageConversationId);
    }

    if (!Number.isFinite(messageSeq)) {
      invalidMessageSeqCount += 1;
      pushSample(malformedMessageIds, messageId || String(message.seq ?? ''));
    }

    if (messageKind === 'voice') {
      const attachments = attachmentsByMessageId.get(messageId) ?? [];
      const voiceAttachments = attachments.filter(
        (attachment) =>
          attachment.isVoiceMessage === true || attachment.isAudio === true,
      );

      if (voiceAttachments.length === 0) {
        pushSample(voiceMessageIdsWithoutAttachment, messageId);
      }

      if (
        voiceAttachments.length > 0 &&
        !voiceAttachments.some((attachment) =>
          Boolean(normalizeOptionalString(attachment.signedUrl)),
        )
      ) {
        pushSample(voiceMessageIdsWithoutSignedUrl, messageId);
      }
    }
  }

  return {
    attachmentGroupCount: input.attachmentsByMessage.length,
    attachmentMessageMismatchCount,
    invalidAttachmentShapeCount,
    invalidConversationMessageCount,
    invalidMessageSeqCount,
    invalidMessageShapeCount,
    malformedAttachmentIds,
    malformedMessageIds,
    messageCount: input.messages.length,
    messageKinds,
    mismatchedAttachmentIds,
    totalAttachmentCount,
    totalVoiceAttachmentCount,
    totalVoiceAttachmentWithSignedUrlCount,
    totalVoiceAttachmentWithVariantCount,
    voiceMessageCount: messageKinds.voice ?? 0,
    voiceMessageIdsWithoutAttachment,
    voiceMessageIdsWithoutSignedUrl,
  };
}

export function summarizeBrokenThreadMessagePatches(
  patches: BrokenThreadMessagePatchLike[],
) {
  const invalidPatchMessageIds: string[] = [];
  let invalidPatchCount = 0;

  for (const patch of patches) {
    const messageId = normalizeOptionalString(patch.messageId);
    const bodyIsValid =
      patch.body === undefined ||
      patch.body === null ||
      typeof patch.body === 'string';
    const deletedAtIsValid =
      patch.deletedAt === undefined ||
      patch.deletedAt === null ||
      typeof patch.deletedAt === 'string';
    const editedAtIsValid =
      patch.editedAt === undefined ||
      patch.editedAt === null ||
      typeof patch.editedAt === 'string';

    if (!messageId || !bodyIsValid || !deletedAtIsValid || !editedAtIsValid) {
      invalidPatchCount += 1;
      pushSample(invalidPatchMessageIds, messageId || 'unknown');
    }
  }

  return {
    invalidPatchCount,
    invalidPatchMessageIds,
    patchCount: patches.length,
  };
}
