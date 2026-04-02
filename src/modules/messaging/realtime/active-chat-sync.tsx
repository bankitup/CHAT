'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

type ActiveChatRealtimeSyncProps = {
  conversationId: string;
  messageIds: string[];
};

export function ActiveChatRealtimeSync({
  conversationId,
  messageIds,
}: ActiveChatRealtimeSyncProps) {
  const router = useRouter();
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
        router.refresh();
        refreshTimeoutRef.current = null;
      }, 180);
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

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [conversationId, messageIds, router]);

  return null;
}
