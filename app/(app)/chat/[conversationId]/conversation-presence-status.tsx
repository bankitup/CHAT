'use client';

import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useEffect, useMemo, useState } from 'react';

type ConversationPresenceStatusProps = {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
  language: AppLanguage;
};

type PresenceStateEntry = {
  userId?: string;
};

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

export function ConversationPresenceStatus({
  conversationId,
  currentUserId,
  otherUserId,
  language,
}: ConversationPresenceStatusProps) {
  const t = getTranslations(language);
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

  if (!isOtherParticipantPresent) {
    return null;
  }

  return (
    <p className="chat-presence-status" aria-live="polite">
      <span className="chat-presence-dot" aria-hidden="true" />
      <span>{t.chat.activeNow}</span>
    </p>
  );
}
