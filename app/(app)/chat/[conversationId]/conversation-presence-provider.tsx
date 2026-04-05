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
      const presenceState = channel.presenceState<PresenceStateEntry>();
      setIsOtherParticipantPresent(hasTrackedUser(presenceState, otherUserId));
    };

    channel
      .on('presence', { event: 'sync' }, syncPresenceState)
      .on('presence', { event: 'join' }, syncPresenceState)
      .on('presence', { event: 'leave' }, syncPresenceState)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') {
          return;
        }

        await channel.track({
          userId: currentUserId,
          conversationId,
          joinedAt: new Date().toISOString(),
        });
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [channelName, conversationId, currentUserId, otherUserId]);

  return (
    <ConversationPresenceContext.Provider value={isOtherParticipantPresent}>
      {children}
    </ConversationPresenceContext.Provider>
  );
}

export function useIsOtherParticipantPresent() {
  return useContext(ConversationPresenceContext);
}
