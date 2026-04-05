'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useTransition } from 'react';
import {
  LOCAL_MESSAGE_COMMITTED_WINDOW_EVENT,
  MESSAGE_COMMITTED_BROADCAST_EVENT,
  type MessageCommittedPayload,
} from './live-refresh';

type InboxRealtimeSyncProps = {
  conversationIds: string[];
  userId: string;
};

const INBOX_REFRESH_DEBOUNCE_MS = 220;
const INBOX_REFRESH_MIN_INTERVAL_MS = 1200;
const INBOX_VISIBILITY_REFRESH_MIN_HIDDEN_MS = 15000;

export function InboxRealtimeSync({
  conversationIds,
  userId,
}: InboxRealtimeSyncProps) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();
  const normalizedConversationIds = useMemo(
    () =>
      Array.from(
        new Set(
          conversationIds
            .map((conversationId) => conversationId.trim())
            .filter(Boolean),
        ),
      ),
    [conversationIds],
  );
  const conversationIdsKey = normalizedConversationIds.join(',');
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1';

  useEffect(() => {
    if (!userId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const trackedConversationIds = new Set(normalizedConversationIds);

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

    const scheduleRefresh = (
      reason: string,
      options?: {
        force?: boolean;
      },
    ) => {
      const now = Date.now();

      if (
        !options?.force &&
        now - lastRefreshAtRef.current < INBOX_REFRESH_MIN_INTERVAL_MS
      ) {
        logDiagnostics('refresh-skipped:cooldown', { reason });
        return;
      }

      if (refreshTimeoutRef.current) {
        logDiagnostics('refresh-skipped:pending', { reason });
        return;
      }

      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        lastRefreshAtRef.current = Date.now();
        logDiagnostics('refresh:start', { reason });
        startRefreshTransition(() => {
          router.refresh();
        });
      }, INBOX_REFRESH_DEBOUNCE_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;

      if (
        hiddenAt !== null &&
        Date.now() - hiddenAt >= INBOX_VISIBILITY_REFRESH_MIN_HIDDEN_MS
      ) {
        scheduleRefresh('visibility-visible', { force: true });
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

    for (const conversationId of normalizedConversationIds) {
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
    const broadcastChannels = normalizedConversationIds.map((conversationId) =>
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
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener(
      LOCAL_MESSAGE_COMMITTED_WINDOW_EVENT,
      handleLocalMessageCommitted as EventListener,
    );

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

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
  }, [
    conversationIdsKey,
    diagnosticsEnabled,
    normalizedConversationIds,
    router,
    startRefreshTransition,
    userId,
  ]);

  return null;
}
