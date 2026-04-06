'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  applyThreadReactionRealtimeEvent,
  patchThreadConversationReadState,
} from '@/modules/messaging/realtime/thread-live-state-store';
import {
  emitThreadHistorySyncRequest,
  LOCAL_THREAD_HISTORY_VISIBLE_MESSAGE_IDS_EVENT,
  type ThreadHistoryVisibleMessageIdsPayload,
} from '@/modules/messaging/realtime/thread-history-sync-events';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useTransition } from 'react';
import {
  LOCAL_MESSAGE_COMMITTED_WINDOW_EVENT,
  MESSAGE_COMMITTED_BROADCAST_EVENT,
  type MessageCommittedPayload,
} from './live-refresh';

type ActiveChatRealtimeSyncProps = {
  conversationId: string;
  currentUserId: string;
  messageIds: string[];
};

const THREAD_REFRESH_DEBOUNCE_MS = 180;
const THREAD_REFRESH_MIN_INTERVAL_MS = 900;
const THREAD_VISIBILITY_REFRESH_MIN_HIDDEN_MS = 15000;

export function ActiveChatRealtimeSync({
  conversationId,
  currentUserId,
  messageIds,
}: ActiveChatRealtimeSyncProps) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();
  const normalizedMessageIds = useMemo(
    () =>
      Array.from(
        new Set(messageIds.map((messageId) => messageId.trim()).filter(Boolean)),
      ),
    [messageIds],
  );
  const messageIdsKey = normalizedMessageIds.join(',');
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);
  const trackedMessageIdsRef = useRef(new Set(normalizedMessageIds));
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1';

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    trackedMessageIdsRef.current = new Set(normalizedMessageIds);

    const logDiagnostics = (stage: string, details?: Record<string, unknown>) => {
      if (!diagnosticsEnabled) {
        return;
      }

      if (details) {
        console.info('[chat-live-sync]', stage, details);
        return;
      }

      console.info('[chat-live-sync]', stage);
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
        now - lastRefreshAtRef.current < THREAD_REFRESH_MIN_INTERVAL_MS
      ) {
        logDiagnostics('refresh-skipped:cooldown', { conversationId, reason });
        return;
      }

      if (refreshTimeoutRef.current) {
        logDiagnostics('refresh-skipped:pending', { conversationId, reason });
        return;
      }

      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        lastRefreshAtRef.current = Date.now();
        logDiagnostics('refresh:start', { conversationId, reason });
        startRefreshTransition(() => {
          router.refresh();
        });
      }, THREAD_REFRESH_DEBOUNCE_MS);
    };

    const requestTopologySync = (input: {
      messageIds?: string[] | null;
      newerThanLatest?: boolean;
      reason: string;
    }) => {
      emitThreadHistorySyncRequest({
        conversationId,
        messageIds: input.messageIds ?? null,
        newerThanLatest: input.newerThanLatest,
        reason: input.reason,
      });
      logDiagnostics('topology-sync:requested', {
        conversationId,
        messageIds: input.messageIds ?? null,
        newerThanLatest: Boolean(input.newerThanLatest),
        reason: input.reason,
      });
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
        Date.now() - hiddenAt >= THREAD_VISIBILITY_REFRESH_MIN_HIDDEN_MS
      ) {
        requestTopologySync({
          newerThanLatest: true,
          reason: 'visibility-visible',
        });
      }
    };

    const scheduleReactionRefresh = (payload: {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      new?: { message_id?: string | null } | null;
      old?: { message_id?: string | null } | null;
    }) => {
      const messageId = payload.new?.message_id ?? payload.old?.message_id ?? null;

      if (!messageId || !trackedMessageIdsRef.current.has(messageId)) {
        return;
      }

      applyThreadReactionRealtimeEvent({
        conversationId,
        currentUserId,
        eventType: payload.eventType,
        newRow: payload.new,
        oldRow: payload.old,
      });
    };

    const scheduleMessageBroadcastRefresh = ({
      payload,
    }: {
      payload: MessageCommittedPayload;
    }) => {
      if (payload.conversationId !== conversationId) {
        return;
      }

      requestTopologySync({
        messageIds: payload.messageId ? [payload.messageId] : null,
        newerThanLatest: !payload.messageId,
        reason: 'message-broadcast',
      });
    };

    const handleLocalMessageCommitted = (event: Event) => {
      const detail = (event as CustomEvent<MessageCommittedPayload>).detail;

      if (!detail || detail.conversationId !== conversationId) {
        return;
      }

      if (
        detail.source === 'plaintext-chat-send' ||
        detail.source === 'encrypted-dm-send'
      ) {
        logDiagnostics('topology-sync:local-committed-suppressed', {
          clientId: detail.clientId ?? null,
          conversationId,
          messageId: detail.messageId ?? null,
          reason: detail.source,
        });
        return;
      }

      requestTopologySync({
        messageIds: detail.messageId ? [detail.messageId] : null,
        newerThanLatest: !detail.messageId,
        reason: 'message-local-committed',
      });
    };

    const handleVisibleMessageIds = (event: Event) => {
      const detail = (event as CustomEvent<ThreadHistoryVisibleMessageIdsPayload>).detail;

      if (!detail || detail.conversationId !== conversationId) {
        return;
      }

      trackedMessageIdsRef.current = new Set(detail.messageIds);
    };

    const channel = supabase
      .channel(`chat-sync:${conversationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const nextRow =
          payload.new && typeof payload.new === 'object'
            ? (payload.new as Record<string, unknown>)
            : null;
        const previousRow =
          payload.old && typeof payload.old === 'object'
            ? (payload.old as Record<string, unknown>)
            : null;
        const messageId =
          typeof nextRow?.id === 'string'
            ? nextRow.id
            : typeof previousRow?.id === 'string'
              ? previousRow.id
              : null;

        requestTopologySync({
          messageIds: messageId ? [messageId] : null,
          newerThanLatest: !messageId,
          reason: `message-postgres:${payload.eventType.toLowerCase()}`,
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${conversationId}`,
      }, () => scheduleRefresh('conversation-postgres'))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_members',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const userId =
          typeof payload.new?.user_id === 'string'
            ? payload.new.user_id
            : typeof payload.old?.user_id === 'string'
              ? payload.old.user_id
              : null;
        const lastReadMessageSeq =
          typeof payload.new?.last_read_message_seq === 'number'
            ? payload.new.last_read_message_seq
            : typeof payload.old?.last_read_message_seq === 'number'
              ? payload.old.last_read_message_seq
              : null;

        if (!userId) {
          scheduleRefresh('membership-postgres:fallback');
          return;
        }

        patchThreadConversationReadState({
          conversationId,
          isCurrentUser: userId === currentUserId,
          lastReadMessageSeq,
        });
      })
      .on('broadcast', {
        event: MESSAGE_COMMITTED_BROADCAST_EVENT,
      }, scheduleMessageBroadcastRefresh)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) =>
          scheduleReactionRefresh({
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
          }),
      )
      .subscribe();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener(
      LOCAL_MESSAGE_COMMITTED_WINDOW_EVENT,
      handleLocalMessageCommitted as EventListener,
    );
    window.addEventListener(
      LOCAL_THREAD_HISTORY_VISIBLE_MESSAGE_IDS_EVENT,
      handleVisibleMessageIds as EventListener,
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
      window.removeEventListener(
        LOCAL_THREAD_HISTORY_VISIBLE_MESSAGE_IDS_EVENT,
        handleVisibleMessageIds as EventListener,
      );
      void supabase.removeChannel(channel);
    };
  }, [
    conversationId,
    currentUserId,
    diagnosticsEnabled,
    messageIdsKey,
    normalizedMessageIds,
    router,
    startRefreshTransition,
  ]);

  return null;
}
