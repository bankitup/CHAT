import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MessagingVoiceCaptureMimeType } from '@/modules/messaging/media/voice';

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

test('voice recovery helper treats transport variants and committed locators as locally recoverable', async () => {
  const { hasMessagingVoiceLocallyRecoverableSource } = await importWorkspaceModule(
    'src/modules/messaging/media/message-assets.ts',
  );

  assert.equal(
    hasMessagingVoiceLocallyRecoverableSource({
      attachment: {
        id: 'voice-asset',
        isVoiceMessage: true,
        messageId: 'message-1',
        signedUrl: null,
        voicePlaybackVariants: [
          {
            assetId: 'voice-variant',
            role: 'playback-normalized',
            storageBucket: 'chat-attachments',
            storageObjectPath: 'spaces/demo/voice/voice-variant.m4a',
            transportSourceUrl: '/api/messaging/voice-variant',
          },
        ],
      },
      expectedMessageId: 'message-1',
    }),
    true,
  );

  assert.equal(
    hasMessagingVoiceLocallyRecoverableSource({
      attachment: {
        bucket: 'chat-attachments',
        id: 'voice-asset',
        isVoiceMessage: true,
        messageId: 'message-2',
        objectPath: 'spaces/demo/voice/voice-asset.webm',
        signedUrl: null,
        voicePlaybackVariants: null,
      },
      expectedMessageId: 'message-2',
    }),
    true,
  );

  assert.equal(
    hasMessagingVoiceLocallyRecoverableSource({
      attachment: {
        bucket: 'chat-attachments',
        id: 'voice-asset',
        isVoiceMessage: true,
        messageId: 'other-message',
        objectPath: 'spaces/demo/voice/voice-asset.webm',
        signedUrl: null,
        voicePlaybackVariants: null,
      },
      expectedMessageId: 'message-3',
    }),
    false,
  );
});

test('voice device playback classification stays truthful across supported, unknown, and unsupported cases', async () => {
  const {
    classifyMessagingVoiceDevicePlaybackSupport,
    resolveMessagingVoiceBlobPlaybackRisk,
    resolveMessagingVoiceCaptureMimeType,
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

  assert.deepEqual(
    resolveMessagingVoiceBlobPlaybackRisk({
      fileName: 'voice-note.webm',
      maxTouchPoints: 5,
      mimeType: 'audio/webm;codecs=opus',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      vendor: 'Apple Computer, Inc.',
    }),
    {
      bypassLocalBlobPlayback: true,
      fileExtension: '.webm',
      platform: 'webkit-mobile',
      reason: 'webkit-mobile-opus-container',
    },
  );

  assert.deepEqual(
    resolveMessagingVoiceBlobPlaybackRisk({
      fileName: 'voice-note.webm',
      maxTouchPoints: 0,
      mimeType: 'audio/webm;codecs=opus',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      vendor: 'Google Inc.',
    }),
    {
      bypassLocalBlobPlayback: false,
      fileExtension: '.webm',
      platform: 'other',
      reason: null,
    },
  );

  assert.deepEqual(
    resolveMessagingVoiceCaptureMimeType({
      isTypeSupported: (candidate: MessagingVoiceCaptureMimeType) =>
        candidate === 'audio/mp4' || candidate === 'audio/webm;codecs=opus',
      maxTouchPoints: 5,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      vendor: 'Apple Computer, Inc.',
    }),
    {
      mimePreferenceOrder: [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ],
      platform: 'webkit-mobile',
      selectedMimeType: 'audio/mp4',
    },
  );

  assert.deepEqual(
    resolveMessagingVoiceCaptureMimeType({
      isTypeSupported: (candidate: MessagingVoiceCaptureMimeType) =>
        candidate === 'audio/mp4' || candidate === 'audio/webm;codecs=opus',
      maxTouchPoints: 0,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      vendor: 'Google Inc.',
    }),
    {
      mimePreferenceOrder: [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ],
      platform: 'other',
      selectedMimeType: 'audio/webm;codecs=opus',
    },
  );
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
  assert.match(
    resolverSource,
    /resolveMessagingVoiceBlobPlaybackRisk\(/,
  );
  assert.match(
    resolverSource,
    /local-playable-source-risk-bypass/,
  );
  assert.match(
    resolverSource,
    /if \(blobPlaybackRisk\.bypassLocalBlobPlayback\)/,
  );
  assert.match(
    resolverSource,
    /playbackUrl: transportSourceUrl/,
  );
  assert.match(
    resolverSource,
    /warmed: false/,
  );
  assert.match(
    resolverSource,
    /mode: 'risk-bypass'/,
  );
  assert.match(
    resolverSource,
    /playbackSourceKind: 'transport'/,
  );
});

test('voice bubble keeps unsupported-device playback distinct from ordinary loading', () => {
  const bubbleSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx',
  );
  const runtimeSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/use-thread-voice-playback-runtime.ts',
  );

  assert.match(
    bubbleSource,
    /useThreadVoicePlaybackRuntime/,
  );
  assert.match(
    runtimeSource,
    /resolveMessagingVoicePlaybackSourceOptions\(/,
  );
  assert.match(
    runtimeSource,
    /resolveThreadVoicePreferredPlaybackSource\(/,
  );
  assert.match(
    runtimeSource,
    /input\.devicePlaybackSupportStatus === 'unsupported'/,
  );
  assert.match(
    runtimeSource,
    /reason = 'device-playback-unsupported'/,
  );
  assert.match(
    runtimeSource,
    /case 'failed':/,
  );
  assert.match(
    runtimeSource,
    /'disabled'/,
  );
  assert.match(
    bubbleSource,
    /voiceMessageUnsupported/,
  );
});

test('thread viewport only escalates voice recovery when the row has no local playback path', () => {
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );

  assert.match(
    viewportSource,
    /hasMessagingVoiceLocallyRecoverableSource\(/,
  );
  assert.match(
    viewportSource,
    /function hasPlaybackReadyVoiceAttachment\(\s*messageId: string,\s*attachments: MessageAttachment\[\],\s*\)/,
  );
  assert.match(
    viewportSource,
    /!hasPlaybackReadyVoiceAttachment\(\s*messageId,\s*filterRenderableMessageAttachments\(/,
  );
  assert.match(
    viewportSource,
    /!hasPlaybackReadyVoiceAttachment\(\s*message\.id,\s*filterRenderableMessageAttachments\(/,
  );
});
