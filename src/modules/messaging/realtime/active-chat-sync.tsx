'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';

type ActiveChatRealtimeSyncProps = {
  conversationId: string;
  messageIds: string[];
};

export function ActiveChatRealtimeSync({
  conversationId,
  messageIds,
}: ActiveChatRealtimeSyncProps) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const trackedMessageIds = new Set(
      messageIds.map((messageId) => messageId.trim()).filter(Boolean),
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
      }, 180);
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

    const scheduleReactionRefresh = (payload: {
      new?: { message_id?: string | null } | null;
      old?: { message_id?: string | null } | null;
    }) => {
      const messageId = payload.new?.message_id ?? payload.old?.message_id ?? null;

      if (!messageId || !trackedMessageIds.has(messageId)) {
        return;
      }

      scheduleRefresh();
    };

    const channel = supabase
      .channel(`chat-sync:${conversationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, scheduleRefresh)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${conversationId}`,
      }, scheduleRefresh)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_members',
        filter: `conversation_id=eq.${conversationId}`,
      }, scheduleRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, scheduleReactionRefresh)
      .subscribe();

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
  }, [conversationId, messageIds, router, startRefreshTransition]);

  return null;
}
