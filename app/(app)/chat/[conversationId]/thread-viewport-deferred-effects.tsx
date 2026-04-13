'use client';

import dynamic from 'next/dynamic';
import { OptimisticThreadMessages } from './optimistic-thread-messages';
import type { DmThreadClientDiagnostics } from './dm-thread-client-diagnostics';
import { DmThreadClientSubtree } from './dm-thread-client-diagnostics';
import { useDeferredChatRuntimeReady } from './use-deferred-chat-runtime-ready';

const DeferredAutoScrollToLatest = dynamic(
  () =>
    import('./auto-scroll-to-latest').then((mod) => mod.AutoScrollToLatest),
  { ssr: false },
);

const DeferredProgressiveHistoryLoader = dynamic(
  () =>
    import('./progressive-history-loader').then(
      (mod) => mod.ProgressiveHistoryLoader,
    ),
  { ssr: false },
);

const DeferredMarkConversationRead = dynamic(
  () =>
    import('./mark-conversation-read').then(
      (mod) => mod.MarkConversationRead,
    ),
  { ssr: false },
);

type ThreadViewportDeferredEffectsProps = {
  confirmedClientIds: string[];
  conversationId: string;
  conversationKind: 'dm' | 'group';
  currentReadMessageSeq: number | null;
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  labels: {
    attachment: string;
    delete: string;
    failed: string;
    photo: string;
    justNow: string;
    queued: string;
    remove: string;
    retry: string;
    sending: string;
    sent: string;
    voiceFailed: string;
    voicePendingHint: string;
    voiceProcessing: string;
    voiceUploading: string;
  };
  latestVisibleMessageSeq: number | null;
  loadingOlderLabel: string;
  noOlderLabel: string;
  onRequestOlder: () => void;
  threadClientDiagnostics: DmThreadClientDiagnostics;
};

export function ThreadViewportDeferredEffects({
  confirmedClientIds,
  conversationId,
  conversationKind,
  currentReadMessageSeq,
  hasMoreOlder,
  isLoadingOlder,
  labels,
  latestVisibleMessageSeq,
  loadingOlderLabel,
  noOlderLabel,
  onRequestOlder,
  threadClientDiagnostics,
}: ThreadViewportDeferredEffectsProps) {
  const isReady = useDeferredChatRuntimeReady({
    fallbackDelayMs: 90,
    idleTimeoutMs: 900,
  });

  const optimisticThreadMessagesNode =
    conversationKind === 'dm' ? (
      <DmThreadClientSubtree
        conversationId={conversationId}
        {...threadClientDiagnostics}
        surface="optimistic-thread-messages"
      >
        <OptimisticThreadMessages
          confirmedClientIds={confirmedClientIds}
          conversationId={conversationId}
          labels={labels}
        />
      </DmThreadClientSubtree>
    ) : (
      <OptimisticThreadMessages
        confirmedClientIds={confirmedClientIds}
        conversationId={conversationId}
        labels={labels}
      />
    );

  if (!isReady) {
    return optimisticThreadMessagesNode;
  }

  const resolvedLatestVisibleMessageSeq =
    latestVisibleMessageSeq !== null && Number.isFinite(latestVisibleMessageSeq)
      ? latestVisibleMessageSeq
      : null;

  return (
    <>
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="progressive-history-loader"
        >
          <DeferredProgressiveHistoryLoader
            conversationId={conversationId}
            hasMoreOlder={hasMoreOlder}
            idleLabel={noOlderLabel}
            isLoadingOlder={isLoadingOlder}
            loadingLabel={loadingOlderLabel}
            onRequestOlder={onRequestOlder}
            targetId="message-thread-scroll"
          />
        </DmThreadClientSubtree>
      ) : (
        <DeferredProgressiveHistoryLoader
          conversationId={conversationId}
          hasMoreOlder={hasMoreOlder}
          idleLabel={noOlderLabel}
          isLoadingOlder={isLoadingOlder}
          loadingLabel={loadingOlderLabel}
          onRequestOlder={onRequestOlder}
          targetId="message-thread-scroll"
        />
      )}
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="auto-scroll-to-latest"
        >
          <DeferredAutoScrollToLatest
            bottomSentinelId="message-thread-bottom-sentinel"
            conversationId={conversationId}
            latestVisibleMessageSeq={latestVisibleMessageSeq}
            targetId="message-thread-scroll"
          />
        </DmThreadClientSubtree>
      ) : (
        <DeferredAutoScrollToLatest
          bottomSentinelId="message-thread-bottom-sentinel"
          conversationId={conversationId}
          latestVisibleMessageSeq={latestVisibleMessageSeq}
          targetId="message-thread-scroll"
        />
      )}
      {optimisticThreadMessagesNode}
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="mark-conversation-read"
        >
          <DeferredMarkConversationRead
            bottomSentinelId="message-thread-bottom-sentinel"
            conversationId={conversationId}
            currentReadMessageSeq={currentReadMessageSeq}
            key={`mark-read-${conversationId}-${currentReadMessageSeq ?? 'none'}-${resolvedLatestVisibleMessageSeq ?? 'none'}`}
            latestVisibleMessageSeq={resolvedLatestVisibleMessageSeq}
          />
        </DmThreadClientSubtree>
      ) : (
        <DeferredMarkConversationRead
          bottomSentinelId="message-thread-bottom-sentinel"
          conversationId={conversationId}
          currentReadMessageSeq={currentReadMessageSeq}
          key={`mark-read-${conversationId}-${currentReadMessageSeq ?? 'none'}-${resolvedLatestVisibleMessageSeq ?? 'none'}`}
          latestVisibleMessageSeq={resolvedLatestVisibleMessageSeq}
        />
      )}
    </>
  );
}
