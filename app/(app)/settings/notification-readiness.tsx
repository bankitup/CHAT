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
      body: 'Checking this device.',
      badge: 'Checking',
      settingValue: 'Checking',
    };
  }

  switch (readiness.status) {
    case 'unsupported':
      return {
        title: 'Notifications',
        body: 'Not available here right now.',
        badge: 'Unsupported',
        settingValue: 'Unavailable',
      };
    case 'blocked':
      return {
        title: 'Notifications',
        body: 'Turned off in your browser settings.',
        badge: 'Off',
        settingValue: 'Off',
      };
    case 'enabled':
      return {
        title: 'Notifications',
        body: 'On for this device.',
        badge: 'On',
        settingValue: 'On',
      };
    default:
      return {
        title: 'Notifications',
        body: 'Available for this device.',
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
        <h2 className="section-title">{statusCopy.title}</h2>
        <p className="muted">Choose how this device stays in touch.</p>
      </div>

      <div className="cluster settings-summary">
        <span className="summary-pill">{statusCopy.badge}</span>
      </div>

      <div className="settings-capability-list">
        <div className="settings-capability-row">
          <span className="settings-capability-label">Alerts</span>
          <span className="settings-capability-value">{statusCopy.settingValue}</span>
        </div>
        <div className="settings-capability-row">
          <span className="settings-capability-label">Browser permission</span>
          <span className="settings-capability-value">
            {readiness?.permission === 'unsupported'
              ? 'Unavailable'
              : readiness?.permission ?? 'Checking'}
          </span>
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
            {isPending ? 'Turning on…' : 'Turn on notifications'}
          </button>
        ) : null}

        {readiness?.status === 'blocked' ? (
          <p className="muted settings-note">
            You can change this later in browser settings.
          </p>
        ) : null}

        {readiness?.status === 'enabled' ? (
          <p className="muted settings-note">
            Message alerts will arrive in a later update.
          </p>
        ) : null}

        {readiness?.status === 'available' ? (
          <p className="muted settings-note">
            You can turn this on now. Message alerts are coming soon.
          </p>
        ) : null}

        {readiness?.status === 'unsupported' ? (
          <p className="muted settings-note">{statusCopy.body}</p>
        ) : null}
      </div>
    </section>
  );
}
