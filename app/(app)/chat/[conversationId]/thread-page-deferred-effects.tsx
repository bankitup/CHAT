'use client';

import dynamic from 'next/dynamic';
import type { MessageReactionGroup } from '@/modules/messaging/data/thread-read-server';
import type { DmThreadClientDiagnostics } from './dm-thread-client-diagnostics';
import {
  DmThreadClientSubtree,
} from './dm-thread-client-diagnostics';
import { useDeferredChatRuntimeReady } from './use-deferred-chat-runtime-ready';

const DeferredActiveChatRealtimeSync = dynamic(
  () =>
    import('@/modules/messaging/realtime/active-chat-sync').then(
      (mod) => mod.ActiveChatRealtimeSync,
    ),
  { ssr: false },
);

const DeferredThreadLiveStateHydrator = dynamic(
  () =>
    import('@/modules/messaging/realtime/thread-live-state-store').then(
      (mod) => mod.ThreadLiveStateHydrator,
    ),
  { ssr: false },
);

const DeferredWarmNavReadyProbe = dynamic(
  () =>
    import('@/modules/messaging/performance/warm-nav-client').then(
      (mod) => mod.WarmNavReadyProbe,
    ),
  { ssr: false },
);

const DeferredComposerKeyboardOffset = dynamic(
  () =>
    import('./composer-keyboard-offset').then(
      (mod) => mod.ComposerKeyboardOffset,
    ),
  { ssr: false },
);

type ThreadPageDeferredEffectsProps = {
  activeSpaceId: string;
  conversationId: string;
  conversationKind: 'dm' | 'group';
  currentUserId: string;
  currentUserReadSeq: number | null;
  isSettingsOpen: boolean;
  messageCount: number;
  messageIds: string[];
  otherParticipantReadSeq: number | null;
  reactionsByMessage: Array<{
    messageId: string;
    reactions: MessageReactionGroup[];
  }>;
  threadClientDiagnostics: DmThreadClientDiagnostics;
  warmNavRouteKey: string;
};

export function ThreadPageDeferredEffects({
  activeSpaceId,
  conversationId,
  conversationKind,
  currentUserId,
  currentUserReadSeq,
  isSettingsOpen,
  messageCount,
  messageIds,
  otherParticipantReadSeq,
  reactionsByMessage,
  threadClientDiagnostics,
  warmNavRouteKey,
}: ThreadPageDeferredEffectsProps) {
  const isReady = useDeferredChatRuntimeReady();

  if (!isReady) {
    return null;
  }

  return (
    <>
      <DeferredWarmNavReadyProbe
        details={{
          isSettingsOpen,
          kind: conversationKind,
          messageCount,
          spaceId: activeSpaceId,
        }}
        routeKey={warmNavRouteKey}
        routePath={`/chat/${conversationId}`}
        surface="chat"
      />
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="active-chat-realtime-sync"
        >
          <DeferredActiveChatRealtimeSync
            conversationId={conversationId}
            currentUserId={currentUserId}
            messageIds={messageIds}
          />
        </DmThreadClientSubtree>
      ) : (
        <DeferredActiveChatRealtimeSync
          conversationId={conversationId}
          currentUserId={currentUserId}
          messageIds={messageIds}
        />
      )}
      <DeferredThreadLiveStateHydrator
        conversationId={conversationId}
        currentUserReadSeq={currentUserReadSeq}
        otherParticipantReadSeq={otherParticipantReadSeq}
        reactionsByMessage={reactionsByMessage}
      />
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="composer-keyboard-offset"
        >
          <DeferredComposerKeyboardOffset />
        </DmThreadClientSubtree>
      ) : (
        <DeferredComposerKeyboardOffset />
      )}
    </>
  );
}
