'use client';

import { useEffect } from 'react';
import type { InboxPreviewDisplayMode } from '@/modules/messaging/inbox/preferences';
import { syncCurrentPushSubscriptionPresence } from '@/modules/messaging/sdk/notifications';

export function InboxPreviewPushSync(input: {
  previewMode: InboxPreviewDisplayMode;
}) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    void syncCurrentPushSubscriptionPresence({
      activeConversationId: null,
      activeInApp: document.visibilityState === 'visible',
      previewMode: input.previewMode,
    });
  }, [input.previewMode]);

  return null;
}
