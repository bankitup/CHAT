'use client';

import { useEffect, useRef } from 'react';
import {
  clearAllLocalDmE2eeState,
  clearLocalDmE2eeStateForUser,
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

      try {
        await ensureDmE2eeDeviceRegistered(userId);
      } catch (error) {
        if (!cancelled) {
          console.error('DM E2EE bootstrap failed.', error);
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
    void clearAllLocalDmE2eeState();
  }, []);

  return null;
}
