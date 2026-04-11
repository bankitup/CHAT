import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

async function importWorkspaceModule(relativePath: string) {
  return import(pathToFileURL(resolve(workspaceRoot, relativePath)).href);
}

test('voice source helper preserves current behavior when only the original source exists', async () => {
  const { resolveMessagingVoicePlaybackSourceOptions } = await importWorkspaceModule(
    'src/modules/messaging/media/message-assets.ts',
  );

  const sources = resolveMessagingVoicePlaybackSourceOptions({
    original: {
      assetId: 'original-asset',
      durationMs: 4200,
      fileName: 'voice-note.webm',
      mimeType: 'audio/webm',
      source: 'supabase-storage',
      storageBucket: 'chat-attachments',
      storageObjectPath: 'spaces/demo/voice/original-asset.webm',
      transportSourceUrl: '/api/original',
    },
    variants: null,
  });

  assert.equal(sources.length, 1);
  assert.deepEqual(sources[0], {
    assetId: 'original-asset',
    durationMs: 4200,
    fileName: 'voice-note.webm',
    mimeType: 'audio/webm',
    origin: 'original',
    role: 'original-capture',
    source: 'supabase-storage',
    sourceId:
      'original:original-capture:original-asset:spaces/demo/voice/original-asset.webm:/api/original',
    storageBucket: 'chat-attachments',
    storageObjectPath: 'spaces/demo/voice/original-asset.webm',
    transportSourceUrl: '/api/original',
  });
});

test('voice source helper keeps derived playback candidates additive ahead of the original source', async () => {
  const { resolveMessagingVoicePlaybackSourceOptions } = await importWorkspaceModule(
    'src/modules/messaging/media/message-assets.ts',
  );

  const sources = resolveMessagingVoicePlaybackSourceOptions({
    original: {
      assetId: 'original-asset',
      durationMs: 4200,
      fileName: 'voice-note.webm',
      mimeType: 'audio/webm',
      source: 'supabase-storage',
      storageBucket: 'chat-attachments',
      storageObjectPath: 'spaces/demo/voice/original-asset.webm',
      transportSourceUrl: '/api/original',
    },
    variants: [
      {
        assetId: 'derived-asset',
        durationMs: 4200,
        fileName: 'voice-note.m4a',
        mimeType: 'audio/mp4',
        role: 'playback-normalized',
        source: 'supabase-storage',
        storageBucket: 'chat-attachments',
        storageObjectPath: 'spaces/demo/voice/derived-asset.m4a',
        transportSourceUrl: '/api/derived',
      },
    ],
  });

  assert.equal(sources.length, 2);
  assert.equal(sources[0]?.origin, 'derived');
  assert.equal(sources[0]?.role, 'playback-normalized');
  assert.equal(sources[1]?.origin, 'original');
  assert.equal(sources[1]?.role, 'original-capture');
});

test('voice device playback classification stays truthful across supported, unknown, and unsupported cases', async () => {
  const {
    classifyMessagingVoiceDevicePlaybackSupport,
    resolveMessagingVoicePlaybackSourcePreference,
  } = await importWorkspaceModule('src/modules/messaging/media/voice.ts');

  assert.equal(
    classifyMessagingVoiceDevicePlaybackSupport({
      canPlayType: 'no',
      mediaCapabilitiesSupported: null,
    }),
    'unsupported',
  );
  assert.equal(
    classifyMessagingVoiceDevicePlaybackSupport({
      canPlayType: null,
      mediaCapabilitiesSupported: null,
    }),
    'unknown',
  );
  assert.equal(
    classifyMessagingVoiceDevicePlaybackSupport({
      canPlayType: 'maybe',
      mediaCapabilitiesSupported: null,
    }),
    'supported',
  );

  const derivedSupported = resolveMessagingVoicePlaybackSourcePreference({
    origin: 'derived',
    supportStatus: 'supported',
  });
  const originalSupported = resolveMessagingVoicePlaybackSourcePreference({
    origin: 'original',
    supportStatus: 'supported',
  });
  const derivedUnsupported = resolveMessagingVoicePlaybackSourcePreference({
    origin: 'derived',
    supportStatus: 'unsupported',
  });
  const originalUnsupported = resolveMessagingVoicePlaybackSourcePreference({
    origin: 'original',
    supportStatus: 'unsupported',
  });

  assert.ok(derivedSupported.sourcePriority < originalSupported.sourcePriority);
  assert.ok(originalUnsupported.sourcePriority < derivedUnsupported.sourcePriority);
});

test('voice playback resolver stays selection-aware and reports the chosen source', () => {
  const resolverSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/voice-playback-source.ts',
  );

  assert.match(
    resolverSource,
    /export async function resolveThreadVoicePreferredPlaybackSource\(/,
  );
  assert.match(
    resolverSource,
    /selectedPlaybackSource: MessagingVoicePlaybackSourceOption \| null/,
  );
  assert.match(resolverSource, /playbackSources\?: readonly MessagingVoicePlaybackSourceOption\[] \| null/);
  assert.match(resolverSource, /preferredSourceId\?: string \| null/);
  assert.match(
    resolverSource,
    /resolveMessagingVoicePlaybackSourcePreference\(/,
  );
});

test('voice bubble keeps unsupported-device playback distinct from ordinary loading', () => {
  const bubbleSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx',
  );

  assert.match(
    bubbleSource,
    /resolveMessagingVoicePlaybackSourceOptions\(/,
  );
  assert.match(
    bubbleSource,
    /resolveThreadVoicePreferredPlaybackSource\(/,
  );
  assert.match(
    bubbleSource,
    /reason === 'device-playback-unsupported'/,
  );
  assert.match(
    bubbleSource,
    /interactionAvailability =\s*reason === 'device-playback-unsupported'\s*\?\s*'disabled'/,
  );
  assert.match(
    bubbleSource,
    /voiceMessageUnsupported/,
  );
});
