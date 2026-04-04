'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

type InboxRealtimeSyncProps = {
  conversationIds: string[];
  userId: string;
};

export function InboxRealtimeSync({
  conversationIds,
  userId,
}: InboxRealtimeSyncProps) {
  const router = useRouter();
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
        router.refresh();
        refreshTimeoutRef.current = null;
      }, 220);
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

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [conversationIds, router, userId]);

  return null;
}
