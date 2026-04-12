'use client';

type ActiveThreadVoicePlaybackPhase = 'active' | 'idle' | 'starting';

const activeThreadVoicePlayback: {
  audio: HTMLAudioElement | null;
  intendedMessageId: string | null;
  messageId: string | null;
  ownerVersion: number;
  phase: ActiveThreadVoicePlaybackPhase;
  transitionPromise: Promise<unknown> | null;
} = {
  audio: null,
  intendedMessageId: null,
  messageId: null,
  ownerVersion: 0,
  phase: 'idle',
  transitionPromise: null,
};

export function getActiveThreadVoicePlaybackSnapshot() {
  return {
    audio: activeThreadVoicePlayback.audio,
    intendedMessageId: activeThreadVoicePlayback.intendedMessageId,
    messageId: activeThreadVoicePlayback.messageId,
    ownerVersion: activeThreadVoicePlayback.ownerVersion,
    phase: activeThreadVoicePlayback.phase,
    transitionPromise: activeThreadVoicePlayback.transitionPromise,
  };
}

export function runActiveThreadVoicePlaybackTransition<T>(
  transition: () => Promise<T> | T,
) {
  const previousTransition = activeThreadVoicePlayback.transitionPromise;
  const nextTransition = Promise.resolve(previousTransition)
    .catch(() => undefined)
    .then(() => transition())
    .finally(() => {
      if (activeThreadVoicePlayback.transitionPromise === nextTransition) {
        activeThreadVoicePlayback.transitionPromise = null;
      }
    });

  activeThreadVoicePlayback.transitionPromise = nextTransition;
  return nextTransition;
}

export type ThreadVoicePlaybackOwnership =
  | {
      ownerVersion: number;
      status: 'active-owner';
    }
  | {
      ownerVersion: number;
      status: 'starting-owner';
    }
  | {
      ownerMessageId: string;
      ownerPhase: 'active' | 'starting';
      ownerVersion: number;
      status: 'other-owner';
    }
  | {
      status: 'intended-owner';
    }
  | {
      status: 'idle';
    };

export function resolveActiveThreadVoicePlaybackOwnership(input: {
  audio: HTMLAudioElement | null;
  messageId: string;
}): ThreadVoicePlaybackOwnership {
  if (
    input.audio &&
    activeThreadVoicePlayback.audio === input.audio &&
    activeThreadVoicePlayback.messageId === input.messageId
  ) {
    return {
      ownerVersion: activeThreadVoicePlayback.ownerVersion,
      status:
        activeThreadVoicePlayback.phase === 'starting'
          ? 'starting-owner'
          : 'active-owner',
    };
  }

  if (
    activeThreadVoicePlayback.audio &&
    activeThreadVoicePlayback.messageId &&
    activeThreadVoicePlayback.messageId !== input.messageId
  ) {
    return {
      ownerMessageId: activeThreadVoicePlayback.messageId,
      ownerPhase:
        activeThreadVoicePlayback.phase === 'starting' ? 'starting' : 'active',
      ownerVersion: activeThreadVoicePlayback.ownerVersion,
      status: 'other-owner',
    };
  }

  if (activeThreadVoicePlayback.intendedMessageId === input.messageId) {
    return {
      status: 'intended-owner',
    };
  }

  return {
    status: 'idle',
  };
}

export function claimActiveThreadVoicePlayback(
  messageId: string,
  audio: HTMLAudioElement,
) {
  const previousAudio = activeThreadVoicePlayback.audio;

  if (previousAudio && previousAudio !== audio) {
    previousAudio.pause();
  }

  const nextOwnerVersion = activeThreadVoicePlayback.ownerVersion + 1;

  activeThreadVoicePlayback.audio = audio;
  activeThreadVoicePlayback.intendedMessageId = messageId;
  activeThreadVoicePlayback.messageId = messageId;
  activeThreadVoicePlayback.ownerVersion = nextOwnerVersion;
  activeThreadVoicePlayback.phase = 'starting';

  return nextOwnerVersion;
}

export function markActiveThreadVoicePlaybackPlaying(
  messageId: string,
  audio: HTMLAudioElement,
  ownerVersion: number | null,
) {
  if (
    activeThreadVoicePlayback.audio === audio &&
    activeThreadVoicePlayback.messageId === messageId &&
    ownerVersion !== null &&
    activeThreadVoicePlayback.ownerVersion === ownerVersion
  ) {
    activeThreadVoicePlayback.phase = 'active';
  }
}

export function setActiveThreadVoicePlaybackIntent(messageId: string | null) {
  activeThreadVoicePlayback.intendedMessageId = messageId;
}

export function requestActiveThreadVoicePlaybackIntent(messageId: string) {
  activeThreadVoicePlayback.intendedMessageId = messageId;

  if (
    activeThreadVoicePlayback.audio &&
    activeThreadVoicePlayback.messageId &&
    activeThreadVoicePlayback.messageId !== messageId
  ) {
    activeThreadVoicePlayback.audio.pause();
  }
}

export function hasActiveThreadVoicePlaybackIntent(messageId: string) {
  return activeThreadVoicePlayback.intendedMessageId === messageId;
}

export function isActiveThreadVoicePlaybackOwner(input: {
  audio: HTMLAudioElement;
  messageId: string;
  ownerVersion: number | null;
}) {
  return Boolean(
    activeThreadVoicePlayback.audio === input.audio &&
      activeThreadVoicePlayback.messageId === input.messageId &&
      input.ownerVersion !== null &&
      activeThreadVoicePlayback.ownerVersion === input.ownerVersion &&
      activeThreadVoicePlayback.phase !== 'idle',
  );
}

export function shouldIgnoreActiveThreadVoicePlaybackPause(input: {
  audio: HTMLAudioElement;
  messageId: string;
  ownerVersion: number | null;
}) {
  return Boolean(
    activeThreadVoicePlayback.audio === input.audio &&
      activeThreadVoicePlayback.messageId === input.messageId &&
      input.ownerVersion !== null &&
      activeThreadVoicePlayback.ownerVersion === input.ownerVersion &&
      activeThreadVoicePlayback.phase === 'starting' &&
      activeThreadVoicePlayback.intendedMessageId === input.messageId,
  );
}

export function releaseActiveThreadVoicePlayback(
  messageId: string,
  audio: HTMLAudioElement,
  ownerVersion: number | null,
) {
  if (
    activeThreadVoicePlayback.audio === audio &&
    activeThreadVoicePlayback.messageId === messageId &&
    ownerVersion !== null &&
    activeThreadVoicePlayback.ownerVersion === ownerVersion
  ) {
    activeThreadVoicePlayback.audio = null;
    activeThreadVoicePlayback.messageId = null;
    activeThreadVoicePlayback.phase = 'idle';

    if (activeThreadVoicePlayback.intendedMessageId === messageId) {
      activeThreadVoicePlayback.intendedMessageId = null;
    }
  }
}
