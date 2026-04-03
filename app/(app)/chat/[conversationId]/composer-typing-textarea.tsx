'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ComponentPropsWithoutRef } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AutoGrowTextarea } from './auto-grow-textarea';

type MentionParticipant = {
  userId: string;
  label: string;
};

type ComposerTypingTextareaProps = ComponentPropsWithoutRef<'textarea'> & {
  conversationId: string;
  currentUserId: string;
  currentUserLabel: string;
  maxHeight?: number;
  mentionParticipants?: MentionParticipant[];
  mentionSuggestionsLabel?: string;
};

const TYPING_BROADCAST_IDLE_MS = 2200;
const TYPING_BROADCAST_INTERVAL_MS = 1200;
const MENTION_MAX_SUGGESTIONS = 5;

type ActiveMention = {
  start: number;
  end: number;
  query: string;
};

function getActiveMention(value: string, selectionStart: number | null): ActiveMention | null {
  if (selectionStart === null) {
    return null;
  }

  const beforeCursor = value.slice(0, selectionStart);
  const mentionMatch = beforeCursor.match(/(^|\s)@([^\s@]*)$/u);

  if (!mentionMatch) {
    return null;
  }

  const query = mentionMatch[2] ?? '';

  return {
    start: selectionStart - query.length - 1,
    end: selectionStart,
    query,
  };
}

export function ComposerTypingTextarea({
  conversationId,
  currentUserId,
  currentUserLabel,
  maxHeight = 160,
  mentionParticipants,
  mentionSuggestionsLabel,
  ...props
}: ComposerTypingTextareaProps) {
  const channelName = useMemo(
    () => `chat-typing:${conversationId}`,
    [conversationId],
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createSupabaseBrowserClient>['channel']
  > | null>(null);
  const isSubscribedRef = useRef(false);
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcastAtRef = useRef(0);
  const mentionKeyRef = useRef<string | null>(null);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const hasMentionSupport = (mentionParticipants?.length ?? 0) > 0;

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

  const updateMentionState = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea || !hasMentionSupport) {
      mentionKeyRef.current = null;
      setActiveMention(null);
      return;
    }

    const nextMention = getActiveMention(textarea.value, textarea.selectionStart);
    const nextMentionKey = nextMention ? `${nextMention.start}:${nextMention.query}` : null;

    if (mentionKeyRef.current !== nextMentionKey) {
      mentionKeyRef.current = nextMentionKey;
      setActiveSuggestionIndex(0);
    }

    setActiveMention(nextMention);
  }, [hasMentionSupport]);

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

  const mentionSuggestions = useMemo(() => {
    if (!hasMentionSupport || !activeMention) {
      return [];
    }

    const normalizedQuery = activeMention.query.trim().toLocaleLowerCase();
    const rankedParticipants = [...(mentionParticipants ?? [])].sort((left, right) => {
      const leftLabel = left.label.toLocaleLowerCase();
      const rightLabel = right.label.toLocaleLowerCase();
      const leftStartsWith = normalizedQuery ? leftLabel.startsWith(normalizedQuery) : true;
      const rightStartsWith = normalizedQuery ? rightLabel.startsWith(normalizedQuery) : true;

      if (leftStartsWith !== rightStartsWith) {
        return leftStartsWith ? -1 : 1;
      }

      return leftLabel.localeCompare(rightLabel);
    });

    return rankedParticipants
      .filter((participant) => {
        if (!normalizedQuery) {
          return true;
        }

        return participant.label.toLocaleLowerCase().includes(normalizedQuery);
      })
      .slice(0, MENTION_MAX_SUGGESTIONS);
  }, [activeMention, hasMentionSupport, mentionParticipants]);

  const insertMention = useCallback(
    (participant: MentionParticipant) => {
      const textarea = textareaRef.current;
      const mention =
        activeMention ??
        (textarea ? getActiveMention(textarea.value, textarea.selectionStart) : null);

      if (!textarea || !mention) {
        return;
      }

      const nextMentionText = `@${participant.label} `;
      const nextValue = `${textarea.value.slice(0, mention.start)}${nextMentionText}${textarea.value.slice(
        mention.end,
      )}`;
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;

      if (valueSetter) {
        valueSetter.call(textarea, nextValue);
      } else {
        textarea.value = nextValue;
      }

      const nextCursorPosition = mention.start + nextMentionText.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      mentionKeyRef.current = null;
      setActiveMention(null);
      setActiveSuggestionIndex(0);
    },
    [activeMention],
  );

  return (
    <div className="composer-typing-shell">
      <AutoGrowTextarea
        {...props}
        ref={textareaRef}
        maxHeight={maxHeight}
        onBlur={(event) => {
          if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
          }

          if (isTypingRef.current) {
            broadcastTypingState(false);
          }

          mentionKeyRef.current = null;
          setActiveMention(null);
          props.onBlur?.(event);
        }}
        onClick={(event) => {
          updateMentionState();
          props.onClick?.(event);
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
          updateMentionState();
          props.onInput?.(event);
        }}
        onKeyDown={(event) => {
          if (mentionSuggestions.length > 0) {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveSuggestionIndex((currentIndex) =>
                (currentIndex + 1) % mentionSuggestions.length,
              );
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveSuggestionIndex((currentIndex) =>
                (currentIndex - 1 + mentionSuggestions.length) % mentionSuggestions.length,
              );
            } else if (event.key === 'Tab') {
              event.preventDefault();
              insertMention(
                mentionSuggestions[
                  Math.min(activeSuggestionIndex, mentionSuggestions.length - 1)
                ]!,
              );
            } else if (event.key === 'Escape') {
              mentionKeyRef.current = null;
              setActiveMention(null);
            }
          }

          props.onKeyDown?.(event);
        }}
        onKeyUp={(event) => {
          updateMentionState();
          props.onKeyUp?.(event);
        }}
        onSelect={(event) => {
          updateMentionState();
          props.onSelect?.(event);
        }}
      />

      {mentionSuggestions.length > 0 ? (
        <div
          aria-label={mentionSuggestionsLabel}
          className="composer-mention-menu"
          role="listbox"
        >
          {mentionSuggestions.map((participant, index) => {
            const isActive = index === activeSuggestionIndex;

            return (
              <button
                key={participant.userId}
                aria-selected={isActive}
                className={
                  isActive
                    ? 'composer-mention-option composer-mention-option-active'
                    : 'composer-mention-option'
                }
                role="option"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  insertMention(participant);
                }}
              >
                <span className="composer-mention-at" aria-hidden="true">
                  @
                </span>
                <span className="composer-mention-label">{participant.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
