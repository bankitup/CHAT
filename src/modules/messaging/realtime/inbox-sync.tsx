'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useTransition } from 'react';
import {
  hydrateInboxConversationSummaries,
  markInboxConversationRemoved,
  patchInboxConversationSummary,
  type InboxConversationLiveSummary,
} from './inbox-summary-store';
import {
  LOCAL_MESSAGE_COMMITTED_WINDOW_EVENT,
  MESSAGE_COMMITTED_BROADCAST_EVENT,
  type MessageCommittedPayload,
} from './live-refresh';

type InboxRealtimeSyncProps = {
  conversationIds: string[];
  initialSummaries: InboxConversationLiveSummary[];
  userId: string;
};

const INBOX_REFRESH_DEBOUNCE_MS = 220;
const INBOX_REFRESH_MIN_INTERVAL_MS = 1200;
const INBOX_VISIBILITY_REFRESH_MIN_HIDDEN_MS = 15000;

export function InboxRealtimeSync({
  conversationIds,
  initialSummaries,
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
    hydrateInboxConversationSummaries(initialSummaries);
  }, [initialSummaries]);

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

    const normalizeLatestMessageSeq = (value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }

      return null;
    };

    const fetchConversationSummary = async (conversationId: string) => {
      const response = await supabase
        .from('conversation_members')
        .select(
          'conversation_id, hidden_at, last_read_message_seq, last_read_at, conversations(id, created_at, last_message_at, last_message_id, last_message_seq, last_message_sender_id, last_message_kind, last_message_content_mode, last_message_deleted_at, last_message_body)',
        )
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (response.error) {
        throw response.error;
      }

      if (!response.data) {
        markInboxConversationRemoved(conversationId);
        return;
      }

      const conversationValue = Array.isArray(response.data.conversations)
        ? response.data.conversations[0] ?? null
        : response.data.conversations;
      const latestMessageSeq = normalizeLatestMessageSeq(
        conversationValue?.last_message_seq ?? null,
      );
      const lastReadMessageSeq =
        typeof response.data.last_read_message_seq === 'number'
          ? response.data.last_read_message_seq
          : null;
      const unreadCount =
        latestMessageSeq === null
          ? 0
          : lastReadMessageSeq === null
            ? latestMessageSeq
            : Math.max(0, latestMessageSeq - lastReadMessageSeq);

      patchInboxConversationSummary({
        conversationId,
        createdAt: conversationValue?.created_at ?? null,
        hiddenAt: response.data.hidden_at ?? null,
        lastMessageAt: conversationValue?.last_message_at ?? null,
        lastReadAt: response.data.last_read_at ?? null,
        lastReadMessageSeq,
        latestMessageBody: conversationValue?.last_message_body ?? null,
        latestMessageContentMode:
          conversationValue?.last_message_content_mode ?? null,
        latestMessageDeletedAt:
          conversationValue?.last_message_deleted_at ?? null,
        latestMessageId: conversationValue?.last_message_id ?? null,
        latestMessageKind: conversationValue?.last_message_kind ?? null,
        latestMessageSenderId:
          conversationValue?.last_message_sender_id ?? null,
        latestMessageSeq,
        removed: false,
        unreadCount,
      });
    };

    const syncConversationSummary = async (reason: string, conversationId: string) => {
      try {
        await fetchConversationSummary(conversationId);
        logDiagnostics('summary-patch:ok', { conversationId, reason });
      } catch (error) {
        logDiagnostics('summary-patch:error', {
          conversationId,
          message: error instanceof Error ? error.message : String(error),
          reason,
        });
        scheduleRefresh(`summary-patch-fallback:${reason}`);
      }
    };

    const syncTrackedConversationSummaries = async (reason: string) => {
      await Promise.all(
        normalizedConversationIds.map((conversationId) =>
          syncConversationSummary(reason, conversationId),
        ),
      );
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
        void syncTrackedConversationSummaries('visibility-visible');
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

      void syncConversationSummary('message-postgres', conversationId);
    };

    const scheduleMessageBroadcastRefresh = ({
      payload,
    }: {
      payload: MessageCommittedPayload;
    }) => {
      if (!payload.conversationId || !trackedConversationIds.has(payload.conversationId)) {
        return;
      }

      void syncConversationSummary('message-broadcast', payload.conversationId);
    };

    const handleLocalMessageCommitted = (event: Event) => {
      const detail = (event as CustomEvent<MessageCommittedPayload>).detail;

      if (!detail?.conversationId || !trackedConversationIds.has(detail.conversationId)) {
        return;
      }

      void syncConversationSummary('message-local', detail.conversationId);
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
      (payload) => {
        const nextRow = (payload.new ?? null) as
          | { conversation_id?: string | null }
          | null;
        const previousRow = (payload.old ?? null) as
          | { conversation_id?: string | null }
          | null;
        const conversationId =
          nextRow?.conversation_id ?? previousRow?.conversation_id ?? null;

        if (!conversationId || !trackedConversationIds.has(conversationId)) {
          return;
        }

        void syncConversationSummary('membership-postgres', conversationId);
      },
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
        () => {
          void syncConversationSummary('conversation-postgres', conversationId);
        },
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
    initialSummaries,
    normalizedConversationIds,
    router,
    startRefreshTransition,
    userId,
  ]);

  return null;
}
