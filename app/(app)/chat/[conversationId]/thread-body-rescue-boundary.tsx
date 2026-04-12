'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  logBrokenThreadHistoryProof,
  summarizeBrokenThreadMessagePatches,
} from '@/modules/messaging/diagnostics/thread-history-proof';
import { getThreadLiveStateSnapshot } from '@/modules/messaging/realtime/thread-live-state-store';
import { readThreadMessagePatchSnapshot } from '@/modules/messaging/realtime/thread-message-patch-store';
import { withSpaceParam } from '@/modules/spaces/url';
import {
  DmThreadClientSubtree,
  readLastDmThreadClientSubtree,
  type DmThreadClientDiagnostics,
} from './dm-thread-client-diagnostics';
import { readLastDmThreadHydrationSnapshot } from './dm-thread-hydration-probe';

type ThreadBodyRescueBoundaryProps = {
  activeSpaceId: string;
  children: ReactNode;
  conversationId: string;
  settingsHref: string;
  threadClientDiagnostics: DmThreadClientDiagnostics;
};

type ThreadBodyRescueFallbackProps = {
  activeSpaceId: string;
  conversationId: string;
  onRetry: () => void;
  settingsHref: string;
  threadClientDiagnostics: DmThreadClientDiagnostics;
};

function ThreadBodyRescueFallback({
  activeSpaceId,
  conversationId,
  onRetry,
  settingsHref,
  threadClientDiagnostics,
}: ThreadBodyRescueFallbackProps) {
  useEffect(() => {
    const lastClientSubtree = readLastDmThreadClientSubtree();
    const lastHydrationSnapshot = readLastDmThreadHydrationSnapshot();
    const liveStateSnapshot = getThreadLiveStateSnapshot(conversationId);
    const patchSnapshot = readThreadMessagePatchSnapshot(conversationId);

    logBrokenThreadHistoryProof('rescue:fallback-mounted', {
      conversationId,
      details: {
        debugRequestId: threadClientDiagnostics.debugRequestId ?? null,
        deploymentId: threadClientDiagnostics.deploymentId ?? null,
        gitCommitSha: threadClientDiagnostics.gitCommitSha ?? null,
        lastClientSubtree,
        lastHydrationSnapshot,
        liveStateSnapshot,
        patchSummary: summarizeBrokenThreadMessagePatches(patchSnapshot),
        vercelUrl: threadClientDiagnostics.vercelUrl ?? null,
      },
      level: 'error',
    });
  }, [conversationId, threadClientDiagnostics]);

  return (
    <section className="thread-body-rescue-shell">
      <section
        aria-live="polite"
        className="card stack thread-body-rescue-card"
        role="alert"
      >
        <div className="stack route-error-copy">
          <h2 className="section-title">Couldn&apos;t load this conversation</h2>
          <p className="muted">
            The thread body hit a problem while loading. You can retry just the
            conversation body or leave this chat safely.
          </p>
          <p className="muted route-error-note">
            The chat header and navigation are still available, so you can go
            back to Chats or open info without getting trapped here.
          </p>
        </div>

        <div className="cluster route-error-actions">
          <button className="button" onClick={onRetry} type="button">
            Retry history
          </button>
          <Link
            className="button button-secondary"
            href={withSpaceParam('/inbox', activeSpaceId)}
            prefetch={false}
          >
            Back to Chats
          </Link>
          <Link
            className="button button-secondary"
            href={settingsHref}
            prefetch={false}
          >
            Open info
          </Link>
        </div>
      </section>
    </section>
  );
}

export function ThreadBodyRescueBoundary({
  activeSpaceId,
  children,
  conversationId,
  settingsHref,
  threadClientDiagnostics,
}: ThreadBodyRescueBoundaryProps) {
  const [boundaryNonce, setBoundaryNonce] = useState(0);

  return (
    <DmThreadClientSubtree
      key={boundaryNonce}
      conversationId={conversationId}
      debugRequestId={threadClientDiagnostics.debugRequestId}
      deploymentId={threadClientDiagnostics.deploymentId}
      fallback={
        <ThreadBodyRescueFallback
          activeSpaceId={activeSpaceId}
          conversationId={conversationId}
          onRetry={() => setBoundaryNonce((currentValue) => currentValue + 1)}
          settingsHref={settingsHref}
          threadClientDiagnostics={threadClientDiagnostics}
        />
      }
      gitCommitSha={threadClientDiagnostics.gitCommitSha}
      onError={({ componentStack, error, ...details }) => {
        const lastClientSubtree = readLastDmThreadClientSubtree();
        const lastHydrationSnapshot = readLastDmThreadHydrationSnapshot();
        const liveStateSnapshot = getThreadLiveStateSnapshot(conversationId);
        const patchSnapshot = readThreadMessagePatchSnapshot(conversationId);

        logBrokenThreadHistoryProof('rescue:render-error-captured', {
          conversationId,
          details: {
            ...details,
            componentStack,
            errorMessage: error.message,
            errorName: error.name,
            lastClientSubtree,
            lastHydrationSnapshot,
            liveStateSnapshot,
            patchSummary: summarizeBrokenThreadMessagePatches(patchSnapshot),
          },
          level: 'error',
        });
      }}
      surface="thread-history-viewport"
      vercelUrl={threadClientDiagnostics.vercelUrl}
    >
      {children}
    </DmThreadClientSubtree>
  );
}
