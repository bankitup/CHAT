'use client';

import { useEffect } from 'react';
import { ensureDmE2eeDeviceRegistered } from './device-registration';

type DmE2eeBootstrapProps = {
  enabled: boolean;
  userId: string;
};

export function DmE2eeBootstrap({ enabled, userId }: DmE2eeBootstrapProps) {
  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      return () => {
        cancelled = true;
      };
    }

    void ensureDmE2eeDeviceRegistered(userId).catch((error: unknown) => {
      if (cancelled) {
        return;
      }

      console.error('DM E2EE bootstrap failed.', error);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);

  return null;
}
