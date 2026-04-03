export type MessageContentMode = 'plaintext' | 'dm_e2ee_v1';

export type DmE2eeApiErrorCode =
  | 'dm_e2ee_rollout_disabled'
  | 'dm_e2ee_schema_missing'
  | 'dm_e2ee_sender_device_stale'
  | 'dm_e2ee_local_state_incomplete'
  | 'dm_e2ee_recipient_device_missing'
  | 'dm_e2ee_recipient_unavailable'
  | 'dm_e2ee_prekey_conflict';

export type DmE2eeBootstrap400ReasonCode =
  | 'bad payload'
  | 'missing profile row'
  | 'profile seed failed'
  | 'publish failed';

export type DmE2eeBootstrapFailedValidationBranch =
  | 'incomplete local state'
  | 'stale serverDeviceRecordId'
  | 'failed republish'
  | 'bad payload'
  | 'missing profile row'
  | 'profile seed failed'
  | 'publish failed';

export type DmE2eeApiErrorResponse = {
  error: string;
  code?: DmE2eeApiErrorCode | null;
  exact400ReasonCode?: DmE2eeBootstrap400ReasonCode | null;
  failedValidationBranch?: DmE2eeBootstrapFailedValidationBranch | null;
  exactFailurePoint?: string | null;
};

export type DmE2eeEnvelopeType =
  | 'prekey_signal_message'
  | 'signal_message';

export type UserDevicePublicBundle = {
  deviceRecordId: string;
  userId: string;
  deviceId: number;
  registrationId: number;
  identityKeyPublic: string;
  signedPrekeyId: number;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  oneTimePrekeyId: number | null;
  oneTimePrekeyPublic: string | null;
};

export type DmE2eeEnvelopeInsert = {
  recipientDeviceRecordId: string;
  envelopeType: DmE2eeEnvelopeType;
  ciphertext: string;
  usedOneTimePrekeyId: number | null;
};

export type PublishDmE2eeOneTimePrekey = {
  prekeyId: number;
  publicKey: string;
};

export type PublishDmE2eeDeviceRequest = {
  deviceId: number;
  registrationId: number;
  identityKeyPublic: string;
  signedPrekeyId: number;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  oneTimePrekeys: PublishDmE2eeOneTimePrekey[];
};

export type PublishDmE2eeDeviceResult = {
  deviceRecordId: string;
  publishedPrekeyCount: number;
};

export type DmE2eeSendRequest = {
  conversationId: string;
  clientId: string;
  replyToMessageId: string | null;
  senderDeviceRecordId: string;
  kind: 'text';
  contentMode: 'dm_e2ee_v1';
  envelopes: DmE2eeEnvelopeInsert[];
};

export type DmE2eeRecipientBundleResponse = {
  conversationId: string;
  recipient: UserDevicePublicBundle;
};

export type StoredDmE2eeEnvelope = {
  messageId: string;
  senderDeviceRecordId: string;
  recipientDeviceRecordId: string;
  envelopeType: DmE2eeEnvelopeType;
  ciphertext: string;
  usedOneTimePrekeyId: number | null;
  createdAt: string | null;
};
