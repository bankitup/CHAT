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
        body: t.notifications.availableBody,
        badge: t.notifications.availableBadge,
        settingValue: t.notifications.available,
      };
  }
}

export function NotificationReadinessPanel({
  embedded = false,
  language,
}: {
  embedded?: boolean;
  language: AppLanguage;
}) {
  const [readiness, setReadiness] = useState<NotificationReadiness | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = getTranslations(language);

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

  const statusCopy = getStatusCopy(readiness, language);

  return (
    <section
      className={
        embedded
          ? 'stack settings-section settings-notification-section'
          : 'card stack settings-card'
      }
    >
      <div className="stack settings-card-copy settings-section-copy">
        <h2 className="section-title">{statusCopy.title}</h2>
        <p className="muted">{t.notifications.subtitle}</p>
      </div>

      <div className="cluster settings-summary">
        <span className="summary-pill">{statusCopy.badge}</span>
      </div>

      <div className="settings-capability-list">
        <div className="settings-capability-row">
          <span className="settings-capability-label">{t.notifications.status}</span>
          <span className="settings-capability-value">{statusCopy.settingValue}</span>
        </div>
        <div className="settings-capability-row">
          <span className="settings-capability-label">{t.notifications.permission}</span>
          <span className="settings-capability-value">
            {readiness?.permission === 'unsupported'
              ? t.notifications.unavailable
              : readiness?.permission === 'granted'
                ? t.notifications.on
                : readiness?.permission === 'denied'
                  ? t.notifications.off
                  : t.notifications.checking}
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
            {isPending ? t.notifications.turningOn : t.notifications.turnOn}
          </button>
        ) : null}

        {readiness?.status === 'blocked' ? (
          <p className="muted settings-note">
            {t.notifications.browserSettingsNote}
          </p>
        ) : null}

        {readiness?.status === 'enabled' ? (
          <p className="muted settings-note">
            {t.notifications.comingSoonNote}
          </p>
        ) : null}

        {readiness?.status === 'available' ? (
          <p className="muted settings-note">
            {t.notifications.availableNote}
          </p>
        ) : null}

        {readiness?.status === 'unsupported' ? (
          <p className="muted settings-note">{statusCopy.body}</p>
        ) : null}
      </div>
    </section>
  );
}
