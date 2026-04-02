'use client';

import {
  enableNotificationReadiness,
  getNotificationReadiness,
  type NotificationReadiness,
} from '@/modules/messaging/sdk/notifications';
import { useEffect, useState, useTransition } from 'react';

function getStatusCopy(readiness: NotificationReadiness | null) {
  if (!readiness) {
    return {
      title: 'Checking support',
      body: 'Reviewing whether this browser can be prepared for future push alerts.',
      badge: 'Checking',
    };
  }

  switch (readiness.status) {
    case 'unsupported':
      return {
        title: 'Notifications not supported here',
        body: 'This browser or environment does not currently support the notification APIs needed for future web push.',
        badge: 'Unsupported',
      };
    case 'blocked':
      return {
        title: 'Notifications are blocked',
        body: 'Permission was denied in this browser. Future push delivery cannot be prepared until notifications are re-enabled in browser settings.',
        badge: 'Blocked',
      };
    case 'enabled':
      return {
        title: 'Notifications are ready',
        body: 'Permission is granted and the app shell is prepared for future push subscription work. Delivery is not wired end to end yet.',
        badge: 'Ready',
      };
    default:
      return {
        title: 'Notifications are available',
        body: 'This app can request notification permission and register its service worker, but live push delivery is not connected yet.',
        badge: 'Available',
      };
  }
}

export function NotificationReadinessPanel() {
  const [readiness, setReadiness] = useState<NotificationReadiness | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    void getNotificationReadiness().then((nextState) => {
      if (!cancelled) {
        setReadiness(nextState);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const statusCopy = getStatusCopy(readiness);

  return (
    <section className="card stack settings-card">
      <div className="stack settings-card-copy">
        <p className="eyebrow">Notifications</p>
        <h2 className="section-title">{statusCopy.title}</h2>
        <p className="muted">{statusCopy.body}</p>
      </div>

      <div className="cluster settings-summary">
        <span className="summary-pill">{statusCopy.badge}</span>
        <span className="summary-pill summary-pill-muted">
          {readiness?.serviceWorkerReady ? 'Service worker ready' : 'Service worker pending'}
        </span>
      </div>

      <div className="settings-capability-list">
        <div className="settings-capability-row">
          <span className="settings-capability-label">Browser permission</span>
          <span className="settings-capability-value">
            {readiness?.permission === 'unsupported'
              ? 'Unavailable'
              : readiness?.permission ?? 'Checking'}
          </span>
        </div>
        <div className="settings-capability-row">
          <span className="settings-capability-label">Push delivery</span>
          <span className="settings-capability-value">Not connected yet</span>
        </div>
      </div>

      <div className="settings-actions">
        {readiness?.status === 'available' ? (
          <button
            className="button"
            disabled={isPending}
            type="button"
            onClick={() => {
              startTransition(async () => {
                const nextState = await enableNotificationReadiness();
                setReadiness(nextState);
              });
            }}
          >
            {isPending ? 'Preparing…' : 'Enable notifications'}
          </button>
        ) : null}

        {readiness?.status === 'blocked' ? (
          <p className="muted settings-note">
            Re-enable notifications in your browser settings to continue.
          </p>
        ) : null}

        {readiness?.status === 'enabled' ? (
          <p className="muted settings-note">
            This app is ready for future push subscription and delivery wiring.
          </p>
        ) : null}
      </div>
    </section>
  );
}
