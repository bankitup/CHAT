import type { InboxPreviewDisplayMode } from '@/modules/messaging/inbox/preferences';

export type PushSubscriptionRecordInput = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent: string | null;
  platform: string | null;
  language: string | null;
};

export type PushSubscriptionPresenceInput = {
  endpoint: string;
  activeConversationId: string | null;
  activeInApp: boolean;
  previewMode?: InboxPreviewDisplayMode | null;
};

export type StoredPushSubscription = {
  id: string;
  endpoint: string;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
};

export type PushSubscriptionState = {
  activeCount: number;
  currentEndpointRegistered: boolean;
};

export type ChatPushPayload = {
  title: string;
  body: string;
  url: string;
  conversationId: string;
  spaceId: string | null;
  messageId: string;
  tag: string;
};
