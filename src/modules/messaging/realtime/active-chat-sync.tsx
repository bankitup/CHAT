'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  applyThreadReactionRealtimeEvent,
  patchThreadConversationReadState,
} from '@/modules/messaging/realtime/thread-live-state-store';
import { patchThreadMessageContent } from '@/modules/messaging/realtime/thread-message-patch-store';
import { noteWarmNavRouterRefresh } from '@/modules/messaging/performance/warm-nav-client';
import {
  emitThreadHistoryLiveMessage,
  emitThreadHistorySyncRequest,
  LOCAL_THREAD_HISTORY_VISIBLE_MESSAGE_IDS_EVENT,
  type ThreadHistoryLiveMessagePayload,
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
const CONVERSATION_SUMMARY_ONLY_KEYS = new Set([
  'last_message_at',
  'last_message_body',
  'last_message_content_mode',
  'last_message_deleted_at',
  'last_message_id',
  'last_message_kind',
  'last_message_sender_id',
  'last_message_seq',
  'updated_at',
]);
const CONVERSATION_ROUTE_REFRESH_CRITICAL_KEYS = new Set(['kind']);
const THREAD_VISIBLE_MESSAGE_PATCH_ONLY_KEYS = new Set([
  'body',
  'deleted_at',
  'edited_at',
]);
const MEMBERSHIP_ROUTE_REFRESH_CRITICAL_STATES = new Set([
  'left',
  'removed',
  'blocked',
]);

function getChangedRealtimeRecordKeys(
  nextRow: Record<string, unknown> | null,
  previousRow: Record<string, unknown> | null,
) {
  const keys = new Set([
    ...Object.keys(nextRow ?? {}),
    ...Object.keys(previousRow ?? {}),
  ]);

  return Array.from(keys).filter((key) => {
    const nextValue = nextRow?.[key];
    const previousValue = previousRow?.[key];

    if (Array.isArray(nextValue) || Array.isArray(previousValue)) {
      return JSON.stringify(nextValue) !== JSON.stringify(previousValue);
    }

    return nextValue !== previousValue;
  });
}

function getNullableRealtimeString(
  nextRow: Record<string, unknown> | null,
  previousRow: Record<string, unknown> | null,
  key: string,
) {
  const nextValue = nextRow?.[key];

  if (typeof nextValue === 'string') {
    return nextValue;
  }

  if (nextValue === null) {
    return null;
  }

  const previousValue = previousRow?.[key];

  if (typeof previousValue === 'string') {
    return previousValue;
  }

  if (previousValue === null) {
    return null;
  }

  return undefined;
}

function getNullableRealtimeNumber(
  nextRow: Record<string, unknown> | null,
  previousRow: Record<string, unknown> | null,
  key: string,
) {
  const nextValue = nextRow?.[key];

  if (typeof nextValue === 'number' && Number.isFinite(nextValue)) {
    return nextValue;
  }

  if (nextValue === null) {
    return null;
  }

  const previousValue = previousRow?.[key];

  if (typeof previousValue === 'number' && Number.isFinite(previousValue)) {
    return previousValue;
  }

  if (previousValue === null) {
    return null;
  }

  return undefined;
}

function didRealtimeFieldActuallyChange(
  nextRow: Record<string, unknown> | null,
  previousRow: Record<string, unknown> | null,
  key: string,
) {
  if (!nextRow || !previousRow) {
    return false;
  }

  if (
    !Object.prototype.hasOwnProperty.call(nextRow, key) ||
    !Object.prototype.hasOwnProperty.call(previousRow, key)
  ) {
    return false;
  }

  return nextRow[key] !== previousRow[key];
}

function normalizeRealtimeConversationMessageRow(input: {
  conversationId: string;
  row: Record<string, unknown> | null;
}): ThreadHistoryLiveMessagePayload['message'] | null {
  const messageId =
    typeof input.row?.id === 'string' ? input.row.id.trim() : '';
  const conversationId =
    typeof input.row?.conversation_id === 'string' &&
    input.row.conversation_id.trim().length > 0
      ? input.row.conversation_id.trim()
      : input.conversationId;
  const kind =
    typeof input.row?.kind === 'string' ? input.row.kind.trim() : '';
  const seq = input.row?.seq;

  if (
    !messageId ||
    !conversationId ||
    !kind ||
    !(
      (typeof seq === 'number' && Number.isFinite(seq)) ||
      (typeof seq === 'string' && seq.trim().length > 0)
    )
  ) {
    return null;
  }

  return {
    body: typeof input.row?.body === 'string' ? input.row.body : null,
    client_id:
      typeof input.row?.client_id === 'string' ? input.row.client_id : null,
    content_mode:
      typeof input.row?.content_mode === 'string'
        ? input.row.content_mode
        : input.row?.content_mode === null
          ? null
          : undefined,
    conversation_id: conversationId,
    created_at:
      typeof input.row?.created_at === 'string' ? input.row.created_at : null,
    deleted_at:
      typeof input.row?.deleted_at === 'string' ? input.row.deleted_at : null,
    edited_at:
      typeof input.row?.edited_at === 'string' ? input.row.edited_at : null,
    id: messageId,
    kind,
    reply_to_message_id:
      typeof input.row?.reply_to_message_id === 'string'
        ? input.row.reply_to_message_id
        : null,
    sender_device_id:
      typeof input.row?.sender_device_id === 'string'
        ? input.row.sender_device_id
        : input.row?.sender_device_id === null
          ? null
          : undefined,
    sender_id:
      typeof input.row?.sender_id === 'string' ? input.row.sender_id : null,
    seq,
  };
}

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
        noteWarmNavRouterRefresh('chat', reason, {
          conversationId,
          trackedMessageCount: normalizedMessageIds.length,
        });
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
        const changedKeys = getChangedRealtimeRecordKeys(nextRow, previousRow);
        const isVisibleMessagePatchOnlyUpdate =
          payload.eventType === 'UPDATE' &&
          messageId !== null &&
          trackedMessageIdsRef.current.has(messageId) &&
          changedKeys.length > 0 &&
          changedKeys.every((key) => THREAD_VISIBLE_MESSAGE_PATCH_ONLY_KEYS.has(key));

        if (isVisibleMessagePatchOnlyUpdate && messageId) {
          patchThreadMessageContent({
            body: getNullableRealtimeString(nextRow, previousRow, 'body'),
            conversationId,
            deletedAt: getNullableRealtimeString(
              nextRow,
              previousRow,
              'deleted_at',
            ),
            editedAt: getNullableRealtimeString(
              nextRow,
              previousRow,
              'edited_at',
            ),
            messageId,
          });
          logDiagnostics('message-postgres:visible-patch-local', {
            changedKeys,
            conversationId,
            messageId,
          });
          return;
        }

        if (payload.eventType === 'INSERT') {
          const liveMessage = normalizeRealtimeConversationMessageRow({
            conversationId,
            row: nextRow,
          });

          if (liveMessage) {
            emitThreadHistoryLiveMessage({
              conversationId,
              message: liveMessage,
              reason: 'message-postgres:insert',
            });
            logDiagnostics('message-postgres:live-insert-local', {
              conversationId,
              messageId: liveMessage.id,
              seq: liveMessage.seq,
            });
          } else {
            logDiagnostics('message-postgres:live-insert-skipped', {
              changedKeys,
              conversationId,
              messageId,
            });
          }
        }

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
      }, (payload) => {
        const nextRow =
          payload.new && typeof payload.new === 'object'
            ? (payload.new as Record<string, unknown>)
            : null;
        const previousRow =
          payload.old && typeof payload.old === 'object'
            ? (payload.old as Record<string, unknown>)
            : null;
        const changedKeys = getChangedRealtimeRecordKeys(nextRow, previousRow);

        if (
          changedKeys.length > 0 &&
          changedKeys.every((key) => CONVERSATION_SUMMARY_ONLY_KEYS.has(key))
        ) {
          logDiagnostics('conversation-postgres:summary-suppressed', {
            changedKeys,
            conversationId,
          });
          return;
        }

        const refreshCriticalKeys = Array.from(
          CONVERSATION_ROUTE_REFRESH_CRITICAL_KEYS,
        ).filter((key) =>
          didRealtimeFieldActuallyChange(nextRow, previousRow, key),
        );

        if (refreshCriticalKeys.length === 0) {
          logDiagnostics('conversation-postgres:metadata-suppressed', {
            changedKeys,
            conversationId,
          });
          return;
        }

        scheduleRefresh('conversation-postgres:metadata-critical');
      })
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
        const nextRow =
          payload.new && typeof payload.new === 'object'
            ? (payload.new as Record<string, unknown>)
            : null;
        const previousRow =
          payload.old && typeof payload.old === 'object'
            ? (payload.old as Record<string, unknown>)
            : null;
        const changedKeys = getChangedRealtimeRecordKeys(nextRow, previousRow);
        const stateChanged = changedKeys.includes('state');
        const lastReadChanged = changedKeys.includes('last_read_message_seq');
        const nextMembershipState = getNullableRealtimeString(
          nextRow,
          previousRow,
          'state',
        );
        const lastReadMessageSeq = getNullableRealtimeNumber(
          nextRow,
          previousRow,
          'last_read_message_seq',
        );

        if (!userId) {
          logDiagnostics('membership-postgres:missing-user-suppressed', {
            changedKeys,
            conversationId,
            lastReadMessageSeq,
            nextMembershipState,
          });
          return;
        }

        if (stateChanged) {
          if (
            userId === currentUserId &&
            nextMembershipState &&
            MEMBERSHIP_ROUTE_REFRESH_CRITICAL_STATES.has(nextMembershipState)
          ) {
            scheduleRefresh('membership-postgres:self-state-critical');
            return;
          }

          logDiagnostics('membership-postgres:state-suppressed', {
            changedKeys,
            conversationId,
            nextMembershipState,
            userId,
          });
        }

        if (!lastReadChanged) {
          return;
        }

        if (lastReadMessageSeq === undefined) {
          logDiagnostics('membership-postgres:last-read-undefined-suppressed', {
            changedKeys,
            conversationId,
            userId,
          });
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
