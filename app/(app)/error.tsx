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
          <h1 className="section-title">Couldn&apos;t load this screen</h1>
          <p className="muted">
            Please try again. If it keeps happening, go back to Home or choose a different home.
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
          <Link className="pill" href="/spaces" prefetch={false}>
            Choose home
          </Link>
        </div>
      </section>
    </section>
  );
}
