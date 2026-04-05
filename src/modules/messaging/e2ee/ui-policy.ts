export type EncryptedDmFailureKind = 'device-setup' | 'unavailable';
export type EncryptedDmUnavailableNoteKind =
  | 'history-unavailable'
  | 'policy-blocked'
  | null;

export type EncryptedDmDiagnosticCode =
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

export type EncryptedDmServerHistoryHint = {
  code: 'envelope-present' | 'missing-envelope' | 'policy-blocked-history';
  activeDeviceRecordId: string | null;
  messageCreatedAt: string | null;
  viewerJoinedAt: string | null;
};

export function getEncryptedDmFailureKindForDiagnostic(
  diagnosticCode: EncryptedDmDiagnosticCode,
): EncryptedDmFailureKind {
  switch (diagnosticCode) {
    case 'client-session-lookup-failed':
    case 'client-key-material-missing':
    case 'local-device-record-missing':
      return 'device-setup';
    default:
      return 'unavailable';
  }
}

export function shouldOfferEncryptedDmRecoveryActions(
  diagnosticCode: EncryptedDmDiagnosticCode,
) {
  switch (diagnosticCode) {
    case 'client-session-lookup-failed':
    case 'client-key-material-missing':
    case 'local-device-record-missing':
      return true;
    default:
      return false;
  }
}

export function getEncryptedDmUnavailableNoteKind(
  diagnosticCode: EncryptedDmDiagnosticCode,
): EncryptedDmUnavailableNoteKind {
  switch (diagnosticCode) {
    case 'policy-blocked-history':
      return 'policy-blocked';
    case 'missing-envelope':
    case 'same-user-new-device-history-gap':
    case 'device-retired-or-mismatched':
      return 'history-unavailable';
    default:
      return null;
  }
}

export function getEncryptedDmDebugBucket(
  diagnosticCode: EncryptedDmDiagnosticCode,
) {
  switch (diagnosticCode) {
    case 'temporary-loading':
    case 'stale-cached-failure-state':
      return 'temporary-loading' as const;
    case 'policy-blocked-history':
      return 'policy-blocked-history' as const;
    case 'missing-envelope':
    case 'same-user-new-device-history-gap':
    case 'device-retired-or-mismatched':
    case 'client-key-material-missing':
    case 'local-device-record-missing':
      return 'missing-envelope' as const;
    default:
      return 'decrypt-failure' as const;
  }
}

export function classifyEncryptedDmFailureDiagnostic(
  error: unknown,
): EncryptedDmDiagnosticCode {
  if (!(error instanceof Error)) {
    return 'decrypt-failed';
  }

  if (
    error.message.includes('Unable to open DM E2EE device storage') ||
    error.message.includes('Unable to read DM E2EE device record') ||
    error.message.includes('Unable to read DM E2EE device records by server id')
  ) {
    return 'client-session-lookup-failed';
  }

  if (
    error.message.includes('one-time prekey is missing locally') ||
    error.message.includes('Required DM E2EE one-time prekey is missing locally')
  ) {
    return 'client-key-material-missing';
  }

  if (error.message.includes('Local DM E2EE device record is missing')) {
    return 'local-device-record-missing';
  }

  if (
    error.message.includes('Unsupported DM E2EE envelope type') ||
    error.message.includes('Unsupported DM E2EE payload scheme')
  ) {
    return 'malformed-envelope';
  }

  return 'decrypt-failed';
}

export function classifyEncryptedDmFailure(error: unknown): EncryptedDmFailureKind {
  return getEncryptedDmFailureKindForDiagnostic(
    classifyEncryptedDmFailureDiagnostic(error),
  );
}

export function getEncryptedDmBodyRenderState(input: {
  plaintext: string | null;
  isUnavailable: boolean;
  failureKind: EncryptedDmFailureKind;
  diagnosticCode?: EncryptedDmDiagnosticCode;
  fallbackLabel: string;
  setupUnavailableLabel: string;
  unavailableLabel: string;
}) {
  const diagnosticCode = input.diagnosticCode ?? 'temporary-loading';

  if (input.plaintext?.trim()) {
    return {
      kind: 'plaintext' as const,
      text: input.plaintext.trim(),
      showRefreshSetup: false,
      diagnosticCode: null,
      debugBucket: null,
    };
  }

  if (input.isUnavailable) {
    return {
      kind: 'unavailable' as const,
      text:
        input.failureKind === 'device-setup'
          ? input.setupUnavailableLabel
          : input.unavailableLabel,
      showRefreshSetup: input.failureKind === 'device-setup',
      showRecoveryActions: shouldOfferEncryptedDmRecoveryActions(diagnosticCode),
      unavailableNoteKind: getEncryptedDmUnavailableNoteKind(diagnosticCode),
      diagnosticCode,
      debugBucket: getEncryptedDmDebugBucket(diagnosticCode),
    };
  }

  return {
    kind: 'fallback' as const,
    text: input.fallbackLabel,
      showRefreshSetup: false,
      showRecoveryActions: false,
      unavailableNoteKind: null,
      diagnosticCode,
      debugBucket: getEncryptedDmDebugBucket(diagnosticCode),
    };
}

export function getEncryptedDmComposerErrorMessage(input: {
  code:
    | 'dm_e2ee_schema_missing'
    | 'dm_e2ee_rollout_disabled'
    | 'dm_e2ee_local_state_incomplete'
    | 'dm_e2ee_recipient_device_missing'
    | 'dm_e2ee_recipient_unavailable'
    | 'dm_e2ee_sender_device_stale'
    | 'dm_e2ee_prekey_conflict'
    | 'dm_e2ee_unsupported_browser'
    | null;
  labels: {
    encryptionUnavailableHere: string;
    encryptionSetupUnavailable: string;
    encryptionRolloutUnavailable: string;
    encryptionNeedsRefresh: string;
    recipientEncryptionUnavailable: string;
    encryptionSessionChanged: string;
    unableToSendEncryptedMessage: string;
  };
}) {
  switch (input.code) {
    case 'dm_e2ee_unsupported_browser':
      return input.labels.encryptionUnavailableHere;
    case 'dm_e2ee_schema_missing':
      return input.labels.encryptionSetupUnavailable;
    case 'dm_e2ee_rollout_disabled':
      return input.labels.encryptionRolloutUnavailable;
    case 'dm_e2ee_local_state_incomplete':
    case 'dm_e2ee_sender_device_stale':
      return input.labels.encryptionNeedsRefresh;
    case 'dm_e2ee_recipient_device_missing':
    case 'dm_e2ee_recipient_unavailable':
      return input.labels.recipientEncryptionUnavailable;
    case 'dm_e2ee_prekey_conflict':
      return input.labels.encryptionSessionChanged;
    default:
      return input.labels.unableToSendEncryptedMessage;
  }
}
