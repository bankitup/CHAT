'use client';

import {
  getChatClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client-chat';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useEffect, useMemo, useRef, useState } from 'react';

type TypingIndicatorProps = {
  conversationId: string;
  currentUserId: string;
  language: AppLanguage;
};

type TypingPayload = {
  conversationId?: string;
  userId?: string;
  label?: string;
  isTyping?: boolean;
};

type ActiveTyper = {
  label: string;
};

const TYPING_VISIBLE_MS = 2800;

export function TypingIndicator({
  conversationId,
  currentUserId,
  language,
}: TypingIndicatorProps) {
  const t = getChatClientTranslations(language);
  const [activeTypers, setActiveTypers] = useState<Record<string, ActiveTyper>>({});
  const expiryTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const channelName = useMemo(
    () => `chat-typing:${conversationId}`,
    [conversationId],
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const expiryTimeouts = expiryTimeoutsRef.current;
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const nextPayload = payload as TypingPayload | null;

        if (!nextPayload) {
          return;
        }

        if (
          nextPayload.conversationId !== conversationId ||
          !nextPayload.userId ||
          nextPayload.userId === currentUserId
        ) {
          return;
        }

        const timeoutId = expiryTimeoutsRef.current.get(nextPayload.userId);

        if (timeoutId) {
          clearTimeout(timeoutId);
          expiryTimeoutsRef.current.delete(nextPayload.userId);
        }

        if (!nextPayload.isTyping) {
          setActiveTypers((current) => {
            const next = { ...current };
            delete next[nextPayload.userId as string];
            return next;
          });
          return;
        }

          setActiveTypers((current) => ({
          ...current,
          [nextPayload.userId as string]: {
            label: nextPayload.label?.trim() || t.chat.someone,
          },
        }));

        const nextTimeoutId = setTimeout(() => {
          setActiveTypers((current) => {
            const next = { ...current };
            delete next[nextPayload.userId as string];
            return next;
          });
          expiryTimeoutsRef.current.delete(nextPayload.userId as string);
        }, TYPING_VISIBLE_MS);

        expiryTimeoutsRef.current.set(nextPayload.userId, nextTimeoutId);
      })
      .subscribe();

    return () => {
      expiryTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      expiryTimeouts.clear();
      void supabase.removeChannel(channel);
    };
  }, [channelName, conversationId, currentUserId, language, t.chat.someone]);

  const typerLabels = Object.values(activeTypers).map((typer) => typer.label);

  if (typerLabels.length === 0) {
    return null;
  }

  const typingLabel =
    typerLabels.length === 1
      ? t.chat.typingSingle(typerLabels[0])
      : typerLabels.length === 2
        ? t.chat.typingDouble(typerLabels[0], typerLabels[1])
        : t.chat.typingSeveral;

  return (
    <div className="chat-typing-indicator" aria-live="polite" aria-atomic="true">
      <span className="chat-typing-label">{typingLabel}</span>
      <span className="chat-typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
