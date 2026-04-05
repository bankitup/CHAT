'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export const MESSAGE_COMMITTED_BROADCAST_EVENT = 'message-committed';
export const LOCAL_MESSAGE_COMMITTED_WINDOW_EVENT = 'chat:message-committed';

export type MessageCommittedPayload = {
  conversationId: string;
  clientId?: string | null;
  emittedAt?: string;
  messageId?: string | null;
  source?: string;
};

const diagnosticsEnabled =
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1';

function logLiveRefreshDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!diagnosticsEnabled) {
    return;
  }

  if (details) {
    console.info('[live-refresh]', stage, details);
    return;
  }

  console.info('[live-refresh]', stage);
}

export function emitLocalMessageCommitted(payload: MessageCommittedPayload) {
  if (typeof window === 'undefined') {
    return;
  }

  logLiveRefreshDiagnostics('local-message-committed', payload);
  window.dispatchEvent(
    new CustomEvent<MessageCommittedPayload>(LOCAL_MESSAGE_COMMITTED_WINDOW_EVENT, {
      detail: payload,
    }),
  );
}

export async function broadcastMessageCommitted(
  channelName: string,
  payload: MessageCommittedPayload,
) {
  emitLocalMessageCommitted(payload);

  if (typeof window === 'undefined') {
    return;
  }

  const supabase = createSupabaseBrowserClient();
  const channel = supabase.channel(channelName);

  try {
    await new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error('broadcast_subscribe_timeout'));
      }, 1500);

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeoutId);
          resolve();
          return;
        }

        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          window.clearTimeout(timeoutId);
          reject(new Error(status));
        }
      });
    });

    await channel.send({
      type: 'broadcast',
      event: MESSAGE_COMMITTED_BROADCAST_EVENT,
      payload: {
        ...payload,
        emittedAt: payload.emittedAt ?? new Date().toISOString(),
      },
    });

    logLiveRefreshDiagnostics('broadcast-message-committed', {
      channelName,
      conversationId: payload.conversationId,
      messageId: payload.messageId ?? null,
    });
  } catch (error) {
    logLiveRefreshDiagnostics('broadcast-message-committed-failed', {
      channelName,
      conversationId: payload.conversationId,
      messageId: payload.messageId ?? null,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    void supabase.removeChannel(channel);
  }
}
