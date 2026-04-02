'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ComponentPropsWithoutRef } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { AutoGrowTextarea } from './auto-grow-textarea';

type ComposerTypingTextareaProps = ComponentPropsWithoutRef<'textarea'> & {
  conversationId: string;
  currentUserId: string;
  currentUserLabel: string;
  maxHeight?: number;
};

const TYPING_BROADCAST_IDLE_MS = 2200;
const TYPING_BROADCAST_INTERVAL_MS = 1200;

export function ComposerTypingTextarea({
  conversationId,
  currentUserId,
  currentUserLabel,
  maxHeight = 160,
  ...props
}: ComposerTypingTextareaProps) {
  const channelName = useMemo(
    () => `chat-typing:${conversationId}`,
    [conversationId],
  );
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createSupabaseBrowserClient>['channel']
  > | null>(null);
  const isSubscribedRef = useRef(false);
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcastAtRef = useRef(0);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel.subscribe((status) => {
      isSubscribedRef.current = status === 'SUBSCRIBED';
    });

    return () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
      }

      if (isTypingRef.current && isSubscribedRef.current) {
        void channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            conversationId,
            userId: currentUserId,
            label: currentUserLabel,
            isTyping: false,
          },
        });
      }

      isSubscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [channelName, conversationId, currentUserId, currentUserLabel]);

  const broadcastTypingState = (isTyping: boolean) => {
    const channel = channelRef.current;

    if (!channel || !isSubscribedRef.current) {
      return;
    }

    isTypingRef.current = isTyping;
    if (isTyping) {
      lastTypingBroadcastAtRef.current = Date.now();
    }

    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        conversationId,
        userId: currentUserId,
        label: currentUserLabel,
        isTyping,
      },
    });
  };

  const scheduleStopTyping = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
    }

    stopTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        broadcastTypingState(false);
      }
    }, TYPING_BROADCAST_IDLE_MS);
  };

  return (
    <AutoGrowTextarea
      {...props}
      maxHeight={maxHeight}
      onBlur={(event) => {
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
        }

        if (isTypingRef.current) {
          broadcastTypingState(false);
        }

        props.onBlur?.(event);
      }}
      onInput={(event) => {
        const now = Date.now();
        const shouldBroadcastTyping =
          !isTypingRef.current ||
          now - lastTypingBroadcastAtRef.current >= TYPING_BROADCAST_INTERVAL_MS;

        if (shouldBroadcastTyping) {
          broadcastTypingState(true);
        }

        scheduleStopTyping();
        props.onInput?.(event);
      }}
    />
  );
}
