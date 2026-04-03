export type EncryptedDmFailureKind = 'device-setup' | 'unavailable';

export function classifyEncryptedDmFailure(error: unknown): EncryptedDmFailureKind {
  if (!(error instanceof Error)) {
    return 'unavailable';
  }

  if (
    error.message.includes('Local DM E2EE device record is missing') ||
    error.message.includes('one-time prekey is missing locally')
  ) {
    return 'device-setup';
  }

  return 'unavailable';
}

export function getEncryptedDmBodyRenderState(input: {
  plaintext: string | null;
  isUnavailable: boolean;
  failureKind: EncryptedDmFailureKind;
  fallbackLabel: string;
  setupUnavailableLabel: string;
  unavailableLabel: string;
}) {
  if (input.plaintext?.trim()) {
    return {
      kind: 'plaintext' as const,
      text: input.plaintext.trim(),
      showRefreshSetup: false,
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
    };
  }

  return {
    kind: 'fallback' as const,
    text: input.fallbackLabel,
    showRefreshSetup: false,
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
