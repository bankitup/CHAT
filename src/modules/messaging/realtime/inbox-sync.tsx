'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import {
  LOCAL_MESSAGE_COMMITTED_WINDOW_EVENT,
  MESSAGE_COMMITTED_BROADCAST_EVENT,
  type MessageCommittedPayload,
} from './live-refresh';

type InboxRealtimeSyncProps = {
  conversationIds: string[];
  userId: string;
};

const INBOX_REFRESH_POLL_MS = 5000;

export function InboxRealtimeSync({
  conversationIds,
  userId,
}: InboxRealtimeSyncProps) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1';

  useEffect(() => {
    if (!userId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const trackedConversationIds = new Set(
      conversationIds.map((conversationId) => conversationId.trim()).filter(Boolean),
    );

    const logDiagnostics = (stage: string, details?: Record<string, unknown>) => {
      if (!diagnosticsEnabled) {
        return;
      }

      if (details) {
        console.info('[inbox-live-sync]', stage, details);
        return;
      }

      console.info('[inbox-live-sync]', stage);
    };

    const scheduleRefresh = (reason: string) => {
      if (refreshTimeoutRef.current) {
        logDiagnostics('refresh-skipped:pending', { reason });
        return;
      }

      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        logDiagnostics('refresh:start', { reason });
        startRefreshTransition(() => {
          router.refresh();
        });
      }, 220);
    };

    const scheduleForegroundRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      scheduleRefresh('foreground');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh('visibility-visible');
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

      scheduleRefresh('message-postgres');
    };

    const scheduleMessageBroadcastRefresh = ({
      payload,
    }: {
      payload: MessageCommittedPayload;
    }) => {
      if (!payload.conversationId || !trackedConversationIds.has(payload.conversationId)) {
        return;
      }

      scheduleRefresh('message-broadcast');
    };

    const handleLocalMessageCommitted = (event: Event) => {
      const detail = (event as CustomEvent<MessageCommittedPayload>).detail;

      if (!detail?.conversationId || !trackedConversationIds.has(detail.conversationId)) {
        return;
      }

      scheduleRefresh('message-local');
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
      () => scheduleRefresh('membership-postgres'),
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
        () => scheduleRefresh('conversation-postgres'),
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
    const broadcastChannels = conversationIds.map((conversationId) =>
      supabase
        .channel(`chat-sync:${conversationId}`)
        .on(
          'broadcast',
          {
            event: MESSAGE_COMMITTED_BROADCAST_EVENT,
          },
          scheduleMessageBroadcastRefresh,
        )
        .subscribe(),
    );
    window.addEventListener('focus', scheduleForegroundRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener(
      LOCAL_MESSAGE_COMMITTED_WINDOW_EVENT,
      handleLocalMessageCommitted as EventListener,
    );
    const pollIntervalId = window.setInterval(() => {
      scheduleForegroundRefresh();
    }, INBOX_REFRESH_POLL_MS);

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      window.clearInterval(pollIntervalId);
      window.removeEventListener('focus', scheduleForegroundRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(
        LOCAL_MESSAGE_COMMITTED_WINDOW_EVENT,
        handleLocalMessageCommitted as EventListener,
      );
      for (const broadcastChannel of broadcastChannels) {
        void supabase.removeChannel(broadcastChannel);
      }
      void supabase.removeChannel(channel);
    };
  }, [conversationIds, diagnosticsEnabled, router, startRefreshTransition, userId]);

  return null;
}
