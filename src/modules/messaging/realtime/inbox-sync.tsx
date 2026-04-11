'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  resolveInboxAttachmentPreviewKind,
  resolveInboxAttachmentPreviewKindFromMetadata,
} from '@/modules/messaging/inbox/preview-kind';
import { noteWarmNavRouterRefresh } from '@/modules/messaging/performance/warm-nav-client';
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
import { subscribeToInboxManualRefresh } from './inbox-manual-refresh';

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
  const manualRefreshPromiseRef = useRef<Promise<void> | null>(null);
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
        noteWarmNavRouterRefresh('inbox', reason, {
          trackedConversationCount: normalizedConversationIds.length,
        });
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

    const normalizeVisibleFromSeq = (value: unknown) => {
      const normalizedValue = normalizeLatestMessageSeq(value);

      if (normalizedValue === null) {
        return null;
      }

      return normalizedValue > 0 ? normalizedValue : null;
    };

    const resolveConversationVisibleReadFloorSeq = (
      visibleFromSeq: number | null,
    ) => {
      if (visibleFromSeq === null) {
        return null;
      }

      return Math.max(0, visibleFromSeq - 1);
    };

    const resolveConversationEffectiveLastReadSeq = (input: {
      lastReadMessageSeq: number | null;
      visibleFromSeq: number | null;
    }) => {
      const baselineReadFloorSeq = resolveConversationVisibleReadFloorSeq(
        input.visibleFromSeq,
      );

      return input.lastReadMessageSeq === null
        ? baselineReadFloorSeq
        : baselineReadFloorSeq === null
          ? input.lastReadMessageSeq
          : Math.max(input.lastReadMessageSeq, baselineReadFloorSeq);
    };

    const fetchUnreadIncomingCount = async (input: {
      conversationId: string;
      lastReadMessageSeq: number | null;
      visibleFromSeq: number | null;
    }) => {
      const effectiveLastReadSeq = resolveConversationEffectiveLastReadSeq({
        lastReadMessageSeq: input.lastReadMessageSeq,
        visibleFromSeq: input.visibleFromSeq,
      });

      let unreadQuery = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', input.conversationId)
        .neq('sender_id', userId);

      if (effectiveLastReadSeq !== null) {
        unreadQuery = unreadQuery.gt('seq', effectiveLastReadSeq);
      }

      const unreadResponse = await unreadQuery;

      if (unreadResponse.error) {
        throw unreadResponse.error;
      }

      return Number(unreadResponse.count ?? 0);
    };

    const fetchLatestConversationMessageSummary = async (conversationId: string) => {
      const loadLatestRow = async (includeContentMode: boolean) =>
        supabase
          .from('messages')
          .select(
            includeContentMode
              ? 'id, seq, sender_id, body, kind, content_mode, deleted_at, created_at'
              : 'id, seq, sender_id, body, kind, deleted_at, created_at',
          )
          .eq('conversation_id', conversationId)
          .order('seq', { ascending: false })
          .limit(1)
          .maybeSingle();

      let response = await loadLatestRow(true);

      if (
        response.error &&
        response.error.message.includes('content_mode')
      ) {
        response = await loadLatestRow(false);
      }

      if (response.error) {
        throw response.error;
      }

      return (response.data ?? null) as
        | {
            id?: string | null;
            seq?: number | string | null;
            sender_id?: string | null;
            body?: string | null;
            kind?: string | null;
            content_mode?: string | null;
            deleted_at?: string | null;
            created_at?: string | null;
          }
        | null;
    };

    const fetchLatestMessageAttachmentKind = async (messageId: string | null) => {
      if (!messageId) {
        return null;
      }

      const assetResponse = await supabase
        .from('message_asset_links')
        .select('message_id, created_at, message_assets!inner(kind, mime_type)')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (!assetResponse.error) {
        const row =
          ((assetResponse.data ?? []) as Array<{
            message_assets:
              | {
                  kind?: 'image' | 'file' | 'audio' | 'voice-note' | null;
                  mime_type?: string | null;
                }
              | Array<{
                  kind?: 'image' | 'file' | 'audio' | 'voice-note' | null;
                  mime_type?: string | null;
                }>
              | null;
          }>)[0] ?? null;
        const asset = row
          ? Array.isArray(row.message_assets)
            ? row.message_assets[0] ?? null
            : row.message_assets
          : null;

        if (asset) {
          return resolveInboxAttachmentPreviewKindFromMetadata({
            assetKind: asset.kind ?? null,
            mimeType: asset.mime_type ?? null,
          });
        }
      } else if (
        !assetResponse.error.message.includes('message_asset_links') &&
        !assetResponse.error.message.includes('message_assets')
      ) {
        logDiagnostics('summary-asset-kind:error', {
          message: assetResponse.error.message,
          messageId,
        });
      }

      const response = await supabase
        .from('message_attachments')
        .select('mime_type, created_at')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (response.error) {
        logDiagnostics('summary-attachment-kind:error', {
          message: response.error.message,
          messageId,
        });
        return null;
      }

      const row = ((response.data ?? []) as Array<{ mime_type?: string | null }>)[0] ?? null;

      if (!row) {
        return null;
      }

      return resolveInboxAttachmentPreviewKind(row.mime_type ?? null);
    };

    const fetchConversationSummary = async (conversationId: string) => {
      type MembershipSummaryRow = {
        conversation_id?: string | null;
        hidden_at?: string | null;
        last_read_at?: string | null;
        last_read_message_seq?: number | null;
        visible_from_seq?: number | null;
        conversations?:
          | {
              created_at?: string | null;
              id?: string | null;
            }
          | Array<{
              created_at?: string | null;
              id?: string | null;
            }>
          | null;
      };

      const loadMembership = async (includeVisibleFromSeq: boolean) =>
        supabase
          .from('conversation_members')
          .select(
            includeVisibleFromSeq
              ? 'conversation_id, hidden_at, last_read_message_seq, last_read_at, visible_from_seq, conversations(id, created_at)'
              : 'conversation_id, hidden_at, last_read_message_seq, last_read_at, conversations(id, created_at)',
          )
          .eq('conversation_id', conversationId)
          .eq('user_id', userId)
          .maybeSingle();

      let response = await loadMembership(true);

      if (
        response.error &&
        response.error.message.includes('visible_from_seq')
      ) {
        response = await loadMembership(false);
      }

      if (response.error) {
        throw response.error;
      }

      if (!response.data) {
        markInboxConversationRemoved(conversationId);
        return;
      }

      const membershipRow = response.data as MembershipSummaryRow;
      const conversationValue = Array.isArray(membershipRow.conversations)
        ? membershipRow.conversations[0] ?? null
        : membershipRow.conversations;
      const latestMessageRow = await fetchLatestConversationMessageSummary(
        conversationId,
      );
      const latestMessageSeq = normalizeLatestMessageSeq(
        latestMessageRow?.seq ?? null,
      );
      const lastReadMessageSeq =
        typeof membershipRow.last_read_message_seq === 'number'
          ? membershipRow.last_read_message_seq
          : null;
      const visibleFromSeq = normalizeVisibleFromSeq(
        membershipRow.visible_from_seq ?? null,
      );
      const latestMessageId = latestMessageRow?.id ?? null;
      const latestMessageBody = latestMessageRow?.body ?? null;
      const latestMessageContentMode =
        latestMessageRow?.content_mode ?? null;
      const latestMessageDeletedAt =
        latestMessageRow?.deleted_at ?? null;
      const latestMessageKind = latestMessageRow?.kind ?? null;
      const unreadCount = await fetchUnreadIncomingCount({
        conversationId,
        lastReadMessageSeq,
        visibleFromSeq,
      });
      const shouldResolveAttachmentKind =
        Boolean(latestMessageId) &&
        !latestMessageDeletedAt &&
        latestMessageContentMode !== 'dm_e2ee_v1' &&
        (latestMessageKind === 'attachment' ||
          (latestMessageKind !== 'voice' && !latestMessageBody?.trim()));
      const latestMessageAttachmentKind = shouldResolveAttachmentKind
        ? await fetchLatestMessageAttachmentKind(latestMessageId)
        : null;

      patchInboxConversationSummary({
        conversationId,
        createdAt: conversationValue?.created_at ?? null,
        hiddenAt: membershipRow.hidden_at ?? null,
        lastMessageAt: latestMessageRow?.created_at ?? null,
        lastReadAt: membershipRow.last_read_at ?? null,
        lastReadMessageSeq,
        latestMessageAttachmentKind,
        latestMessageBody,
        latestMessageContentMode,
        latestMessageDeletedAt,
        latestMessageId,
        latestMessageKind,
        latestMessageSenderId: latestMessageRow?.sender_id ?? null,
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

    const performManualRefresh = async () => {
      if (manualRefreshPromiseRef.current) {
        return manualRefreshPromiseRef.current;
      }

      const nextPromise = (async () => {
        logDiagnostics('manual-refresh:start', {
          trackedConversationCount: normalizedConversationIds.length,
        });

        if (normalizedConversationIds.length === 0) {
          lastRefreshAtRef.current = Date.now();
          noteWarmNavRouterRefresh('inbox', 'manual-refresh-empty-tracked-set', {
            trackedConversationCount: 0,
          });
          startRefreshTransition(() => {
            router.refresh();
          });
          return;
        }

        await syncTrackedConversationSummaries('manual-pull');
        lastRefreshAtRef.current = Date.now();
        logDiagnostics('manual-refresh:done', {
          trackedConversationCount: normalizedConversationIds.length,
        });
      })();

      manualRefreshPromiseRef.current = nextPromise;

      try {
        await nextPromise;
      } finally {
        manualRefreshPromiseRef.current = null;
      }
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

    const unsubscribeManualRefresh = subscribeToInboxManualRefresh(() =>
      performManualRefresh(),
    );

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

      unsubscribeManualRefresh();

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
