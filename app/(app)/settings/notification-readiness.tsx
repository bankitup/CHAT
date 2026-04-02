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
      title: 'Notifications',
      body: 'Checking what’s available on this device.',
      badge: 'Checking',
      settingValue: 'Checking',
    };
  }

  switch (readiness.status) {
    case 'unsupported':
      return {
        title: 'Notifications',
        body: 'Notifications are not available on this device.',
        badge: 'Unsupported',
        settingValue: 'Unavailable',
      };
    case 'blocked':
      return {
        title: 'Notifications',
        body: 'Notifications are turned off. You can re-enable them in browser settings later.',
        badge: 'Blocked',
        settingValue: 'Off',
      };
    case 'enabled':
      return {
        title: 'Notifications',
        body: 'Notifications are enabled. Delivery is still being prepared.',
        badge: 'Ready',
        settingValue: 'On',
      };
    default:
      return {
        title: 'Notifications',
        body: 'This device can enable notifications for Chat.',
        badge: 'Available',
        settingValue: 'Available',
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
        <p className="eyebrow">Preferences</p>
        <h2 className="section-title">{statusCopy.title}</h2>
        <p className="muted">{statusCopy.body}</p>
      </div>

      <div className="cluster settings-summary">
        <span className="summary-pill">{statusCopy.badge}</span>
        <span className="summary-pill summary-pill-muted">
          {readiness?.serviceWorkerReady ? 'This device is ready' : 'Still preparing'}
        </span>
      </div>

      <div className="settings-capability-list">
        <div className="settings-capability-row">
          <span className="settings-capability-label">Notifications</span>
          <span className="settings-capability-value">{statusCopy.settingValue}</span>
        </div>
        <div className="settings-capability-row">
          <span className="settings-capability-label">Permission</span>
          <span className="settings-capability-value">
            {readiness?.permission === 'unsupported'
              ? 'Unavailable'
              : readiness?.permission ?? 'Checking'}
          </span>
        </div>
        <div className="settings-capability-row">
          <span className="settings-capability-label">Message alerts</span>
          <span className="settings-capability-value">Coming soon</span>
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
            Turn notifications back on in your browser settings when you’re ready.
          </p>
        ) : null}

        {readiness?.status === 'enabled' ? (
          <p className="muted settings-note">
            Message alerts will arrive in a later update.
          </p>
        ) : null}
      </div>
    </section>
  );
}
