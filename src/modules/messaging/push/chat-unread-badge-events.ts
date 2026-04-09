'use client';

const CHAT_UNREAD_BADGE_REFRESH_EVENT = 'chat-unread-badge-refresh';

export function requestChatUnreadBadgeRefresh() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(CHAT_UNREAD_BADGE_REFRESH_EVENT));
}

export function subscribeToChatUnreadBadgeRefresh(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  window.addEventListener(CHAT_UNREAD_BADGE_REFRESH_EVENT, listener);

  return () => {
    window.removeEventListener(CHAT_UNREAD_BADGE_REFRESH_EVENT, listener);
  };
}
