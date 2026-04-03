import type {
  DmE2eeEnvelopeInsert,
  DmE2eeRecipientBundleResponse,
  StoredDmE2eeEnvelope,
  UserDevicePublicBundle,
} from '@/modules/messaging/contract/dm-e2ee';
import type { LocalDmE2eeDeviceRecord } from './device-store';

type EncryptedDmTextPayload = {
  senderDeviceRecordId: string;
  envelopes: DmE2eeEnvelopeInsert[];
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded =
    normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function encodeBase64Url(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function importEd25519PublicKey(raw: Uint8Array) {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(raw),
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
}

async function importX25519PublicKey(raw: Uint8Array) {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(raw),
    { name: 'X25519' },
    false,
    [],
  );
}

async function verifyRecipientBundle(
  identityKeyPublic: string,
  signedPrekeyPublic: string,
  signedPrekeySignature: string,
) {
  const identityPublicKey = await importEd25519PublicKey(
    decodeBase64Url(identityKeyPublic),
  );
  const signedPrekeyPublicBytes = decodeBase64Url(signedPrekeyPublic);
  const signatureBytes = decodeBase64Url(signedPrekeySignature);

  const verified = await crypto.subtle.verify(
    { name: 'Ed25519' },
    identityPublicKey,
    signatureBytes,
    signedPrekeyPublicBytes,
  );

  if (!verified) {
    throw new Error('Recipient DM E2EE bundle verification failed.');
  }
}

function concatUint8Arrays(values: Uint8Array[]) {
  const totalLength = values.reduce((sum, value) => sum + value.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const value of values) {
    result.set(value, offset);
    offset += value.byteLength;
  }

  return result;
}

async function deriveBootstrapAesKey(input: {
  localRecord: LocalDmE2eeDeviceRecord;
  recipient: UserDevicePublicBundle;
  ephemeralPrivateKey: CryptoKey;
  ephemeralPublicKey: string;
  conversationId: string;
  clientId: string;
}) {
  const signedPrekeyPublic = await importX25519PublicKey(
    decodeBase64Url(input.recipient.signedPrekeyPublic),
  );
  const signedPrekeyBits = await crypto.subtle.deriveBits(
    {
      name: 'X25519',
      public: signedPrekeyPublic,
    },
    input.ephemeralPrivateKey,
    256,
  );
  const sharedParts = [new Uint8Array(signedPrekeyBits)];

  if (input.recipient.oneTimePrekeyPublic) {
    const oneTimePrekeyPublic = await importX25519PublicKey(
      decodeBase64Url(input.recipient.oneTimePrekeyPublic),
    );
    const oneTimeBits = await crypto.subtle.deriveBits(
      {
        name: 'X25519',
        public: oneTimePrekeyPublic,
      },
      input.ephemeralPrivateKey,
      256,
    );
    sharedParts.push(new Uint8Array(oneTimeBits));
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    concatUint8Arrays(sharedParts),
    'HKDF',
    false,
    ['deriveKey'],
  );
  const saltBytes = new TextEncoder().encode('chat-dm-e2ee-v1');
  const infoBytes = new TextEncoder().encode(
    [
      input.conversationId,
      input.clientId,
      input.localRecord.serverDeviceRecordId ?? '',
      input.recipient.deviceRecordId,
      input.ephemeralPublicKey,
      input.recipient.signedPrekeyId,
      input.recipient.oneTimePrekeyId ?? '',
    ].join(':'),
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBytes,
      info: infoBytes,
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt'],
  );
}

export async function encryptDmTextForRecipient(input: {
  conversationId: string;
  clientId: string;
  plaintext: string;
  localRecord: LocalDmE2eeDeviceRecord;
  recipientBundle: DmE2eeRecipientBundleResponse;
}): Promise<EncryptedDmTextPayload> {
  if (!input.localRecord.serverDeviceRecordId) {
    throw new Error('Local DM E2EE device identity is not published yet.');
  }

  await verifyRecipientBundle(
    input.recipientBundle.recipient.identityKeyPublic,
    input.recipientBundle.recipient.signedPrekeyPublic,
    input.recipientBundle.recipient.signedPrekeySignature,
  );

  const ephemeralKeyPair = (await crypto.subtle.generateKey(
    { name: 'X25519' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair;
  const ephemeralPublicRaw = await crypto.subtle.exportKey(
    'raw',
    ephemeralKeyPair.publicKey,
  );
  const ephemeralPublicKey = encodeBase64Url(ephemeralPublicRaw);
  const aesKey = await deriveBootstrapAesKey({
    localRecord: input.localRecord,
    recipient: input.recipientBundle.recipient,
    ephemeralPrivateKey: ephemeralKeyPair.privateKey,
    ephemeralPublicKey,
    conversationId: input.conversationId,
    clientId: input.clientId,
  });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBytes = new TextEncoder().encode(input.plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    plaintextBytes,
  );
  const envelope = {
    version: 1,
    scheme: 'chat_dm_e2ee_v1_prekey',
    ephemeralPublicKey,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(ciphertext),
    recipientSignedPrekeyId: input.recipientBundle.recipient.signedPrekeyId,
    recipientOneTimePrekeyId:
      input.recipientBundle.recipient.oneTimePrekeyId ?? null,
  };

  const recipientEnvelope: DmE2eeEnvelopeInsert = {
    recipientDeviceRecordId: input.recipientBundle.recipient.deviceRecordId,
    envelopeType: 'prekey_signal_message',
    ciphertext: JSON.stringify(envelope),
    usedOneTimePrekeyId: input.recipientBundle.recipient.oneTimePrekeyId ?? null,
  };
  const senderEnvelope = await encryptDmTextForSelf({
    conversationId: input.conversationId,
    clientId: input.clientId,
    plaintext: input.plaintext,
    localRecord: input.localRecord,
  });

  return {
    senderDeviceRecordId: input.localRecord.serverDeviceRecordId,
    envelopes: [recipientEnvelope, senderEnvelope],
  };
}

async function encryptDmTextForSelf(input: {
  conversationId: string;
  clientId: string;
  plaintext: string;
  localRecord: LocalDmE2eeDeviceRecord;
}): Promise<DmE2eeEnvelopeInsert> {
  if (!input.localRecord.serverDeviceRecordId) {
    throw new Error('Local DM E2EE device identity is not published yet.');
  }

  const selfBundle: UserDevicePublicBundle = {
    deviceRecordId: input.localRecord.serverDeviceRecordId,
    userId: input.localRecord.userId,
    deviceId: input.localRecord.deviceId,
    registrationId: input.localRecord.registrationId,
    identityKeyPublic: input.localRecord.identityPublicKey,
    signedPrekeyId: input.localRecord.signedPrekeyId,
    signedPrekeyPublic: input.localRecord.signedPrekeyPublicKey,
    signedPrekeySignature: input.localRecord.signedPrekeySignature,
    oneTimePrekeyId: null,
    oneTimePrekeyPublic: null,
  };
  const ephemeralKeyPair = (await crypto.subtle.generateKey(
    { name: 'X25519' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair;
  const ephemeralPublicRaw = await crypto.subtle.exportKey(
    'raw',
    ephemeralKeyPair.publicKey,
  );
  const ephemeralPublicKey = encodeBase64Url(ephemeralPublicRaw);
  const aesKey = await deriveBootstrapAesKey({
    localRecord: input.localRecord,
    recipient: selfBundle,
    ephemeralPrivateKey: ephemeralKeyPair.privateKey,
    ephemeralPublicKey,
    conversationId: input.conversationId,
    clientId: input.clientId,
  });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    new TextEncoder().encode(input.plaintext),
  );

  return {
    recipientDeviceRecordId: selfBundle.deviceRecordId,
    envelopeType: 'prekey_signal_message',
    ciphertext: JSON.stringify({
      version: 1,
      scheme: 'chat_dm_e2ee_v1_prekey',
      ephemeralPublicKey,
      iv: encodeBase64Url(iv),
      ciphertext: encodeBase64Url(ciphertext),
      recipientSignedPrekeyId: selfBundle.signedPrekeyId,
      recipientOneTimePrekeyId: null,
    }),
    usedOneTimePrekeyId: null,
  };
}

async function importX25519PrivateKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'X25519' },
    false,
    ['deriveBits'],
  );
}

async function deriveReceiveAesKey(input: {
  localRecord: LocalDmE2eeDeviceRecord;
  envelope: {
    ephemeralPublicKey: string;
    recipientOneTimePrekeyId: number | null;
  };
  conversationId: string;
  clientId: string;
  senderDeviceRecordId: string;
}) {
  const ephemeralPublicKey = await importX25519PublicKey(
    decodeBase64Url(input.envelope.ephemeralPublicKey),
  );
  const signedPrekeyPrivateKey = await importX25519PrivateKey(
    input.localRecord.signedPrekeyPrivateKeyJwk,
  );
  const signedPrekeyBits = await crypto.subtle.deriveBits(
    {
      name: 'X25519',
      public: ephemeralPublicKey,
    },
    signedPrekeyPrivateKey,
    256,
  );
  const sharedParts = [new Uint8Array(signedPrekeyBits)];

  if (input.envelope.recipientOneTimePrekeyId !== null) {
    const oneTimePrekey = input.localRecord.oneTimePrekeys.find(
      (prekey) => prekey.prekeyId === input.envelope.recipientOneTimePrekeyId,
    );

    if (!oneTimePrekey) {
      throw new Error('Required DM E2EE one-time prekey is missing locally.');
    }

    const oneTimePrivateKey = await importX25519PrivateKey(
      oneTimePrekey.privateKeyJwk,
    );
    const oneTimeBits = await crypto.subtle.deriveBits(
      {
        name: 'X25519',
        public: ephemeralPublicKey,
      },
      oneTimePrivateKey,
      256,
    );
    sharedParts.push(new Uint8Array(oneTimeBits));
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    concatUint8Arrays(sharedParts),
    'HKDF',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('chat-dm-e2ee-v1'),
      info: new TextEncoder().encode(
        [
          input.conversationId,
          input.clientId,
          input.senderDeviceRecordId,
          input.localRecord.serverDeviceRecordId ?? '',
          input.envelope.ephemeralPublicKey,
          input.localRecord.signedPrekeyId,
          input.envelope.recipientOneTimePrekeyId ?? '',
        ].join(':'),
      ),
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['decrypt'],
  );
}

export async function decryptStoredDmEnvelope(input: {
  conversationId: string;
  clientId: string;
  localRecord: LocalDmE2eeDeviceRecord;
  envelope: StoredDmE2eeEnvelope;
}) {
  if (input.envelope.envelopeType !== 'prekey_signal_message') {
    throw new Error('Unsupported DM E2EE envelope type.');
  }

  const payload = JSON.parse(input.envelope.ciphertext) as {
    version: number;
    scheme: string;
    ephemeralPublicKey: string;
    iv: string;
    ciphertext: string;
    recipientSignedPrekeyId: number;
    recipientOneTimePrekeyId: number | null;
  };

  if (payload.scheme !== 'chat_dm_e2ee_v1_prekey') {
    throw new Error('Unsupported DM E2EE payload scheme.');
  }

  const aesKey = await deriveReceiveAesKey({
    localRecord: input.localRecord,
    envelope: {
      ephemeralPublicKey: payload.ephemeralPublicKey,
      recipientOneTimePrekeyId: payload.recipientOneTimePrekeyId,
    },
    conversationId: input.conversationId,
    clientId: input.clientId,
    senderDeviceRecordId: input.envelope.senderDeviceRecordId,
  });
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64Url(payload.iv),
    },
    aesKey,
    decodeBase64Url(payload.ciphertext),
  );

  return new TextDecoder().decode(plaintext);
}
