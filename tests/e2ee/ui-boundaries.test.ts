import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyEncryptedDmFailure,
  getEncryptedDmBodyRenderState,
  getEncryptedDmComposerErrorMessage,
} from '../../src/modules/messaging/e2ee/ui-policy.ts';

test('decrypt failure with missing local key material is classified as device setup issue', () => {
  const failureKind = classifyEncryptedDmFailure(
    new Error('Required DM E2EE one-time prekey is missing locally.'),
  );

  assert.equal(failureKind, 'device-setup');
});

test('encrypted DM body does not silently fall back to generic preview text after decrypt failure', () => {
  const state = getEncryptedDmBodyRenderState({
    plaintext: null,
    isUnavailable: true,
    failureKind: 'device-setup',
    fallbackLabel: 'Encrypted message',
    setupUnavailableLabel: 'Encrypted message is not available on this device yet',
    unavailableLabel: 'Encrypted message is unavailable right now',
  });

  assert.equal(state.kind, 'unavailable');
  assert.equal(
    state.text,
    'Encrypted message is not available on this device yet',
  );
  assert.equal(state.showRefreshSetup, true);
});

test('encrypted send surfaces recipient readiness problems as explicit blocked state', () => {
  const message = getEncryptedDmComposerErrorMessage({
    code: 'dm_e2ee_recipient_device_missing',
    labels: {
      encryptionUnavailableHere: 'Unavailable here',
      encryptionSetupUnavailable: 'Setup unavailable',
      encryptionRolloutUnavailable: 'Rollout unavailable',
      encryptionNeedsRefresh: 'Needs refresh',
      recipientEncryptionUnavailable: 'Recipient is not ready for encrypted messages yet',
      encryptionSessionChanged: 'Session changed',
      unableToSendEncryptedMessage: 'Unable to send encrypted message',
    },
  });

  assert.equal(message, 'Recipient is not ready for encrypted messages yet');
});

test('unknown encrypted send failures do not echo raw backend text to the user', () => {
  const message = getEncryptedDmComposerErrorMessage({
    code: null,
    labels: {
      encryptionUnavailableHere: 'Unavailable here',
      encryptionSetupUnavailable: 'Setup unavailable',
      encryptionRolloutUnavailable: 'Rollout unavailable',
      encryptionNeedsRefresh: 'Needs refresh',
      recipientEncryptionUnavailable: 'Recipient unavailable',
      encryptionSessionChanged: 'Session changed',
      unableToSendEncryptedMessage: 'Unable to send encrypted message',
    },
  });

  assert.equal(message, 'Unable to send encrypted message');
});
