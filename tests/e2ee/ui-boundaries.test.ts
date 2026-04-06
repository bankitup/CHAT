import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyEncryptedDmFailure,
  getEncryptedDmBodyRenderState,
  getEncryptedDmComposerErrorMessage,
} from '../../src/modules/messaging/e2ee/ui-policy.ts';

test('decrypt failure with missing local key material is classified as unavailable history on this device', () => {
  const failureKind = classifyEncryptedDmFailure(
    new Error('Required DM E2EE one-time prekey is missing locally.'),
  );

  assert.equal(failureKind, 'unavailable');
});

test('encrypted DM body keeps old unavailable history truthful without recovery setup actions', () => {
  const state = getEncryptedDmBodyRenderState({
    plaintext: null,
    isUnavailable: true,
    failureKind: 'unavailable',
    fallbackLabel: 'Encrypted message',
    setupUnavailableLabel: 'Encrypted setup needs attention',
    unavailableLabel: 'Encrypted message is not available on this device',
  });

  assert.equal(state.kind, 'unavailable');
  assert.equal(
    state.text,
    'Encrypted message is not available on this device',
  );
  assert.equal(state.showRetryAction, false);
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
