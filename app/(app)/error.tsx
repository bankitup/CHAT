'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { withSpaceParam } from '@/modules/spaces/url';

type AppRouteErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppRouteErrorBoundary({
  error,
  reset,
}: AppRouteErrorBoundaryProps) {
  const searchParams = useSearchParams();
  const spaceId = searchParams.get('space');

  useEffect(() => {
    console.error('[route-error-boundary]', 'app', {
      digest: error.digest ?? null,
      message: error.message,
    });
  }, [error]);

  return (
    <section className="page page-mobile">
      <section className="card stack route-error-card">
        <div className="stack route-error-copy">
          <p className="eyebrow">KeepCozy shell</p>
          <h1 className="section-title">Couldn&apos;t load this home view</h1>
          <p className="muted">
            Try again first. If this still fails, go back to Home or choose a different home
            context before reopening the current section.
          </p>
          <p className="muted route-error-note">
            If you&apos;re validating the canonical TEST-home proof path, choose <code>TEST</code>{' '}
            again from the home picker before retrying.
          </p>
        </div>

        <div className="cluster route-error-actions">
          <button className="button" onClick={reset} type="button">
            Try again
          </button>
          <Link
            className="button button-secondary"
            href={withSpaceParam('/home', spaceId)}
            prefetch={false}
          >
            Home
          </Link>
          <Link className="pill" href={withSpaceParam('/spaces', spaceId)} prefetch={false}>
            Choose home
          </Link>
        </div>
      </section>
    </section>
  );
}
