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

function createFakeAudio() {
  const audio = {
    pauseCallCount: 0,
    pause() {
      audio.pauseCallCount += 1;
    },
  };

  return audio as unknown as HTMLAudioElement & { pauseCallCount: number };
}

async function resetVoicePlaybackController() {
  const controller = await importWorkspaceModule(
    'app/(app)/chat/[conversationId]/thread-voice-playback-controller.ts',
  );
  const snapshot = controller.getActiveThreadVoicePlaybackSnapshot();

  if (snapshot.audio && snapshot.messageId) {
    controller.releaseActiveThreadVoicePlayback(
      snapshot.messageId,
      snapshot.audio,
      snapshot.ownerVersion,
    );
  }

  controller.setActiveThreadVoicePlaybackIntent(null);
  return controller;
}

test('voice playback controller keeps starting ownership distinct until playback is confirmed', async () => {
  const controller = await resetVoicePlaybackController();
  const audio = createFakeAudio();
  const ownerVersion = controller.claimActiveThreadVoicePlayback(
    'message-starting',
    audio,
  );

  assert.deepEqual(
    controller.resolveActiveThreadVoicePlaybackOwnership({
      audio,
      messageId: 'message-starting',
    }),
    {
      ownerVersion,
      status: 'starting-owner',
    },
  );
  assert.equal(
    controller.shouldIgnoreActiveThreadVoicePlaybackPause({
      audio,
      messageId: 'message-starting',
      ownerVersion,
    }),
    true,
  );

  controller.markActiveThreadVoicePlaybackPlaying(
    'message-starting',
    audio,
    ownerVersion,
  );

  assert.deepEqual(
    controller.resolveActiveThreadVoicePlaybackOwnership({
      audio,
      messageId: 'message-starting',
    }),
    {
      ownerVersion,
      status: 'active-owner',
    },
  );
  assert.equal(
    controller.shouldIgnoreActiveThreadVoicePlaybackPause({
      audio,
      messageId: 'message-starting',
      ownerVersion,
    }),
    false,
  );

  controller.releaseActiveThreadVoicePlayback(
    'message-starting',
    audio,
    ownerVersion,
  );
});

test('voice playback controller pauses the previous audio when a new owner is claimed', async () => {
  const controller = await resetVoicePlaybackController();
  const firstAudio = createFakeAudio();
  const secondAudio = createFakeAudio();
  const firstOwnerVersion = controller.claimActiveThreadVoicePlayback(
    'message-one',
    firstAudio,
  );

  controller.markActiveThreadVoicePlaybackPlaying(
    'message-one',
    firstAudio,
    firstOwnerVersion,
  );

  const secondOwnerVersion = controller.claimActiveThreadVoicePlayback(
    'message-two',
    secondAudio,
  );

  assert.equal(firstAudio.pauseCallCount, 1);
  assert.deepEqual(
    controller.resolveActiveThreadVoicePlaybackOwnership({
      audio: secondAudio,
      messageId: 'message-two',
    }),
    {
      ownerVersion: secondOwnerVersion,
      status: 'starting-owner',
    },
  );
  assert.deepEqual(
    controller.resolveActiveThreadVoicePlaybackOwnership({
      audio: firstAudio,
      messageId: 'message-one',
    }),
    {
      ownerMessageId: 'message-two',
      ownerPhase: 'starting',
      ownerVersion: secondOwnerVersion,
      status: 'other-owner',
    },
  );

  controller.releaseActiveThreadVoicePlayback(
    'message-two',
    secondAudio,
    secondOwnerVersion,
  );
});

test('voice playback lifecycle ownership stays isolated in the extracted controller seam', () => {
  const controllerSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-voice-playback-controller.ts',
  );
  const runtimeHookSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/use-thread-voice-playback-runtime.ts',
  );
  const bubbleSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx',
  );
  const playbackSourceResolverSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/voice-playback-source.ts',
  );

  assert.ok(
    controllerSource.split('\n').length <= 260,
  );
  assert.match(controllerSource, /const activeThreadVoicePlayback:/);
  assert.match(controllerSource, /phase:\s*'idle'/);
  assert.match(controllerSource, /transitionPromise:\s*null/);
  assert.match(controllerSource, /export function runActiveThreadVoicePlaybackTransition/);
  assert.match(controllerSource, /export function shouldIgnoreActiveThreadVoicePlaybackPause/);

  assert.ok(
    runtimeHookSource.split('\n').length <= 1900,
  );
  assert.match(
    runtimeHookSource,
    /export function useThreadVoicePlaybackRuntime\(/,
  );
  assert.match(
    runtimeHookSource,
    /from ['"]\.\/thread-voice-playback-controller['"]/,
  );
  assert.match(
    runtimeHookSource,
    /from ['"]\.\/voice-playback-source['"]/,
  );
  assert.match(runtimeHookSource, /const handleAudioPlaying = useCallback\(/);
  assert.match(runtimeHookSource, /const togglePlaybackUnsafe = useCallback\(/);
  assert.match(runtimeHookSource, /const resetPlaybackProgress = useCallback\(/);
  assert.match(
    runtimeHookSource,
    /if \(playbackState === 'ended' \|\| audio\.ended\) \{[\s\S]*?resetPlaybackProgress\(audio\);/,
  );
  assert.match(
    runtimeHookSource,
    /setPlaybackState\(progressMs > 0 \? 'paused' : 'idle'\)/,
  );
  assert.doesNotMatch(
    runtimeHookSource,
    /setPlaybackState\(audio\.currentTime > 0 \? 'paused' : 'idle'\)/,
  );
  assert.match(
    runtimeHookSource,
    /shouldRenderAudioElement:\s*Boolean\(attachment\)/,
  );

  assert.match(
    bubbleSource,
    /from ['"]\.\/use-thread-voice-playback-runtime['"]/,
  );
  assert.doesNotMatch(bubbleSource, /const activeThreadVoicePlayback:/);
  assert.doesNotMatch(bubbleSource, /transitionPromise:\s*Promise<unknown> \| null/);
  assert.doesNotMatch(
    bubbleSource,
    /from ['"]\.\/thread-voice-playback-controller['"]/,
  );

  assert.doesNotMatch(
    playbackSourceResolverSource,
    /thread-voice-playback-controller/,
  );
});

test('voice playback runtime resets partial progress on replay, source loss, and ended transitions', () => {
  const runtimeHookSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/use-thread-voice-playback-runtime.ts',
  );

  assert.match(
    runtimeHookSource,
    /const resetPlaybackProgress = useCallback\([\s\S]*audio\.currentTime = 0;[\s\S]*setProgressMs\(0\);/,
  );
  assert.match(
    runtimeHookSource,
    /if \(playbackState === 'ended' \|\| audio\.ended\) \{[\s\S]*resetPlaybackProgress\(audio\);/,
  );
  assert.match(
    runtimeHookSource,
    /if \(!effectiveVoicePlaybackSourceUrl\) \{[\s\S]*resetPlaybackProgress\(audio\);[\s\S]*setPlaybackState\(\(current\) => \(current === 'failed' \? current : 'idle'\)\);/,
  );
  assert.match(
    runtimeHookSource,
    /const handleAudioEnded = useCallback\([\s\S]*resetPlaybackProgress\(audio\);[\s\S]*setPlaybackState\('ended'\);/,
  );
});
