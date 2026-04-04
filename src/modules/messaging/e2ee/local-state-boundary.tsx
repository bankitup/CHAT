'use client';

import { useEffect, useRef } from 'react';
import {
  clearLocalDmE2eeStateForUser,
  clearLocalDmE2eePublicSessionArtifacts,
  clearAllLocalDmE2eeState,
  keepOnlyLocalDmE2eeStateForUser,
} from './lifecycle';
import { ensureDmE2eeDeviceRegistered } from './device-registration';

export function DmE2eeAuthenticatedBoundary({
  enabled,
  userId,
}: {
  enabled: boolean;
  userId: string;
}) {
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const previousUserId = previousUserIdRef.current;

        if (previousUserId && previousUserId !== userId) {
          await clearAllLocalDmE2eeState();
        }

        previousUserIdRef.current = userId;
        await keepOnlyLocalDmE2eeStateForUser(userId);

        if (!enabled) {
          await clearLocalDmE2eeStateForUser(userId);
          return;
        }

        await ensureDmE2eeDeviceRegistered(userId);
      } catch (error) {
        if (!cancelled) {
          console.error('DM E2EE boundary step failed.', error);
        }
      }
    })();

    return () => {
      cancelled = true;
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
