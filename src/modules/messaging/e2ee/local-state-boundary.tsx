'use client';

import { useEffect, useRef } from 'react';
import {
  clearLocalDmE2eeStateForUser,
  clearLocalDmE2eePublicSessionArtifacts,
  clearAllLocalDmE2eeState,
  keepOnlyLocalDmE2eeStateForUser,
  reinitializeLocalDmE2eeStateForUser,
} from './lifecycle';
import { getLocalDmE2eeDeviceRecord } from './device-store';
import {
  ensureDmE2eeDeviceRegistered,
  inspectCurrentUserDmE2eeDeviceState,
  isCurrentDmE2eeDeviceInspectionReady,
} from './device-registration';

function shouldLogDmE2eeBoundaryDiagnostics() {
  return (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
  );
}

function logDmE2eeBoundaryDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!shouldLogDmE2eeBoundaryDiagnostics()) {
    return;
  }

  if (details) {
    console.info('[dm-e2ee-boundary]', stage, details);
    return;
  }

  console.info('[dm-e2ee-boundary]', stage);
}

export function DmE2eeAuthenticatedBoundary({
  enabled,
  userId,
}: {
  enabled: boolean;
  userId: string;
}) {
  const previousUserIdRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const recoveryAttemptedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const clearRetryTimeout = () => {
      if (retryTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    const scheduleRetry = () => {
      if (typeof window === 'undefined' || retryTimeoutRef.current !== null) {
        return;
      }

      retryTimeoutRef.current = window.setTimeout(() => {
        retryTimeoutRef.current = null;

        if (cancelled || !enabled) {
          return;
        }

        void runBootstrap('delayed-retry');
      }, 1800);
    };

    const runBootstrap = async (
      reason: 'initial' | 'focus' | 'visibility' | 'delayed-retry',
    ) => {
      try {
        const bootstrap = await ensureDmE2eeDeviceRegistered(userId, {
          forcePublish: reason !== 'initial',
        });

        if (bootstrap.status === 'registered') {
          const localRecord = await getLocalDmE2eeDeviceRecord(userId);
          const inspection = await inspectCurrentUserDmE2eeDeviceState();
          const isReady = isCurrentDmE2eeDeviceInspectionReady({
            inspection,
            serverDeviceRecordId: localRecord?.serverDeviceRecordId ?? null,
          });

          logDmE2eeBoundaryDiagnostics('inspect:post-bootstrap', {
            activeDeviceRowCount:
              inspection.status === 'ok'
                ? inspection.state.activeDeviceRowCount
                : null,
            availableOneTimePrekeyCount:
              inspection.status === 'ok'
                ? inspection.state.availableOneTimePrekeyCount
                : null,
            hasSignedPrekey:
              inspection.status === 'ok' ? inspection.state.hasSignedPrekey : null,
            isReady,
            reason,
            serverDeviceRecordId: localRecord?.serverDeviceRecordId ?? null,
            userId,
          });

          if (
            !isReady &&
            recoveryAttemptedForUserRef.current !== userId &&
            inspection.status === 'ok'
          ) {
            recoveryAttemptedForUserRef.current = userId;
            logDmE2eeBoundaryDiagnostics('recover:start', {
              activeDeviceRowCount: inspection.state.activeDeviceRowCount,
              availableOneTimePrekeyCount:
                inspection.state.availableOneTimePrekeyCount,
              hasSignedPrekey: inspection.state.hasSignedPrekey,
              reason,
              userId,
            });

            const recovery = await reinitializeLocalDmE2eeStateForUser(userId);
            const recoveredLocalRecord =
              await getLocalDmE2eeDeviceRecord(userId);
            const recoveredInspection =
              await inspectCurrentUserDmE2eeDeviceState();
            const recoveredReady = isCurrentDmE2eeDeviceInspectionReady({
              inspection: recoveredInspection,
              serverDeviceRecordId:
                recoveredLocalRecord?.serverDeviceRecordId ?? null,
            });

            logDmE2eeBoundaryDiagnostics('recover:done', {
              activeDeviceRowCount:
                recoveredInspection.status === 'ok'
                  ? recoveredInspection.state.activeDeviceRowCount
                  : null,
              availableOneTimePrekeyCount:
                recoveredInspection.status === 'ok'
                  ? recoveredInspection.state.availableOneTimePrekeyCount
                  : null,
              hasSignedPrekey:
                recoveredInspection.status === 'ok'
                  ? recoveredInspection.state.hasSignedPrekey
                  : null,
              recoveredReady,
              recoveryStatus: recovery.status,
              serverDeviceRecordId:
                recoveredLocalRecord?.serverDeviceRecordId ?? null,
              userId,
            });
          }
        }

        clearRetryTimeout();
      } catch (error) {
        if (!cancelled) {
          console.error('DM E2EE boundary step failed.', error);
          scheduleRetry();
        }
      }
    };

    const handleFocus = () => {
      if (!enabled || cancelled) {
        return;
      }

      void runBootstrap('focus');
    };

    const handleVisibilityChange = () => {
      if (
        !enabled ||
        cancelled ||
        typeof document === 'undefined' ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }

      void runBootstrap('visibility');
    };

    void (async () => {
      try {
        const previousUserId = previousUserIdRef.current;

        if (previousUserId && previousUserId !== userId) {
          await clearAllLocalDmE2eeState();
        }

        previousUserIdRef.current = userId;
        recoveryAttemptedForUserRef.current = null;
        await keepOnlyLocalDmE2eeStateForUser(userId);

        if (!enabled) {
          await clearLocalDmE2eeStateForUser(userId);
          return;
        }

        await runBootstrap('initial');

        if (typeof window !== 'undefined') {
          window.addEventListener('focus', handleFocus);
        }

        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', handleVisibilityChange);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('DM E2EE boundary step failed.', error);
          scheduleRetry();
        }
      }
    })();

    return () => {
      cancelled = true;
      clearRetryTimeout();

      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [enabled, userId]);

  return null;
}

export function DmE2eePublicBoundaryCleanup() {
  useEffect(() => {
    // Preserve per-user device keys across a normal relogin on the same browser.
    // Public routes should only clear decrypted preview cache, not IndexedDB keys.
    void clearLocalDmE2eePublicSessionArtifacts().catch((error) => {
      console.error('DM E2EE public cleanup failed.', error);
    });
  }, []);

  return null;
}
