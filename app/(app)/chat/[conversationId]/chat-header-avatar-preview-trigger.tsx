'use client';

import { memo, useEffect, useRef, useState } from 'react';
import {
  ChatHeaderAvatarVisual,
  type ChatHeaderParticipantIdentity,
} from './chat-header-avatar-visual';

const AVATAR_PREVIEW_EXIT_DURATION_MS = 190;

type ChatHeaderAvatarPreviewTriggerProps = {
  closeLabel: string;
  conversationKind: 'dm' | 'group';
  groupAvatarPath: string | null;
  openLabel: string;
  participant: ChatHeaderParticipantIdentity;
  title: string;
};

function areChatHeaderParticipantsEqual(
  previous: ChatHeaderParticipantIdentity,
  next: ChatHeaderParticipantIdentity,
) {
  return (
    previous?.userId === next?.userId &&
    previous?.displayName === next?.displayName &&
    previous?.avatarPath === next?.avatarPath
  );
}

export const ChatHeaderAvatarPreviewTrigger = memo(function ChatHeaderAvatarPreviewTrigger({
  closeLabel,
  conversationKind,
  groupAvatarPath,
  openLabel,
  participant,
  title,
}: ChatHeaderAvatarPreviewTriggerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPreview = () => {
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }

    setIsMounted(true);
  };

  const closePreview = () => {
    setIsVisible(false);

    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
    }

    exitTimeoutRef.current = setTimeout(() => {
      setIsMounted(false);
      exitTimeoutRef.current = null;
    }, AVATAR_PREVIEW_EXIT_DURATION_MS);
  };

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePreview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted]);

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <button
        aria-label={openLabel}
        className="chat-header-avatar-trigger"
        onClick={openPreview}
        type="button"
      >
        <ChatHeaderAvatarVisual
          className="chat-header-avatar-trigger-visual"
          conversationKind={conversationKind}
          groupAvatarPath={groupAvatarPath}
          participant={participant}
          title={title}
        />
      </button>

      {isMounted ? (
        <div
          aria-label={openLabel}
          aria-modal="true"
          className="chat-header-avatar-preview-overlay"
          data-state={isVisible ? 'open' : 'closed'}
          role="dialog"
        >
          <button
            aria-label={closeLabel}
            className="chat-header-avatar-preview-backdrop"
            onClick={closePreview}
            type="button"
          />
          <div className="chat-header-avatar-preview-shell">
            <button
              aria-label={closeLabel}
              className="chat-header-avatar-preview-close"
              onClick={closePreview}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>

            <div className="chat-header-avatar-preview-stage">
              <ChatHeaderAvatarVisual
                className="chat-header-avatar-preview-visual"
                conversationKind={conversationKind}
                groupAvatarPath={groupAvatarPath}
                participant={participant}
                title={title}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}, (previous, next) => {
  return (
    previous.closeLabel === next.closeLabel &&
    previous.conversationKind === next.conversationKind &&
    previous.groupAvatarPath === next.groupAvatarPath &&
    previous.openLabel === next.openLabel &&
    previous.title === next.title &&
    areChatHeaderParticipantsEqual(previous.participant, next.participant)
  );
});
