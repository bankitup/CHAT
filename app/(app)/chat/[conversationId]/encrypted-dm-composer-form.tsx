'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import type {
  DmE2eeApiErrorCode,
  DmE2eeApiErrorResponse,
  DmE2eeBootstrapDebugState,
  DmE2eeBootstrap400ReasonCode,
  DmE2eeBootstrapFailedValidationBranch,
  DmE2eeRecipientReadinessDebugState,
  DmE2eeRecipientBundleResponse,
  DmE2eeSendDebugState,
  DmE2eeSendRequest,
} from '@/modules/messaging/contract/dm-e2ee';
import {
  ensureDmE2eeDeviceRegistered,
  markLocalDmE2eeDeviceRegistrationStale,
} from '@/modules/messaging/e2ee/device-registration';
import { getLocalDmE2eeDeviceRecord } from '@/modules/messaging/e2ee/device-store';
import {
  hardResetDmE2eeStateForCurrentDevice,
  reinitializeLocalDmE2eeStateForUser,
} from '@/modules/messaging/e2ee/lifecycle';
import { encryptDmTextForRecipient } from '@/modules/messaging/e2ee/prekey-encrypt';
import { getEncryptedDmComposerErrorMessage } from '@/modules/messaging/e2ee/ui-policy';
import { broadcastMessageCommitted } from '@/modules/messaging/realtime/live-refresh';
import {
  LOCAL_OPTIMISTIC_MESSAGE_RETRY_EVENT,
  type OptimisticThreadRetryPayload,
} from '@/modules/messaging/realtime/optimistic-thread';
import { emitThreadHistorySyncRequest } from '@/modules/messaging/realtime/thread-history-sync-events';
import { ComposerAttachmentPicker } from './composer-attachment-picker';
import { ComposerTypingTextarea } from './composer-typing-textarea';
import { useConversationOutgoingQueue } from './use-conversation-outgoing-queue';

type MentionParticipant = {
  userId: string;
  label: string;
};

type EncryptedDmDebugFailureDetails = {
  exact400ReasonCode: DmE2eeBootstrap400ReasonCode | null;
  failedValidationBranch: DmE2eeBootstrapFailedValidationBranch | null;
  exactFailurePoint: string | null;
} & DmE2eeBootstrapDebugState &
  DmE2eeRecipientReadinessDebugState &
  DmE2eeSendDebugState;

type EncryptedDmComposerFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  accept: string;
  attachmentHelpText: string;
  attachmentMaxSizeBytes: number;
  attachmentMaxSizeLabel: string;
  conversationId: string;
  currentUserId: string;
  currentUserLabel: string;
  encryptedDmEnabled: boolean;
  language: AppLanguage;
  mentionParticipants?: MentionParticipant[];
  mentionSuggestionsLabel: string;
  messagePlaceholder: string;
  recipientUserId?: string | null;
  replyToMessageId?: string | null;
};

