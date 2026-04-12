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
  const activeMentionRef = useRef<ActiveMention | null>(null);
  const isMentionSelectionInProgressRef = useRef(false);
  const lastPointerHandledMentionRef = useRef<{
    handledAt: number;
    userId: string;
  } | null>(null);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const hasMentionSupport = (mentionParticipants?.length ?? 0) > 0;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const stopTypingLocally = () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }

      isTypingRef.current = false;
    };

    const stopTypingBroadcast = () => {
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

      stopTypingLocally();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        stopTypingBroadcast();
      }
    };

    const handlePageHide = () => {
      stopTypingBroadcast();
    };

    channel.subscribe((status) => {
      isSubscribedRef.current = status === 'SUBSCRIBED';

      if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        stopTypingLocally();
      }
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      stopTypingBroadcast();

      isSubscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [channelName, conversationId, currentUserId, currentUserLabel]);

  const updateMentionState = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea || !hasMentionSupport) {
      mentionKeyRef.current = null;
      activeMentionRef.current = null;
      setActiveMention(null);
      return;
    }

    const nextMention = getActiveMention(textarea.value, textarea.selectionStart);
    const nextMentionKey = nextMention ? `${nextMention.start}:${nextMention.query}` : null;

    if (mentionKeyRef.current !== nextMentionKey) {
      mentionKeyRef.current = nextMentionKey;
      setActiveSuggestionIndex(0);
    }

    activeMentionRef.current = nextMention;
    setActiveMention(nextMention);
  }, [hasMentionSupport]);

  const clearMentionState = useCallback(() => {
    mentionKeyRef.current = null;
    activeMentionRef.current = null;
    setActiveMention(null);
    setActiveSuggestionIndex(0);
  }, []);

  const broadcastTypingState = (isTyping: boolean) => {
    const channel = channelRef.current;

    if (
      !channel ||
      !isSubscribedRef.current ||
      typeof document === 'undefined' ||
      document.visibilityState !== 'visible'
    ) {
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
        activeMentionRef.current ??
        activeMention ??
        (textarea ? getActiveMention(textarea.value, textarea.selectionStart) : null);

      if (!textarea || !mention) {
        isMentionSelectionInProgressRef.current = false;
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
      clearMentionState();
      isMentionSelectionInProgressRef.current = false;
    },
    [activeMention, clearMentionState],
  );

  return (
    <div className="composer-typing-shell">
      <AutoGrowTextarea
        {...props}
        ref={textareaRef}
        maxHeight={maxHeight}
        onBlur={(event) => {
          if (isMentionSelectionInProgressRef.current) {
            props.onBlur?.(event);
            return;
          }

          if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
          }

          if (isTypingRef.current) {
            broadcastTypingState(false);
          }

          clearMentionState();
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
            } else if (event.key === 'Enter') {
              event.preventDefault();
              insertMention(
                mentionSuggestions[
                  Math.min(activeSuggestionIndex, mentionSuggestions.length - 1)
                ]!,
              );
            } else if (event.key === 'Escape') {
              clearMentionState();
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
                  isMentionSelectionInProgressRef.current = true;
                  event.preventDefault();
                }}
                onPointerDown={(event) => {
                  isMentionSelectionInProgressRef.current = true;
                  event.preventDefault();
                }}
                onPointerCancel={() => {
                  isMentionSelectionInProgressRef.current = false;
                }}
                onPointerUp={(event) => {
                  if (event.pointerType === 'mouse') {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  lastPointerHandledMentionRef.current = {
                    handledAt: Date.now(),
                    userId: participant.userId,
                  };
                  insertMention(participant);
                }}
                onClick={() => {
                  const lastPointerHandledMention =
                    lastPointerHandledMentionRef.current;

                  if (
                    lastPointerHandledMention?.userId === participant.userId &&
                    Date.now() - lastPointerHandledMention.handledAt < 800
                  ) {
                    lastPointerHandledMentionRef.current = null;
                    return;
                  }

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
