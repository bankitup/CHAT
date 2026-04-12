'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ConversationPresenceProviderProps = {
  children: ReactNode;
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
};

type PresenceStateEntry = {
  userId?: string;
};

const ConversationPresenceContext = createContext(false);

declare global {
  interface Window {
    __chatDmPresenceSubscriptions?: Record<string, number>;
  }
}

function hasTrackedUser(
  presenceState: Record<string, PresenceStateEntry[]>,
  userId: string,
) {
  return Object.entries(presenceState).some(([key, entries]) => {
    if (key === userId) {
      return true;
    }

    return entries.some((entry) => entry.userId === userId);
  });
}

export function ConversationPresenceProvider({
  children,
  conversationId,
  currentUserId,
  otherUserId,
}: ConversationPresenceProviderProps) {
  const [isOtherParticipantPresent, setIsOtherParticipantPresent] = useState(false);
  const channelName = useMemo(
    () => `chat-presence:${conversationId}`,
    [conversationId],
  );
  const diagnosticsEnabled =
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_THREAD_CLIENT === '1' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1';

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    const syncPresenceState = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        setIsOtherParticipantPresent(false);
        return;
      }

      const presenceState = channel.presenceState<PresenceStateEntry>();
      setIsOtherParticipantPresent(hasTrackedUser(presenceState, otherUserId));
    };

    const clearPresenceState = () => {
      setIsOtherParticipantPresent(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        clearPresenceState();
        return;
      }

      syncPresenceState();
    };

    if (diagnosticsEnabled && typeof window !== 'undefined') {
      const currentCounts = window.__chatDmPresenceSubscriptions ?? {};
      const nextCount = (currentCounts[conversationId] ?? 0) + 1;
      window.__chatDmPresenceSubscriptions = {
        ...currentCounts,
        [conversationId]: nextCount,
      };

      console.info('[chat-presence]', 'subscription:create', {
        activeConversationSubscriptionCount: nextCount,
        channelName,
        conversationId,
      });
    }

    channel
      .on('presence', { event: 'sync' }, syncPresenceState)
      .on('presence', { event: 'join' }, syncPresenceState)
      .on('presence', { event: 'leave' }, syncPresenceState)
      .subscribe(async (status) => {
        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          clearPresenceState();
          return;
        }

        if (status !== 'SUBSCRIBED') {
          return;
        }

        await channel.track({
          userId: currentUserId,
          conversationId,
          joinedAt: new Date().toISOString(),
        });
      });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (diagnosticsEnabled && typeof window !== 'undefined') {
        const currentCounts = window.__chatDmPresenceSubscriptions ?? {};
        const nextCount = Math.max(0, (currentCounts[conversationId] ?? 1) - 1);
        window.__chatDmPresenceSubscriptions = {
          ...currentCounts,
          [conversationId]: nextCount,
        };

        console.info('[chat-presence]', 'subscription:dispose', {
          activeConversationSubscriptionCount: nextCount,
          channelName,
          conversationId,
        });
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearPresenceState();
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [channelName, conversationId, currentUserId, diagnosticsEnabled, otherUserId]);

  return (
    <ConversationPresenceContext.Provider value={isOtherParticipantPresent}>
      {children}
    </ConversationPresenceContext.Provider>
  );
}

export function useIsOtherParticipantPresent() {
  return useContext(ConversationPresenceContext);
}
