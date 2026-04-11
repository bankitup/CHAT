import {
  normalizeInboxPreviewDisplayMode,
  type InboxPreviewDisplayMode,
} from '@/modules/messaging/inbox/preferences';

export type PreviewPrivacyDecision = {
  inbox: 'content' | 'generic';
  push: 'content' | 'generic';
};

export function normalizePreviewPrivacyMode(
  value: string | null | undefined,
): InboxPreviewDisplayMode {
  return normalizeInboxPreviewDisplayMode(value);
}

export function shouldRevealInboxPreviewContent(input: {
  mode: InboxPreviewDisplayMode;
  unreadCount?: number | null;
}) {
  if (input.mode === 'show') {
    return true;
  }

  if (input.mode === 'mask') {
    return false;
  }

  return (input.unreadCount ?? 0) <= 0;
}

export function shouldRevealPushPreviewContent(input: {
  mode: InboxPreviewDisplayMode;
}) {
  return input.mode === 'show';
}

export function getPreviewPrivacyDecision(input: {
  mode: InboxPreviewDisplayMode;
  unreadCount?: number | null;
}): PreviewPrivacyDecision {
  return {
    inbox: shouldRevealInboxPreviewContent(input) ? 'content' : 'generic',
    push: shouldRevealPushPreviewContent({ mode: input.mode })
      ? 'content'
      : 'generic',
  };
}
