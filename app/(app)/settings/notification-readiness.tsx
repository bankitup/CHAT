'use client';

import {
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import {
  enableNotificationReadiness,
  getNotificationReadiness,
  type NotificationReadiness,
} from '@/modules/messaging/sdk/notifications';
import { useEffect, useState, useTransition } from 'react';

function getStatusCopy(
  readiness: NotificationReadiness | null,
  language: AppLanguage,
) {
  const t = getTranslations(language);

  if (!readiness) {
    return {
      title: t.notifications.title,
      body: t.notifications.checkingBody,
      badge: t.notifications.checkingBadge,
      settingValue: t.notifications.checking,
    };
  }

  switch (readiness.status) {
    case 'unsupported':
      return {
        title: t.notifications.title,
        body: t.notifications.unsupportedBody,
        badge: t.notifications.unsupportedBadge,
        settingValue: t.notifications.unavailable,
      };
    case 'unconfigured':
      return {
        title: t.notifications.title,
        body: t.notifications.unconfiguredBody,
        badge: t.notifications.unconfiguredBadge,
        settingValue: t.notifications.setupNeeded,
      };
    case 'blocked':
      return {
        title: t.notifications.title,
        body: t.notifications.blockedBody,
        badge: t.notifications.blockedBadge,
        settingValue: t.notifications.off,
      };
    case 'enabled':
      return {
        title: t.notifications.title,
        body: t.notifications.enabledBody,
        badge: t.notifications.enabledBadge,
        settingValue: t.notifications.on,
      };
    default:
      return {
        title: t.notifications.title,
        body:
          readiness.permission === 'granted'
            ? t.notifications.permissionReadyBody
            : t.notifications.availableBody,
        badge: t.notifications.availableBadge,
        settingValue: t.notifications.available,
      };
  }
}

export function NotificationReadinessPanel({
  anchorId,
  embedded = false,
  language,
  surface = 'settings',
}: {
  anchorId?: string;
  embedded?: boolean;
  language: AppLanguage;
  surface?: 'activity' | 'home' | 'settings';
}) {
  const [readiness, setReadiness] = useState<NotificationReadiness | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = getTranslations(language);
  const isActivitySurface = embedded && surface === 'activity';

  useEffect(() => {
    let cancelled = false;

    void getNotificationReadiness().then((nextState) => {
      if (!cancelled) {
        setReadiness(nextState);
        setLastError(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const statusCopy = getStatusCopy(readiness, language);
  const permissionValue =
    readiness?.permission === 'unsupported'
      ? t.notifications.unavailable
      : readiness?.permission === 'granted'
        ? t.notifications.on
        : readiness?.permission === 'denied'
          ? t.notifications.off
          : t.notifications.checking;
  const deviceValue =
    readiness?.status === 'unsupported'
      ? t.notifications.unavailable
      : readiness?.subscriptionActive
        ? t.notifications.connected
        : t.notifications.notConnected;
  const detailNote = lastError
    ? lastError
    : readiness?.status === 'blocked'
      ? t.notifications.browserSettingsNote
      : readiness?.status === 'enabled'
        ? t.notifications.comingSoonNote
        : readiness?.status === 'available'
          ? readiness.permission === 'granted'
            ? t.notifications.permissionReadyNote
            : t.notifications.availableNote
          : readiness?.status === 'unconfigured'
            ? isActivitySurface
              ? null
              : t.notifications.notConfiguredNote
            : readiness?.status === 'unsupported'
              ? isActivitySurface
                ? null
                : statusCopy.body
              : null;

  return (
    <section
      id={anchorId}
      className={
        embedded
          ? surface === 'activity'
            ? 'stack settings-section settings-notification-section messenger-activity-notification-panel'
            : surface === 'home'
              ? 'stack settings-section settings-notification-section messenger-home-notification-panel'
            : 'stack settings-section settings-notification-section'
          : 'card stack settings-card'
      }
    >
      {isActivitySurface ? (
        <div className="stack messenger-activity-notification-header">
          <div className="messenger-activity-notification-topline">
            <div className="stack settings-card-copy settings-section-copy messenger-activity-notification-copy">
              <h2 className="section-title">{statusCopy.title}</h2>
              <p className="muted">{statusCopy.body}</p>
            </div>

            <span className="summary-pill messenger-activity-notification-badge">
              {statusCopy.badge}
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="stack settings-card-copy settings-section-copy">
            <h2 className="section-title">{statusCopy.title}</h2>
            <p className="muted">{t.notifications.subtitle}</p>
          </div>

          <div className="cluster settings-summary">
            <span className="summary-pill">{statusCopy.badge}</span>
          </div>
        </>
      )}

      <div
        className={
          isActivitySurface
            ? 'settings-capability-list messenger-activity-notification-status-list'
            : 'settings-capability-list'
        }
      >
        <div className="settings-capability-row">
          <span className="settings-capability-label">{t.notifications.status}</span>
          <span className="settings-capability-value">{statusCopy.settingValue}</span>
        </div>
        <div className="settings-capability-row">
          <span className="settings-capability-label">{t.notifications.permission}</span>
          <span className="settings-capability-value">{permissionValue}</span>
        </div>
        <div className="settings-capability-row">
          <span className="settings-capability-label">{t.notifications.device}</span>
          <span className="settings-capability-value">{deviceValue}</span>
        </div>
      </div>

      <div
        className={
          isActivitySurface
            ? 'settings-actions messenger-activity-notification-actions'
            : 'settings-actions'
        }
      >
        {readiness?.status === 'available' ? (
          <button
            className="button"
            disabled={isPending}
            type="button"
            onClick={() => {
              startTransition(async () => {
                try {
                  const nextState = await enableNotificationReadiness();
                  setReadiness(nextState);
                  setLastError(null);
                } catch {
                  setLastError(t.notifications.syncFailedNote);
                  setReadiness(await getNotificationReadiness());
                }
              });
            }}
          >
            {isPending ? t.notifications.turningOn : t.notifications.turnOn}
          </button>
        ) : null}

        {detailNote ? (
          <p
            className={
              isActivitySurface
                ? 'muted settings-note messenger-activity-notification-note'
                : 'muted settings-note'
            }
          >
            {detailNote}
          </p>
        ) : null}
      </div>
    </section>
  );
}