async function fetchRecipientBundle(
  conversationId: string,
  recipientUserId?: string | null,
) {
  const params = new URLSearchParams({ conversationId });

  if (recipientUserId?.trim()) {
    params.set('recipientUserId', recipientUserId.trim());
  }

  const response = await fetch(
    `/api/messaging/dm-e2ee/bundle?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    },
  );
  const payload = (await response.json()) as
    | DmE2eeRecipientBundleResponse
    | DmE2eeApiErrorResponse;

  if (!response.ok || !('recipient' in payload)) {
    const errorPayload = payload as DmE2eeApiErrorResponse;
    const error = new Error(
      errorPayload.error || 'Unable to load DM encryption material.',
    ) as Error &
      DmE2eeBootstrapDebugState &
      DmE2eeRecipientReadinessDebugState & {
        code?: DmE2eeApiErrorCode | null;
      };
    error.code = errorPayload.code ?? null;
    error.authRetireAttempted = errorPayload.authRetireAttempted ?? null;
    error.authRetireFailed = errorPayload.authRetireFailed ?? null;
    error.serviceRetireAvailable = errorPayload.serviceRetireAvailable ?? null;
    error.serviceRetireSkipReason = errorPayload.serviceRetireSkipReason ?? null;
    error.serviceRetireAttempted = errorPayload.serviceRetireAttempted ?? null;
    error.serviceRetireSucceeded = errorPayload.serviceRetireSucceeded ?? null;
    error.serviceRetireFailed = errorPayload.serviceRetireFailed ?? null;
    error.serviceRetireErrorMessage =
      errorPayload.serviceRetireErrorMessage ?? null;
    error.serviceRetireErrorCode = errorPayload.serviceRetireErrorCode ?? null;
    error.serviceRetireErrorStatus =
      errorPayload.serviceRetireErrorStatus ?? null;
    error.currentDeviceRowId = errorPayload.currentDeviceRowId ?? null;
    error.retireTargetIds = errorPayload.retireTargetIds ?? null;
    error.recipientBundleQueryStage =
      errorPayload.recipientBundleQueryStage ?? null;
    error.recipientConversationIdChecked =
      errorPayload.recipientConversationIdChecked ?? null;
    error.recipientRequestedUserId =
      errorPayload.recipientRequestedUserId ?? null;
    error.recipientUserIdChecked = errorPayload.recipientUserIdChecked ?? null;
    error.recipientDeviceRowsFound = errorPayload.recipientDeviceRowsFound ?? null;
    error.recipientActiveDeviceRowsFound =
      errorPayload.recipientActiveDeviceRowsFound ?? null;
    error.recipientSelectedDeviceRowId =
      errorPayload.recipientSelectedDeviceRowId ?? null;
    error.recipientSelectedDeviceLogicalId =
      errorPayload.recipientSelectedDeviceLogicalId ?? null;
    error.recipientSelectedDeviceRetiredAt =
      errorPayload.recipientSelectedDeviceRetiredAt ?? null;
    error.recipientSelectedDeviceIdentityKeyPresent =
      errorPayload.recipientSelectedDeviceIdentityKeyPresent ?? null;
    error.recipientSelectedDeviceSignedPrekeyPresent =
      errorPayload.recipientSelectedDeviceSignedPrekeyPresent ?? null;
    error.recipientSelectedDeviceSignaturePresent =
      errorPayload.recipientSelectedDeviceSignaturePresent ?? null;
    error.recipientSelectedDeviceAvailablePrekeyCount =
      errorPayload.recipientSelectedDeviceAvailablePrekeyCount ?? null;
    error.recipientPrekeyQueryDeviceRef =
      errorPayload.recipientPrekeyQueryDeviceRef ?? null;
    error.recipientBundleQueryErrorMessage =
      errorPayload.recipientBundleQueryErrorMessage ?? null;
    error.recipientBundleQueryErrorCode =
      errorPayload.recipientBundleQueryErrorCode ?? null;
    error.recipientBundleQueryErrorDetails =
      errorPayload.recipientBundleQueryErrorDetails ?? null;
    error.recipientMismatchLeft = errorPayload.recipientMismatchLeft ?? null;
    error.recipientMismatchRight = errorPayload.recipientMismatchRight ?? null;
    error.recipientReadinessFailedReason =
      errorPayload.recipientReadinessFailedReason ?? null;
    throw error;
  }

  return payload;
}

async function postEncryptedDmMessage(input: DmE2eeSendRequest) {
  const response = await fetch('/api/messaging/dm-e2ee/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as DmE2eeApiErrorResponse;

  if (!response.ok) {
    const error = new Error(
      payload.error || 'Unable to send encrypted message.',
    ) as Error &
      DmE2eeBootstrapDebugState &
      DmE2eeSendDebugState & {
      code?: DmE2eeApiErrorCode | null;
    };
    error.code = payload.code ?? null;
    error.authRetireAttempted = payload.authRetireAttempted ?? null;
    error.authRetireFailed = payload.authRetireFailed ?? null;
    error.serviceRetireAvailable = payload.serviceRetireAvailable ?? null;
    error.serviceRetireSkipReason = payload.serviceRetireSkipReason ?? null;
    error.serviceRetireAttempted = payload.serviceRetireAttempted ?? null;
    error.serviceRetireSucceeded = payload.serviceRetireSucceeded ?? null;
    error.serviceRetireFailed = payload.serviceRetireFailed ?? null;
    error.serviceRetireErrorMessage = payload.serviceRetireErrorMessage ?? null;
    error.serviceRetireErrorCode = payload.serviceRetireErrorCode ?? null;
    error.serviceRetireErrorStatus = payload.serviceRetireErrorStatus ?? null;
    error.currentDeviceRowId = payload.currentDeviceRowId ?? null;
    error.retireTargetIds = payload.retireTargetIds ?? null;
    error.sendExactFailureStage = payload.sendExactFailureStage ?? null;
    error.sendFailedOperation = payload.sendFailedOperation ?? null;
    error.sendReasonCode = payload.sendReasonCode ?? null;
    error.sendErrorMessage = payload.sendErrorMessage ?? null;
    error.sendErrorCode = payload.sendErrorCode ?? null;
    error.sendErrorDetails = payload.sendErrorDetails ?? null;
    error.sendErrorHint = payload.sendErrorHint ?? null;
    error.sendSelectedConversationId = payload.sendSelectedConversationId ?? null;
    error.sendSenderUserId = payload.sendSenderUserId ?? null;
    error.sendRecipientUserId = payload.sendRecipientUserId ?? null;
    error.sendSelectedSenderDeviceRowId =
      payload.sendSelectedSenderDeviceRowId ?? null;
    error.sendSelectedRecipientDeviceRowId =
      payload.sendSelectedRecipientDeviceRowId ?? null;
    throw error;
  }

  return payload as {
    clientId?: string | null;
    messageId?: string | null;
    timestamp?: string | null;
  };
}

async function resolveLocalRecordForEncryptedDm(
  userId: string,
  forcePublish = false,
) {
  const bootstrap = await ensureDmE2eeDeviceRegistered(userId, {
    forcePublish,
    triggerReason: 'composer-send',
  });

  if (bootstrap.status === 'unsupported') {
    throw new Error('dm_e2ee_unsupported_browser');
  }

  if (bootstrap.status === 'schema-missing') {
    const error = new Error('dm_e2ee_schema_missing') as Error & {
      code?: DmE2eeApiErrorCode | null;
    };
    error.code = 'dm_e2ee_schema_missing';
    throw error;
  }

  const localRecord = await getLocalDmE2eeDeviceRecord(userId);

  if (!localRecord?.serverDeviceRecordId) {
    if (
      process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' &&
      typeof window !== 'undefined'
    ) {
      console.info('[dm-e2ee-bootstrap-client]', 'local-record:stale-server-device-id', {
        failedValidationBranch: 'stale serverDeviceRecordId',
        hasLocalRecord: Boolean(localRecord),
        hasServerDeviceRecordId: Boolean(localRecord?.serverDeviceRecordId),
      });
    }
    const error = new Error('dm_e2ee_sender_device_stale') as Error & {
      code?: DmE2eeApiErrorCode | null;
      exact400ReasonCode?: DmE2eeBootstrap400ReasonCode | null;
      failedValidationBranch?: DmE2eeBootstrapFailedValidationBranch | null;
      exactFailurePoint?: string | null;
    } & DmE2eeBootstrapDebugState;
    error.code = 'dm_e2ee_sender_device_stale';
    error.exact400ReasonCode = null;
    error.failedValidationBranch = 'stale serverDeviceRecordId';
    error.exactFailurePoint = null;
    throw error;
  }

  return localRecord;
}

function getEncryptedDmDebugFailureDetails(
  error: unknown,
): EncryptedDmDebugFailureDetails | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const details = error as Error & EncryptedDmDebugFailureDetails;
  const exact400ReasonCode = details.exact400ReasonCode ?? null;
  const failedValidationBranch = details.failedValidationBranch ?? null;
  const exactFailurePoint = details.exactFailurePoint ?? null;
  const authRetireAttempted = details.authRetireAttempted ?? null;
  const authRetireFailed = details.authRetireFailed ?? null;
  const serviceRetireAvailable = details.serviceRetireAvailable ?? null;
  const serviceRetireSkipReason = details.serviceRetireSkipReason ?? null;
  const serviceRetireAttempted = details.serviceRetireAttempted ?? null;
  const serviceRetireSucceeded = details.serviceRetireSucceeded ?? null;
  const serviceRetireFailed = details.serviceRetireFailed ?? null;
  const serviceRetireErrorMessage = details.serviceRetireErrorMessage ?? null;
  const serviceRetireErrorCode = details.serviceRetireErrorCode ?? null;
  const serviceRetireErrorStatus = details.serviceRetireErrorStatus ?? null;
  const currentDeviceRowId = details.currentDeviceRowId ?? null;
  const retireTargetIds = details.retireTargetIds ?? null;
  const sendExactFailureStage = details.sendExactFailureStage ?? null;
  const sendFailedOperation = details.sendFailedOperation ?? null;
  const sendReasonCode = details.sendReasonCode ?? null;
  const sendErrorMessage = details.sendErrorMessage ?? null;
  const sendErrorCode = details.sendErrorCode ?? null;
  const sendErrorDetails = details.sendErrorDetails ?? null;
  const sendErrorHint = details.sendErrorHint ?? null;
  const sendSelectedConversationId = details.sendSelectedConversationId ?? null;
  const sendSenderUserId = details.sendSenderUserId ?? null;
  const sendRecipientUserId = details.sendRecipientUserId ?? null;
  const sendSelectedSenderDeviceRowId =
    details.sendSelectedSenderDeviceRowId ?? null;
  const sendSelectedRecipientDeviceRowId =
    details.sendSelectedRecipientDeviceRowId ?? null;
  const recipientBundleQueryStage = details.recipientBundleQueryStage ?? null;
  const recipientUserIdChecked = details.recipientUserIdChecked ?? null;
  const recipientDeviceRowsFound = details.recipientDeviceRowsFound ?? null;
  const recipientActiveDeviceRowsFound =
    details.recipientActiveDeviceRowsFound ?? null;
  const recipientSelectedDeviceRowId =
    details.recipientSelectedDeviceRowId ?? null;
  const recipientSelectedDeviceLogicalId =
    details.recipientSelectedDeviceLogicalId ?? null;
  const recipientSelectedDeviceRetiredAt =
    details.recipientSelectedDeviceRetiredAt ?? null;
  const recipientSelectedDeviceIdentityKeyPresent =
    details.recipientSelectedDeviceIdentityKeyPresent ?? null;
  const recipientSelectedDeviceSignedPrekeyPresent =
    details.recipientSelectedDeviceSignedPrekeyPresent ?? null;
  const recipientSelectedDeviceSignaturePresent =
    details.recipientSelectedDeviceSignaturePresent ?? null;
  const recipientSelectedDeviceAvailablePrekeyCount =
    details.recipientSelectedDeviceAvailablePrekeyCount ?? null;
  const recipientPrekeyQueryDeviceRef =
    details.recipientPrekeyQueryDeviceRef ?? null;
  const recipientBundleQueryErrorMessage =
    details.recipientBundleQueryErrorMessage ?? null;
  const recipientBundleQueryErrorCode =
    details.recipientBundleQueryErrorCode ?? null;
  const recipientBundleQueryErrorDetails =
    details.recipientBundleQueryErrorDetails ?? null;
  const recipientMismatchLeft = details.recipientMismatchLeft ?? null;
  const recipientMismatchRight = details.recipientMismatchRight ?? null;
  const recipientReadinessFailedReason =
    details.recipientReadinessFailedReason ?? null;

  if (
    !exact400ReasonCode &&
    !failedValidationBranch &&
    !exactFailurePoint &&
    authRetireAttempted === null &&
    authRetireFailed === null &&
    serviceRetireAvailable === null &&
    !serviceRetireSkipReason &&
    serviceRetireAttempted === null &&
    serviceRetireSucceeded === null &&
    serviceRetireFailed === null &&
    !serviceRetireErrorMessage &&
    !serviceRetireErrorCode &&
    !serviceRetireErrorStatus &&
    !currentDeviceRowId &&
    (!retireTargetIds || retireTargetIds.length === 0) &&
    !sendExactFailureStage &&
    !sendFailedOperation &&
    !sendReasonCode &&
    !sendErrorMessage &&
    !sendErrorCode &&
    !sendErrorDetails &&
    !sendErrorHint &&
    !sendSelectedConversationId &&
    !sendSenderUserId &&
    !sendRecipientUserId &&
    !sendSelectedSenderDeviceRowId &&
    !sendSelectedRecipientDeviceRowId &&
    !recipientBundleQueryStage &&
    !recipientUserIdChecked &&
    recipientDeviceRowsFound === null &&
    recipientActiveDeviceRowsFound === null &&
    !recipientSelectedDeviceRowId &&
    recipientSelectedDeviceLogicalId === null &&
    recipientSelectedDeviceRetiredAt === null &&
    recipientSelectedDeviceIdentityKeyPresent === null &&
    recipientSelectedDeviceSignedPrekeyPresent === null &&
    recipientSelectedDeviceSignaturePresent === null &&
    recipientSelectedDeviceAvailablePrekeyCount === null &&
    !recipientPrekeyQueryDeviceRef &&
    !recipientBundleQueryErrorMessage &&
    !recipientBundleQueryErrorCode &&
    !recipientBundleQueryErrorDetails &&
    !recipientMismatchLeft &&
    !recipientMismatchRight &&
    !recipientReadinessFailedReason
  ) {
    return null;
  }

  return {
    exact400ReasonCode,
    failedValidationBranch,
    exactFailurePoint,
    authRetireAttempted,
    authRetireFailed,
    serviceRetireAvailable,
    serviceRetireSkipReason,
    serviceRetireAttempted,
    serviceRetireSucceeded,
    serviceRetireFailed,
    serviceRetireErrorMessage,
    serviceRetireErrorCode,
    serviceRetireErrorStatus,
    currentDeviceRowId,
    retireTargetIds,
    sendExactFailureStage,
    sendFailedOperation,
    sendReasonCode,
    sendErrorMessage,
    sendErrorCode,
    sendErrorDetails,
    sendErrorHint,
    sendSelectedConversationId,
    sendSenderUserId,
    sendRecipientUserId,
    sendSelectedSenderDeviceRowId,
    sendSelectedRecipientDeviceRowId,
    recipientBundleQueryStage,
    recipientUserIdChecked,
    recipientDeviceRowsFound,
    recipientActiveDeviceRowsFound,
    recipientSelectedDeviceRowId,
    recipientSelectedDeviceLogicalId,
    recipientSelectedDeviceRetiredAt,
    recipientSelectedDeviceIdentityKeyPresent,
    recipientSelectedDeviceSignedPrekeyPresent,
    recipientSelectedDeviceSignaturePresent,
    recipientSelectedDeviceAvailablePrekeyCount,
    recipientPrekeyQueryDeviceRef,
    recipientBundleQueryErrorMessage,
    recipientBundleQueryErrorCode,
    recipientBundleQueryErrorDetails,
    recipientMismatchLeft,
    recipientMismatchRight,
    recipientReadinessFailedReason,
  };
}

function getEncryptedDmErrorMessage(
  error: unknown,
  t: ReturnType<typeof getTranslations>,
) {
  const code =
    error instanceof Error && 'code' in error
      ? ((error as { code?: DmE2eeApiErrorCode | null }).code ?? null)
      : null;

  if (error instanceof Error && error.message === 'dm_e2ee_unsupported_browser') {
    return t.chat.encryptionUnavailableHere;
  }

  return getEncryptedDmComposerErrorMessage({
    code,
    labels: {
      encryptionUnavailableHere: t.chat.encryptionUnavailableHere,
      encryptionSetupUnavailable: t.chat.encryptionSetupUnavailable,
      encryptionRolloutUnavailable: t.chat.encryptionRolloutUnavailable,
      encryptionNeedsRefresh: t.chat.encryptionNeedsRefresh,
      recipientEncryptionUnavailable: t.chat.recipientEncryptionUnavailable,
      encryptionSessionChanged: t.chat.encryptionSessionChanged,
      unableToSendEncryptedMessage: t.chat.unableToSendEncryptedMessage,
    },
  });
}

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

export function EncryptedDmComposerForm({
  action,
  accept,
  attachmentHelpText,
  attachmentMaxSizeBytes,
  attachmentMaxSizeLabel,
  conversationId,
  currentUserId,
  currentUserLabel,
  encryptedDmEnabled,
  language,
  mentionParticipants,
  mentionSuggestionsLabel,
  messagePlaceholder,
  recipientUserId,
  replyToMessageId,
}: EncryptedDmComposerFormProps) {
  const router = useRouter();
  const [, startNavigationTransition] = useTransition();
  const t = getTranslations(language);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<DmE2eeApiErrorCode | 'dm_e2ee_unsupported_browser' | null>(null);
  const [errorDebugDetails, setErrorDebugDetails] =
    useState<EncryptedDmDebugFailureDetails | null>(null);
  const [isRefreshingSetup, setIsRefreshingSetup] = useState(false);
  const [isResettingSetup, setIsResettingSetup] = useState(false);
  const showDevResetAction =
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1';
  const showDebugFailureUi =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1';
  const showDebugFailureDetails =
    showDebugFailureUi &&
    Boolean(
      errorDebugDetails?.exact400ReasonCode ||
        errorDebugDetails?.failedValidationBranch ||
        errorDebugDetails?.exactFailurePoint ||
        errorDebugDetails?.sendExactFailureStage ||
        errorDebugDetails?.sendFailedOperation ||
        errorDebugDetails?.sendReasonCode ||
        errorDebugDetails?.sendErrorMessage ||
        errorDebugDetails?.sendErrorCode ||
        errorDebugDetails?.sendErrorDetails ||
        errorDebugDetails?.sendErrorHint ||
        errorDebugDetails?.sendSelectedConversationId ||
        errorDebugDetails?.sendSenderUserId ||
        errorDebugDetails?.sendRecipientUserId ||
        errorDebugDetails?.sendSelectedSenderDeviceRowId ||
        errorDebugDetails?.sendSelectedRecipientDeviceRowId ||
        errorDebugDetails?.recipientReadinessFailedReason ||
        errorDebugDetails?.recipientBundleQueryStage ||
        errorDebugDetails?.recipientConversationIdChecked ||
        errorDebugDetails?.recipientRequestedUserId ||
        errorDebugDetails?.recipientUserIdChecked ||
        typeof errorDebugDetails?.recipientDeviceRowsFound === 'number' ||
        typeof errorDebugDetails?.recipientActiveDeviceRowsFound === 'number' ||
        errorDebugDetails?.recipientSelectedDeviceRowId ||
        typeof errorDebugDetails?.recipientSelectedDeviceLogicalId === 'number' ||
        typeof errorDebugDetails?.recipientSelectedDeviceIdentityKeyPresent ===
          'boolean' ||
        typeof errorDebugDetails?.recipientSelectedDeviceSignedPrekeyPresent ===
          'boolean' ||
        typeof errorDebugDetails?.recipientSelectedDeviceSignaturePresent ===
          'boolean' ||
        typeof errorDebugDetails?.recipientSelectedDeviceAvailablePrekeyCount ===
          'number' ||
        errorDebugDetails?.recipientPrekeyQueryDeviceRef ||
        errorDebugDetails?.recipientBundleQueryErrorMessage ||
        errorDebugDetails?.recipientBundleQueryErrorCode ||
        errorDebugDetails?.recipientBundleQueryErrorDetails ||
        errorDebugDetails?.recipientMismatchLeft ||
        errorDebugDetails?.recipientMismatchRight,
    );
  const { enqueue } = useConversationOutgoingQueue({
    conversationId,
    onItemFailed: ({ error }) => {
      const nextCode =
        error instanceof Error && 'code' in error
          ? ((error as { code?: DmE2eeApiErrorCode | null }).code ?? null)
          : error instanceof Error && error.message === 'dm_e2ee_unsupported_browser'
            ? 'dm_e2ee_unsupported_browser'
            : null;
      setErrorCode(nextCode);
      setErrorMessage(getEncryptedDmErrorMessage(error, t));
      setErrorDebugDetails(getEncryptedDmDebugFailureDetails(error));
    },
    onItemSent: () => {
      setErrorMessage(null);
      setErrorCode(null);
      setErrorDebugDetails(null);
    },
    processItem: async (item) => {
      let retriedAfterRepublish = false;
      let retriedAfterBundleRefresh = false;

      while (true) {
        try {
          const localRecord = await resolveLocalRecordForEncryptedDm(
            currentUserId,
            retriedAfterRepublish,
          );
          const recipientBundle = await fetchRecipientBundle(
            conversationId,
            recipientUserId,
          );
          const encryptedPayload = await encryptDmTextForRecipient({
            conversationId,
            clientId: item.clientId,
            plaintext: item.body,
            localRecord,
            recipientBundle,
          });

          const sendResult = await postEncryptedDmMessage({
            conversationId,
            clientId: item.clientId,
            replyToMessageId: item.replyToMessageId ?? null,
            senderDeviceRecordId: encryptedPayload.senderDeviceRecordId,
            kind: 'text',
            contentMode: 'dm_e2ee_v1',
            envelopes: encryptedPayload.envelopes,
          });

          if (
            process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' &&
            typeof window !== 'undefined'
          ) {
            console.info('[dm-e2ee-send-client]', 'send:committed', {
              clientId: item.clientId,
              committedMessageId: sendResult.messageId ?? null,
              conversationId,
              envelopeCount: encryptedPayload.envelopes.length,
              envelopeRecipientDeviceIds: encryptedPayload.envelopes.map(
                (envelope) => envelope.recipientDeviceRecordId,
              ),
              replyToMessageId: item.replyToMessageId ?? null,
              senderDeviceRecordId: encryptedPayload.senderDeviceRecordId,
            });
          }

          await broadcastMessageCommitted(`chat-sync:${conversationId}`, {
            clientId: item.clientId,
            conversationId,
            messageId: sendResult.messageId ?? null,
            source: 'encrypted-dm-send',
          });

          if (sendResult.messageId) {
            emitThreadHistorySyncRequest({
              conversationId,
              messageIds: [sendResult.messageId],
              reason: 'local-encrypted-send',
            });
          }

          return;
        } catch (error) {
          const code =
            error instanceof Error && 'code' in error
              ? ((error as { code?: DmE2eeApiErrorCode | null }).code ?? null)
              : null;

          if (code === 'dm_e2ee_sender_device_stale' && !retriedAfterRepublish) {
            retriedAfterRepublish = true;
            await markLocalDmE2eeDeviceRegistrationStale(currentUserId);
            continue;
          }

          if (code === 'dm_e2ee_prekey_conflict' && !retriedAfterBundleRefresh) {
            retriedAfterBundleRefresh = true;
            continue;
          }

          throw error;
        }
      }
    },
    resolveErrorMessage: (error) => getEncryptedDmErrorMessage(error, t),
  });

  useEffect(() => {
    const handleRetryRequest = (event: Event) => {
      const detail = (event as CustomEvent<OptimisticThreadRetryPayload>).detail;

      if (!detail || detail.conversationId !== conversationId) {
        return;
      }
      setErrorMessage(null);
      setErrorCode(null);
      setErrorDebugDetails(null);
      enqueue({
        attachmentLabel: detail.attachmentLabel ?? null,
        body: detail.body,
        clientId: detail.clientId,
        createdAt: detail.createdAt,
        payload: null,
        replyToMessageId: detail.replyToMessageId ?? null,
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
      action={action}
      className="stack composer-form"
      onSubmit={async (event) => {
        const form = event.currentTarget;
        const formData = new FormData(form);
        const body = String(formData.get('body') ?? '').trim();
        const attachmentEntry = formData.get('attachment');
        const attachment =
          attachmentEntry instanceof File && attachmentEntry.size > 0
            ? attachmentEntry
            : null;

        if (body && !encryptedDmEnabled) {
          event.preventDefault();
          setErrorMessage(t.chat.encryptionRolloutUnavailable);
          setErrorCode('dm_e2ee_rollout_disabled');
          setErrorDebugDetails(null);
          return;
        }

        if (!body || attachment) {
          if (body && attachment) {
            event.preventDefault();
            setErrorMessage(t.chat.encryptedAttachmentsUnsupported);
            setErrorCode(null);
            setErrorDebugDetails(null);
          } else {
            setErrorMessage(null);
            setErrorCode(null);
            setErrorDebugDetails(null);
          }

          return;
        }

        event.preventDefault();
        setErrorMessage(null);
        setErrorCode(null);
        setErrorDebugDetails(null);

        form.reset();
        window.requestAnimationFrame(() => {
          const textarea = form.querySelector<HTMLTextAreaElement>('textarea[name="body"]');

          if (!textarea) {
            return;
          }

          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        });
        enqueue({
          body,
          payload: null,
          replyToMessageId: replyToMessageId ?? null,
        });
        clearReplyTargetFromCurrentUrl();
      }}
    >
      <input name="conversationId" type="hidden" value={conversationId} />
      {replyToMessageId ? (
        <input name="replyToMessageId" type="hidden" value={replyToMessageId} />
      ) : null}
      <div className="composer-input-shell">
        <ComposerAttachmentPicker
          accept={accept}
          helperText={attachmentHelpText}
          maxSizeBytes={attachmentMaxSizeBytes}
          maxSizeLabel={attachmentMaxSizeLabel}
          language={language}
        />

        <label className="field composer-input-field">
          <span className="sr-only">{messagePlaceholder}</span>
          <ComposerTypingTextarea
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
            type="submit"
          >
            <span aria-hidden="true">➤</span>
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="composer-encryption-status composer-encryption-status-error">
          <p className="attachment-helper attachment-helper-error">{errorMessage}</p>
          {showDebugFailureDetails ? (
            <div className="composer-debug-details" role="note">
              {errorDebugDetails?.exact400ReasonCode ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>exact400ReasonCode:</strong>{' '}
                  <code>{errorDebugDetails.exact400ReasonCode}</code>
                </p>
              ) : null}
              {errorDebugDetails?.failedValidationBranch ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>failedValidationBranch:</strong>{' '}
                  <code>{errorDebugDetails.failedValidationBranch}</code>
                </p>
              ) : null}
              {errorDebugDetails?.exactFailurePoint ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>exactFailurePoint:</strong>{' '}
                  <code>{errorDebugDetails.exactFailurePoint}</code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.authRetireAttempted === 'boolean' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>auth_retire_attempted:</strong>{' '}
                  <code>{String(errorDebugDetails.authRetireAttempted)}</code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.authRetireFailed === 'boolean' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>auth_retire_failed:</strong>{' '}
                  <code>{String(errorDebugDetails.authRetireFailed)}</code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.serviceRetireAvailable === 'boolean' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>service_retire_available:</strong>{' '}
                  <code>{String(errorDebugDetails.serviceRetireAvailable)}</code>
                </p>
              ) : null}
              {errorDebugDetails?.serviceRetireSkipReason ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>service_retire_skip_reason:</strong>{' '}
                  <code>{errorDebugDetails.serviceRetireSkipReason}</code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.serviceRetireAttempted === 'boolean' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>service_retire_attempted:</strong>{' '}
                  <code>{String(errorDebugDetails.serviceRetireAttempted)}</code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.serviceRetireSucceeded === 'boolean' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>service_retire_succeeded:</strong>{' '}
                  <code>{String(errorDebugDetails.serviceRetireSucceeded)}</code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.serviceRetireFailed === 'boolean' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>service_retire_failed:</strong>{' '}
                  <code>{String(errorDebugDetails.serviceRetireFailed)}</code>
                </p>
              ) : null}
              {errorDebugDetails?.serviceRetireErrorMessage ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>service_retire_error_message:</strong>{' '}
                  <code>{errorDebugDetails.serviceRetireErrorMessage}</code>
                </p>
              ) : null}
              {errorDebugDetails?.serviceRetireErrorCode ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>service_retire_error_code:</strong>{' '}
                  <code>{errorDebugDetails.serviceRetireErrorCode}</code>
                </p>
              ) : null}
              {errorDebugDetails?.serviceRetireErrorStatus ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>service_retire_error_status:</strong>{' '}
                  <code>{errorDebugDetails.serviceRetireErrorStatus}</code>
                </p>
              ) : null}
              {errorDebugDetails?.currentDeviceRowId ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>current_device_row_id:</strong>{' '}
                  <code>{errorDebugDetails.currentDeviceRowId}</code>
                </p>
              ) : null}
              {errorDebugDetails?.retireTargetIds?.length ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>retire_target_ids:</strong>{' '}
                  <code>{errorDebugDetails.retireTargetIds.join(', ')}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendExactFailureStage ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_exact_failure_stage:</strong>{' '}
                  <code>{errorDebugDetails.sendExactFailureStage}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendFailedOperation ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_failed_operation:</strong>{' '}
                  <code>{errorDebugDetails.sendFailedOperation}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendReasonCode ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_reason_code:</strong>{' '}
                  <code>{errorDebugDetails.sendReasonCode}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendErrorMessage ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_error_message:</strong>{' '}
                  <code>{errorDebugDetails.sendErrorMessage}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendErrorCode ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_error_code:</strong>{' '}
                  <code>{errorDebugDetails.sendErrorCode}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendErrorDetails ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_error_details:</strong>{' '}
                  <code>{errorDebugDetails.sendErrorDetails}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendErrorHint ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_error_hint:</strong>{' '}
                  <code>{errorDebugDetails.sendErrorHint}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendSelectedConversationId ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_selected_conversation_id:</strong>{' '}
                  <code>{errorDebugDetails.sendSelectedConversationId}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendSenderUserId ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_sender_user_id:</strong>{' '}
                  <code>{errorDebugDetails.sendSenderUserId}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendRecipientUserId ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_recipient_user_id:</strong>{' '}
                  <code>{errorDebugDetails.sendRecipientUserId}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendSelectedSenderDeviceRowId ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_selected_sender_device_row_id:</strong>{' '}
                  <code>{errorDebugDetails.sendSelectedSenderDeviceRowId}</code>
                </p>
              ) : null}
              {errorDebugDetails?.sendSelectedRecipientDeviceRowId ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>send_selected_recipient_device_row_id:</strong>{' '}
                  <code>{errorDebugDetails.sendSelectedRecipientDeviceRowId}</code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientBundleQueryStage ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_bundle_query_stage:</strong>{' '}
                  <code>{errorDebugDetails.recipientBundleQueryStage}</code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientUserIdChecked ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_user_id_checked:</strong>{' '}
                  <code>{errorDebugDetails.recipientUserIdChecked}</code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.recipientDeviceRowsFound === 'number' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_device_rows_found:</strong>{' '}
                  <code>{String(errorDebugDetails.recipientDeviceRowsFound)}</code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.recipientActiveDeviceRowsFound === 'number' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_active_device_rows_found:</strong>{' '}
                  <code>
                    {String(errorDebugDetails.recipientActiveDeviceRowsFound)}
                  </code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientSelectedDeviceRowId ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_selected_device_row_id:</strong>{' '}
                  <code>{errorDebugDetails.recipientSelectedDeviceRowId}</code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.recipientSelectedDeviceLogicalId === 'number' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_selected_device_logical_id:</strong>{' '}
                  <code>
                    {String(errorDebugDetails.recipientSelectedDeviceLogicalId)}
                  </code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientSelectedDeviceRetiredAt ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_selected_device_retired_at:</strong>{' '}
                  <code>{errorDebugDetails.recipientSelectedDeviceRetiredAt}</code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.recipientSelectedDeviceIdentityKeyPresent ===
              'boolean' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_selected_device_identity_key_present:</strong>{' '}
                  <code>
                    {String(
                      errorDebugDetails.recipientSelectedDeviceIdentityKeyPresent,
                    )}
                  </code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.recipientSelectedDeviceSignedPrekeyPresent ===
              'boolean' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_selected_device_signed_prekey_present:</strong>{' '}
                  <code>
                    {String(
                      errorDebugDetails.recipientSelectedDeviceSignedPrekeyPresent,
                    )}
                  </code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.recipientSelectedDeviceSignaturePresent ===
              'boolean' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_selected_device_signature_present:</strong>{' '}
                  <code>
                    {String(
                      errorDebugDetails.recipientSelectedDeviceSignaturePresent,
                    )}
                  </code>
                </p>
              ) : null}
              {typeof errorDebugDetails?.recipientSelectedDeviceAvailablePrekeyCount ===
              'number' ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_selected_device_available_prekey_count:</strong>{' '}
                  <code>
                    {String(
                      errorDebugDetails.recipientSelectedDeviceAvailablePrekeyCount,
                    )}
                  </code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientPrekeyQueryDeviceRef ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_prekey_query_device_ref:</strong>{' '}
                  <code>{errorDebugDetails.recipientPrekeyQueryDeviceRef}</code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientBundleQueryErrorMessage ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_bundle_query_error_message:</strong>{' '}
                  <code>{errorDebugDetails.recipientBundleQueryErrorMessage}</code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientBundleQueryErrorCode ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_bundle_query_error_code:</strong>{' '}
                  <code>{errorDebugDetails.recipientBundleQueryErrorCode}</code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientBundleQueryErrorDetails ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_bundle_query_error_details:</strong>{' '}
                  <code>{errorDebugDetails.recipientBundleQueryErrorDetails}</code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientMismatchLeft ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_mismatch_left:</strong>{' '}
                  <code>{errorDebugDetails.recipientMismatchLeft}</code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientMismatchRight ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_mismatch_right:</strong>{' '}
                  <code>{errorDebugDetails.recipientMismatchRight}</code>
                </p>
              ) : null}
              {errorDebugDetails?.recipientReadinessFailedReason ? (
                <p className="attachment-helper composer-debug-line">
                  <strong>recipient_readiness_failed_reason:</strong>{' '}
                  <code>{errorDebugDetails.recipientReadinessFailedReason}</code>
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="composer-encryption-actions">
            {errorCode === 'dm_e2ee_prekey_conflict' ? (
              <p className="attachment-helper composer-debug-line">
                {t.chat.retryEncryptedAction}
              </p>
            ) : null}
            {(errorCode === 'dm_e2ee_sender_device_stale' ||
              errorCode === 'dm_e2ee_local_state_incomplete') ? (
              <button
                className="button button-secondary button-compact composer-recovery-button"
                disabled={isRefreshingSetup}
                onClick={async () => {
                  setIsRefreshingSetup(true);
                  try {
                    const bootstrap = await reinitializeLocalDmE2eeStateForUser(
                      currentUserId,
                    );

                    if (bootstrap.status === 'registered') {
                      setErrorMessage(null);
                      setErrorCode(null);
                      setErrorDebugDetails(null);
                    } else if (bootstrap.status === 'unsupported') {
                      setErrorMessage(t.chat.encryptionUnavailableHere);
                      setErrorCode('dm_e2ee_unsupported_browser');
                      setErrorDebugDetails(null);
                    } else {
                      setErrorMessage(t.chat.encryptionSetupUnavailable);
                      setErrorCode('dm_e2ee_schema_missing');
                      setErrorDebugDetails(null);
                    }
                  } catch (error) {
                    setErrorMessage(t.chat.encryptionNeedsRefresh);
                    setErrorCode('dm_e2ee_local_state_incomplete');
                    setErrorDebugDetails(getEncryptedDmDebugFailureDetails(error));
                  } finally {
                    setIsRefreshingSetup(false);
                  }
                }}
                type="button"
              >
                {t.chat.refreshEncryptedSetup}
              </button>
            ) : null}
            {showDevResetAction &&
            (errorCode === 'dm_e2ee_sender_device_stale' ||
              errorCode === 'dm_e2ee_local_state_incomplete') ? (
              <button
                className="button button-secondary button-compact composer-recovery-button"
                disabled={isResettingSetup}
                onClick={async () => {
                  setIsResettingSetup(true);
                  try {
                    // Temporary dev-only escape hatch for stale browser-local E2EE state.
                    const bootstrap =
                      await hardResetDmE2eeStateForCurrentDevice(
                        currentUserId,
                      );

                    if (bootstrap.status === 'registered') {
                      setErrorMessage(null);
                      setErrorCode(null);
                      setErrorDebugDetails(null);
                    } else if (bootstrap.status === 'unsupported') {
                      setErrorMessage(t.chat.encryptionUnavailableHere);
                      setErrorCode('dm_e2ee_unsupported_browser');
                      setErrorDebugDetails(null);
                    } else {
                      setErrorMessage(t.chat.encryptionSetupUnavailable);
                      setErrorCode('dm_e2ee_schema_missing');
                      setErrorDebugDetails(null);
                    }
                  } catch (error) {
                    setErrorMessage(t.chat.encryptionNeedsRefresh);
                    setErrorCode('dm_e2ee_local_state_incomplete');
                    setErrorDebugDetails(getEncryptedDmDebugFailureDetails(error));
                  } finally {
                    setIsResettingSetup(false);
                  }
                }}
                type="button"
              >
                {t.chat.resetEncryptedSetupDev}
              </button>
            ) : null}
            <button
              className="button button-secondary button-compact composer-recovery-button"
              disabled={isRefreshingSetup || isResettingSetup}
              onClick={() => {
                setErrorMessage(null);
                setErrorCode(null);
                setErrorDebugDetails(null);
                startNavigationTransition(() => {
                  router.refresh();
                });
              }}
              type="button"
            >
              {t.chat.reloadConversation}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
