import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  classifyEncryptedDmFailure,
  getEncryptedDmBodyRenderState,
  getEncryptedDmComposerErrorMessage,
  getEncryptedDmTemporaryResolvingGraceRemainingMs,
} from '../../src/modules/messaging/e2ee/ui-policy.ts';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

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

test('encrypted DM history gaps stay explicitly unavailable on this device instead of surfacing a misleading retry path', () => {
  const state = getEncryptedDmBodyRenderState({
    plaintext: null,
    isUnavailable: true,
    failureKind: 'unavailable',
    diagnosticCode: 'device-retired-or-mismatched',
    fallbackLabel: 'Encrypted message',
    setupUnavailableLabel: 'Encrypted setup needs attention',
    unavailableLabel: 'Earlier encrypted message unavailable on this device',
  });

  assert.equal(state.kind, 'unavailable');
  assert.equal(
    state.currentDeviceAccessState,
    'history-unavailable-on-this-device',
  );
  assert.equal(state.unavailableNoteKind, 'history-unavailable');
  assert.equal(state.showRetryAction, false);
  assert.equal(
    state.text,
    'Earlier encrypted message unavailable on this device',
  );
  assert.equal(state.debugBucket, 'missing-envelope');
});

test('encrypted DM policy-blocked history stays distinct from generic unavailable history', () => {
  const state = getEncryptedDmBodyRenderState({
    plaintext: null,
    isUnavailable: true,
    failureKind: 'unavailable',
    diagnosticCode: 'policy-blocked-history',
    fallbackLabel: 'Encrypted message',
    setupUnavailableLabel: 'Encrypted setup needs attention',
    unavailableLabel: 'Earlier encrypted message unavailable on this device',
  });

  assert.equal(state.kind, 'unavailable');
  assert.equal(state.currentDeviceAccessState, 'policy-blocked');
  assert.equal(state.unavailableNoteKind, 'policy-blocked');
  assert.equal(state.showRetryAction, false);
  assert.equal(state.debugBucket, 'policy-blocked-history');
});

test('recent missing-envelope encrypted DM states keep a short resolving grace instead of dropping into unavailable immediately', () => {
  const remainingGraceMs = getEncryptedDmTemporaryResolvingGraceRemainingMs({
    diagnosticCode: 'missing-envelope',
    failureKind: 'unavailable',
    messageCreatedAt: new Date(Date.now() - 800).toISOString(),
  });

  assert.equal(typeof remainingGraceMs, 'number');
  assert.ok((remainingGraceMs ?? 0) > 0);
});

test('older encrypted history gaps do not keep pretending to be temporarily resolving', () => {
  const remainingGraceMs = getEncryptedDmTemporaryResolvingGraceRemainingMs({
    diagnosticCode: 'device-retired-or-mismatched',
    failureKind: 'unavailable',
    messageCreatedAt: new Date(Date.now() - 8_000).toISOString(),
  });

  assert.equal(remainingGraceMs, null);
});

test('encrypted DM body renders dedicated historical-unavailable UI instead of falling back to generic body text', () => {
  const encryptedBodySource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/encrypted-dm-message-body.tsx',
  );

  assert.match(encryptedBodySource, /if \(renderState\.kind === 'unavailable'\)/);
  assert.match(
    encryptedBodySource,
    /const isHistoricalUnavailable =[\s\S]*'history-unavailable-on-this-device'[\s\S]*'policy-blocked'/,
  );
  assert.match(
    encryptedBodySource,
    /const shouldRenderCompactHistoricalUnavailable =[\s\S]*compactHistoricalUnavailable && isHistoricalUnavailable/,
  );
  assert.match(
    encryptedBodySource,
    /renderState\.unavailableNoteKind === 'history-unavailable'/,
  );
  assert.match(
    encryptedBodySource,
    /renderState\.unavailableNoteKind === 'policy-blocked'/,
  );
  assert.match(encryptedBodySource, /<EncryptedHistoryUnavailableState/);
  assert.match(encryptedBodySource, /\{renderState\.showRetryAction \? \(/);
  assert.match(
    encryptedBodySource,
    /const \[, setTemporaryResolvingGraceVersion\] = useState\(0\);/,
  );
  assert.match(
    encryptedBodySource,
    /getEncryptedDmTemporaryResolvingGraceRemainingMs\(/,
  );
  assert.match(
    encryptedBodySource,
    /const shouldPreferTemporaryResolvingState =[\s\S]*temporaryResolvingGraceRemainingMs !== null;/,
  );
  assert.match(
    encryptedBodySource,
    /preferTemporaryResolvingState:\s*shouldPreferTemporaryResolvingState/,
  );
});

test('encrypted DM body starts in temporary loading and only falls into unavailable through guarded resolution paths', () => {
  const encryptedBodySource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/encrypted-dm-message-body.tsx',
  );

  assert.match(
    encryptedBodySource,
    /setPlaintext\(null\);\s*setIsUnavailable\(false\);\s*setFailureKind\('unavailable'\);\s*setDiagnosticCode\('temporary-loading'\);/,
  );
  assert.match(
    encryptedBodySource,
    /setDmThreadVisibleMessageState\(\{[\s\S]*diagnosticCode:\s*'temporary-loading'[\s\S]*plaintext:\s*null[\s\S]*\}\);/,
  );
  assert.match(
    encryptedBodySource,
    /const temporaryResolvingGraceRemainingMs = plaintext\?\.trim\(\)\s*\?\s*null\s*:\s*getEncryptedDmTemporaryResolvingGraceRemainingMs\(/,
  );
  assert.match(
    encryptedBodySource,
    /const shouldPreferTemporaryResolvingState =[\s\S]*temporaryResolvingGraceRemainingMs !== null;/,
  );
  assert.match(
    encryptedBodySource,
    /const resolveUnavailable = \([\s\S]*setIsUnavailable\(true\);[\s\S]*setDiagnosticCode\(nextDiagnosticCode\);/,
  );
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
