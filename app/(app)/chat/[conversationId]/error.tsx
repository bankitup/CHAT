'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { withSpaceParam } from '@/modules/spaces/url';
import { readLastDmThreadHydrationSnapshot } from './dm-thread-hydration-probe';
import { readLastDmThreadClientSubtree } from './dm-thread-client-diagnostics';

type ChatRouteErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ChatRouteErrorBoundary({
  error,
  reset,
}: ChatRouteErrorBoundaryProps) {
  const searchParams = useSearchParams();
  const spaceId = searchParams.get('space');

  useEffect(() => {
    const lastClientSubtree = readLastDmThreadClientSubtree();
    const lastHydrationSnapshot = readLastDmThreadHydrationSnapshot();
    console.error('[route-error-boundary]', 'chat-thread', {
      digest: error.digest ?? null,
      lastClientSubtree,
      lastHydrationSnapshot,
      message: error.message,
    });
  }, [error]);

  return (
    <section className="page page-mobile">
      <section className="card stack route-error-card route-error-card-chat">
        <div className="stack route-error-copy">
          <h1 className="section-title">Couldn&apos;t open this chat</h1>
          <p className="muted">
            The thread hit a problem while loading. Please try again or go back to Chats.
          </p>
        </div>

        <div className="cluster route-error-actions">
          <button className="button" onClick={reset} type="button">
            Retry chat
          </button>
          <Link
            className="button button-secondary"
            href={withSpaceParam('/inbox', spaceId)}
            prefetch={false}
          >
            Back to Chats
          </Link>
        </div>
      </section>
    </section>
  );
}
