'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';

type InboxRealtimeSyncProps = {
  conversationIds: string[];
  userId: string;
};

export function InboxRealtimeSync({
  conversationIds,
  userId,
}: InboxRealtimeSyncProps) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const trackedConversationIds = new Set(
      conversationIds.map((conversationId) => conversationId.trim()).filter(Boolean),
    );

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        return;
      }

      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        startRefreshTransition(() => {
          router.refresh();
        });
      }, 220);
    };

    const scheduleForegroundRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      scheduleRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh();
      }
    };

    const scheduleMessageRefresh = (payload: {
      new?: { conversation_id?: string | null } | null;
      old?: { conversation_id?: string | null } | null;
    }) => {
      const conversationId =
        payload.new?.conversation_id ?? payload.old?.conversation_id ?? null;

      if (!conversationId || !trackedConversationIds.has(conversationId)) {
        return;
      }

      scheduleRefresh();
    };

    const channel = supabase.channel(`inbox-sync:${userId}`);

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversation_members',
        filter: `user_id=eq.${userId}`,
      },
      scheduleRefresh,
    );

    for (const conversationId of conversationIds) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`,
        },
        scheduleRefresh,
      );
    }

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
      },
      scheduleMessageRefresh,
    );

    channel.subscribe();
    window.addEventListener('focus', scheduleForegroundRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      window.removeEventListener('focus', scheduleForegroundRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [conversationIds, router, startRefreshTransition, userId]);

  return null;
}
