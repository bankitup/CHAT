'use client';

import {
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import {
  enableNotificationReadiness,
  getNotificationReadiness,
  sendNotificationReadinessTest,
  type NotificationReadiness,
} from '@/modules/messaging/sdk/notifications';
import { supportsAppBadge } from '@/modules/messaging/sdk/badge';
import { subscribeToChatUnreadBadgeRefresh } from '@/modules/messaging/push/chat-unread-badge-events';
import { useEffect, useState, useTransition } from 'react';

type ChatUnreadBadgeResponse = {
  mutedExcluded: boolean;
  unreadCount: number;
};

async function getUnreadBadgeState(signal?: AbortSignal) {
  const response = await fetch('/api/messaging/unread-badge', {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error('Unable to load unread badge state right now.');
  }

  return (await response.json()) as ChatUnreadBadgeResponse;
}

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
  allowTestSend = false,
  anchorId,
  embedded = false,
  language,
  surface = 'settings',
  testSpaceId,
}: {
  allowTestSend?: boolean;
  anchorId?: string;
  embedded?: boolean;
  language: AppLanguage;
  surface?: 'activity' | 'home' | 'settings';
  testSpaceId?: string | null;
}) {
  const [readiness, setReadiness] = useState<NotificationReadiness | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    message: string;
  } | null>(null);
  const [badgeUnreadCount, setBadgeUnreadCount] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<'enable' | 'test' | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = getTranslations(language);
  const isActivitySurface = embedded && surface === 'activity';
  const badgeSupported = supportsAppBadge();

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;

    const refreshReadiness = async () => {
      const nextState = await getNotificationReadiness();

      if (!cancelled) {
        setReadiness(nextState);
        setFeedback(null);
      }
    };

    const refreshBadgeState = async () => {
      controller?.abort();

      if (!badgeSupported) {
        if (!cancelled) {
          setBadgeUnreadCount(0);
        }
        return;
      }

      controller = new AbortController();

      try {
        const nextState = await getUnreadBadgeState(controller.signal);

        if (!cancelled) {
          setBadgeUnreadCount(nextState.unreadCount);
        }
      } catch (error) {
        if (
          cancelled ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }

        if (!cancelled) {
          setBadgeUnreadCount(null);
        }
      }
    };

    const refreshAll = () => {
      void refreshReadiness();
      void refreshBadgeState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAll();
      }
    };

    const handleFocus = () => {
      refreshAll();
    };

    refreshAll();

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const unsubscribeBadgeRefresh = subscribeToChatUnreadBadgeRefresh(() => {
      void refreshBadgeState();
    });

    return () => {
      cancelled = true;
      controller?.abort();
      unsubscribeBadgeRefresh();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [badgeSupported]);

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
      : readiness?.deviceRegistered
        ? t.notifications.connected
        : t.notifications.notConnected;
  const testValue = !allowTestSend
    ? t.notifications.unavailable
    : readiness?.status === 'enabled'
      ? t.notifications.ready
      : readiness?.status === 'available'
        ? t.notifications.enableFirst
        : readiness
          ? t.notifications.unavailable
          : t.notifications.checking;
  const badgeValue = !badgeSupported
    ? t.notifications.unavailable
    : badgeUnreadCount === null
      ? t.notifications.checking
      : badgeUnreadCount > 0
        ? t.notifications.unreadCount(badgeUnreadCount)
        : t.notifications.ready;
  const primaryActionLabel =
    readiness?.permission === 'granted'
      ? t.notifications.connectDevice
      : t.notifications.turnOn;
  const pendingActionLabel =
    readiness?.permission === 'granted'
      ? t.notifications.connectingDevice
      : t.notifications.turningOn;
  const detailNote = feedback?.message
    ? feedback.message
    : readiness?.status === 'blocked'
      ? t.notifications.browserSettingsNote
      : readiness?.status === 'enabled'
        ? allowTestSend
          ? t.notifications.testReadyNote
          : t.notifications.comingSoonNote
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
        {isActivitySurface ? (
          <>
            <div className="settings-capability-row">
              <span className="settings-capability-label">{t.notifications.permission}</span>
              <span className="settings-capability-value">{permissionValue}</span>
            </div>
            <div className="settings-capability-row">
              <span className="settings-capability-label">{t.notifications.device}</span>
              <span className="settings-capability-value">{deviceValue}</span>
            </div>
            <div className="settings-capability-row">
              <span className="settings-capability-label">{t.notifications.test}</span>
              <span className="settings-capability-value">{testValue}</span>
            </div>
            <div className="settings-capability-row">
              <span className="settings-capability-label">{t.notifications.badge}</span>
              <span className="settings-capability-value">{badgeValue}</span>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
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
              setPendingAction('enable');
              startTransition(async () => {
                try {
                  const nextState = await enableNotificationReadiness();
                  setReadiness(nextState);
                  setFeedback(null);
                } catch {
                  setFeedback({
                    kind: 'error',
                    message: t.notifications.syncFailedNote,
                  });
                  setReadiness(await getNotificationReadiness());
                } finally {
                  setPendingAction(null);
                }
              });
            }}
          >
            {isPending && pendingAction === 'enable'
              ? pendingActionLabel
              : primaryActionLabel}
          </button>
        ) : null}

        {allowTestSend && readiness?.status === 'enabled' ? (
          <button
            className="button button-secondary"
            disabled={isPending}
            type="button"
            onClick={() => {
              setPendingAction('test');
              startTransition(async () => {
                try {
                  await sendNotificationReadinessTest({
                    spaceId: testSpaceId ?? null,
                  });
                  setFeedback({
                    kind: 'success',
                    message: t.notifications.testSentNote,
                  });
                } catch (error) {
                  setFeedback({
                    kind: 'error',
                    message:
                      error instanceof Error && error.message.trim().length > 0
                        ? error.message
                        : t.notifications.testFailedNote,
                  });
                } finally {
                  setPendingAction(null);
                }
              });
            }}
          >
            {isPending && pendingAction === 'test'
              ? t.notifications.sendingTest
              : t.notifications.sendTest}
          </button>
        ) : null}

        {detailNote ? (
          <p
            className={
              [
                isActivitySurface
                  ? 'muted settings-note messenger-activity-notification-note'
                  : 'muted settings-note',
                feedback?.kind === 'success'
                  ? 'messenger-activity-notification-note-feedback messenger-activity-notification-note-success'
                  : null,
                feedback?.kind === 'error'
                  ? 'messenger-activity-notification-note-feedback messenger-activity-notification-note-error'
                  : null,
              ]
                .filter(Boolean)
                .join(' ')
            }
          >
            {detailNote}
          </p>
        ) : null}
      </div>
    </section>
  );
}
