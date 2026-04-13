import 'server-only';

import { after } from 'next/server';
import webpush from 'web-push';
import { getRequestSupabaseServerClient } from '@/lib/request-context/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import {
  getTranslations,
  normalizeLanguage,
  type AppLanguage,
} from '@/modules/i18n';
import {
  getArchivedConversations,
  getConversationDisplayName,
  getConversationForUser,
  getConversationParticipants,
  getInboxConversations,
  getProfileIdentities,
} from '@/modules/messaging/data/server';
import type { InboxAttachmentPreviewKind } from '@/modules/messaging/inbox/preview-kind';
import type { InboxPreviewDisplayMode } from '@/modules/messaging/inbox/preferences';
import {
  getPreviewPrivacyDecision,
  normalizePreviewPrivacyMode,
} from '@/modules/messaging/privacy/preview-policy';
import { resolveSuperAdminGovernanceForUser } from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';
import type {
  ChatPushPayload,
  PushSubscriptionPresenceInput,
  PushSubscriptionState,
  PushSubscriptionRecordInput,
  StoredPushSubscription,
} from './contract';

type PushSubscriptionRow = {
  id: string;
  user_id?: string;
  endpoint: string;
  expiration_time?: number | null;
  p256dh?: string | null;
  auth?: string | null;
  browser_language?: string | null;
  active_conversation_id?: string | null;
  created_at: string;
  presence_updated_at?: string | null;
  preview_mode?: string | null;
  platform?: string | null;
  user_agent?: string | null;
  updated_at: string;
  disabled_at: string | null;
};

type ChatPushMembershipRow = {
  user_id: string;
  notification_level?: string | null;
};

type ChatPushPresentation = {
  conversationKind: string | null;
  conversationLabel: string;
  senderLabel: string;
  spaceId: string | null;
};

type ChatPushPreviewLabels = {
  audio: string;
  attachment: string;
  encryptedMessage: string;
  file: string;
  image: string;
  newMessage: string;
  privateMessageBody: string;
  privateMessageTitle: string;
  voiceMessage: string;
};

type ChatPushSendInput = {
  attachmentPreviewKind?: InboxAttachmentPreviewKind | null;
  conversationId: string;
  messageId: string;
  senderId: string;
  messageKind: 'text' | 'attachment' | 'voice';
  contentMode: 'plaintext' | 'dm_e2ee_v1';
  body?: string | null;
  spaceId?: string | null;
};

type ChatPushSendResult = {
  attempted: boolean;
  sentCount: number;
  disabledCount: number;
  failedCount: number;
  skippedReason: string | null;
};

type ChatUnreadBadgeState = {
  mutedExcluded: boolean;
  unreadCount: number;
};

type PushTestSendResult = {
  attempted: boolean;
  disabledCount: number;
  endpointHost?: string | null;
  errorMessage?: string | null;
  errorStatusCode?: number | null;
  failureReason?: PushTestFailureReason | null;
  failedCount: number;
  nodeCode?: string | null;
  providerBody?: string | null;
  sent: boolean;
  skippedReason: string | null;
  subscriptionCreatedAt?: string | null;
  subscriptionUpdatedAt?: string | null;
};

type PushRecipientResolutionResult = {
  appActiveSuppressedUserCount?: number;
  dedupedSubscriptionCount?: number;
  eligibleRecipientCount: number;
  membershipCount: number;
  presenceSchemaPresent: boolean;
  rows: PushSubscriptionRow[];
  sameConversationSuppressedUserCount?: number;
  skippedReason: string | null;
  suppressedSubscriptionCount?: number;
  subscriptionCount: number;
};

type PushDeliveryFailureReason =
  | 'network-error'
  | 'payload-invalid'
  | 'push-service-error'
  | 'rate-limited'
  | 'subscription-expired'
  | 'unknown'
  | 'vapid-rejected';

type PushTestFailureReason =
  | PushDeliveryFailureReason
  | 'delivery-config-invalid'
  | 'delivery-config-missing'
  | 'subscription-not-found';

type PushDeliveryFailureDetails = {
  endpointHost: string | null;
  message: string;
  nodeCode: string | null;
  providerBody: string | null;
  reason: PushDeliveryFailureReason;
  statusCode: number | null;
};

let vapidConfigured = false;
const CHAT_PUSH_APP_ACTIVE_WINDOW_MS = 45_000;
const CHAT_PUSH_SAME_CONVERSATION_WINDOW_MS = 90_000;

function mapStoredPushSubscription(
  row: PushSubscriptionRow,
): StoredPushSubscription {
  return {
    id: row.id,
    endpoint: row.endpoint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    disabledAt: row.disabled_at,
  };
}

async function getPushSubscriptionWriteClient() {
  return createSupabaseServiceRoleClient() ?? (await getRequestSupabaseServerClient());
}

function logPushDiagnostics(stage: string, details?: Record<string, unknown>) {
  if (process.env.CHAT_DEBUG_PUSH !== '1') {
    return;
  }

  if (details) {
    console.info('[chat-push]', stage, details);
    return;
  }

  console.info('[chat-push]', stage);
}

function logPushFanoutOutcome(
  details: Record<string, unknown>,
  options?: { level?: 'error' | 'info' },
) {
  const level = options?.level ?? 'info';

  if (level === 'error') {
    console.error('[chat-push-fanout]', details);
    return;
  }

  console.info('[chat-push-fanout]', details);
}

function logPushTestOutcome(
  details: Record<string, unknown>,
  options?: { level?: 'error' | 'info' },
) {
  const level = options?.level ?? 'info';

  if (level === 'error') {
    console.error('[chat-push-test]', details);
    return;
  }

  console.info('[chat-push-test]', details);
}

function logPushDeliveryError(details: Record<string, unknown>) {
  console.error('[chat-push-delivery-error]', details);
}

function trimPushErrorDetail(value: string | null | undefined, maxLength = 240) {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';

  if (!normalized) {
    return null;
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 3).trimEnd()}...`
    : normalized;
}

function getPushEndpointHost(endpoint: string | null | undefined) {
  if (!endpoint) {
    return null;
  }

  try {
    return new URL(endpoint).host || null;
  } catch {
    return null;
  }
}

function getPushErrorNodeCode(error: unknown) {
  const value = error as { code?: unknown } | null;
  return typeof value?.code === 'string' ? value.code : null;
}

function getPushErrorBody(error: unknown) {
  const value = error as { body?: unknown } | null;
  return typeof value?.body === 'string' ? trimPushErrorDetail(value.body) : null;
}

function classifyPushDeliveryFailure(input: {
  error: unknown;
  statusCode: number | null;
}): PushDeliveryFailureReason {
  const nodeCode = getPushErrorNodeCode(input.error);

  if (input.statusCode === 401 || input.statusCode === 403) {
    return 'vapid-rejected';
  }

  if (input.statusCode === 404 || input.statusCode === 410) {
    return 'subscription-expired';
  }

  if (input.statusCode === 400 || input.statusCode === 413) {
    return 'payload-invalid';
  }

  if (input.statusCode === 429) {
    return 'rate-limited';
  }

  if (input.statusCode != null && input.statusCode >= 500) {
    return 'push-service-error';
  }

  if (
    nodeCode === 'ECONNRESET' ||
    nodeCode === 'ENOTFOUND' ||
    nodeCode === 'ETIMEDOUT' ||
    nodeCode === 'EAI_AGAIN'
  ) {
    return 'network-error';
  }

  return 'unknown';
}

function getPushDeliveryFailureDetails(input: {
  endpoint: string | null | undefined;
  error: unknown;
}): PushDeliveryFailureDetails {
  const statusCode = getPushErrorStatusCode(input.error);
  const message =
    input.error instanceof Error
      ? trimPushErrorDetail(input.error.message) ?? 'Unable to send chat push.'
      : 'Unable to send chat push.';

  return {
    endpointHost: getPushEndpointHost(input.endpoint),
    message,
    nodeCode: getPushErrorNodeCode(input.error),
    providerBody: getPushErrorBody(input.error),
    reason: classifyPushDeliveryFailure({
      error: input.error,
      statusCode,
    }),
    statusCode,
  };
}

function getWebPushPublicKey() {
  return (
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ||
    null
  );
}

function getWebPushConfig() {
  const publicKey = getWebPushPublicKey();
  const privateKey =
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ||
    process.env.VAPID_PRIVATE_KEY?.trim() ||
    null;
  const subject =
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() ||
    process.env.VAPID_SUBJECT?.trim() ||
    'mailto:notifications@bwc.local';

  if (!publicKey || !privateKey) {
    return null;
  }

  return {
    publicKey,
    privateKey,
    subject,
  };
}

export function getWebPushRuntimeConfig() {
  const publicKey = getWebPushPublicKey();
  const privateKey =
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ||
    process.env.VAPID_PRIVATE_KEY?.trim() ||
    null;

  return {
    deliveryConfigured: Boolean(publicKey && privateKey),
    publicKey,
    subscriptionConfigured: Boolean(publicKey),
  };
}

function ensureWebPushConfigured() {
  if (vapidConfigured) {
    return true;
  }

  const config = getWebPushConfig();

  if (!config) {
    return false;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  vapidConfigured = true;
  return true;
}

export function isPushTestSendEnabledForUser(input: {
  userEmail?: string | null;
}) {
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase() ?? null;
  const isPreview = vercelEnv === 'preview';
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const isDebugEnabled = process.env.CHAT_DEBUG_PUSH === '1';
  const isSuperAdmin = resolveSuperAdminGovernanceForUser({
    userEmail: input.userEmail ?? null,
  }).canCreateSpaces;

  return isDevelopment || isPreview || isDebugEnabled || isSuperAdmin;
}

function getProfileLabel(input: {
  displayName?: string | null;
  username?: string | null;
  emailLocalPart?: string | null;
}) {
  return (
    input.displayName?.trim() ||
    input.username?.trim() ||
    input.emailLocalPart?.trim() ||
    'Someone'
  );
}

function normalizePreviewText(value: string | null | undefined) {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > 120 ? `${normalized.slice(0, 117).trimEnd()}...` : normalized;
}

function getPushLanguage(value: string | null | undefined): AppLanguage {
  const normalized = value?.split(',')[0]?.trim().toLowerCase() ?? '';
  const primaryTag = normalized.split('-')[0]?.trim().toLowerCase() ?? '';
  return normalizeLanguage(primaryTag || normalized || null);
}

function getChatPushPreviewLabels(language: AppLanguage): ChatPushPreviewLabels {
  const t = getTranslations(language);

  return {
    audio: t.chat.audio,
    attachment: t.chat.attachment,
    encryptedMessage: t.chat.newEncryptedMessage,
    file: t.chat.file,
    image: t.chat.image,
    newMessage: t.chat.newMessage,
    privateMessageBody: t.notifications.privateMessageBody,
    privateMessageTitle: t.notifications.privateMessageTitle,
    voiceMessage: t.chat.voiceMessage,
  };
}

function getChatPushPreview(input: {
  attachmentPreviewKind?: InboxAttachmentPreviewKind | null;
  body?: string | null;
  contentMode: 'plaintext' | 'dm_e2ee_v1';
  labels: Pick<
    ChatPushPreviewLabels,
    | 'attachment'
    | 'audio'
    | 'encryptedMessage'
    | 'file'
    | 'image'
    | 'newMessage'
    | 'voiceMessage'
  >;
  messageKind: 'text' | 'attachment' | 'voice';
}) {
  if (input.contentMode === 'dm_e2ee_v1') {
    return input.labels.encryptedMessage;
  }

  if (input.messageKind === 'voice') {
    return input.labels.voiceMessage;
  }

  if (input.messageKind === 'attachment') {
    if (input.attachmentPreviewKind === 'image') {
      return input.labels.image;
    }

    if (input.attachmentPreviewKind === 'audio') {
      return input.labels.audio;
    }

    if (input.attachmentPreviewKind === 'file') {
      return input.labels.file;
    }

    return input.labels.attachment;
  }

  return normalizePreviewText(input.body) ?? input.labels.newMessage;
}

function buildChatPushPayload(input: {
  attachmentPreviewKind?: InboxAttachmentPreviewKind | null;
  body?: string | null;
  contentMode: 'plaintext' | 'dm_e2ee_v1';
  conversationId: string;
  language: AppLanguage;
  messageId: string;
  messageKind: 'text' | 'attachment' | 'voice';
  presentation: ChatPushPresentation;
  previewMode: InboxPreviewDisplayMode;
}) {
  const labels = getChatPushPreviewLabels(input.language);
  const title =
    input.presentation.conversationKind === 'group'
      ? input.presentation.conversationLabel
      : input.presentation.senderLabel;
  const url = withSpaceParam(
    `/chat/${input.conversationId}`,
    input.presentation.spaceId,
  );

  if (
    getPreviewPrivacyDecision({
      mode: input.previewMode,
    }).push === 'generic'
  ) {
    return {
      title: labels.privateMessageTitle,
      body: labels.privateMessageBody,
      url,
      conversationId: input.conversationId,
      spaceId: input.presentation.spaceId,
      messageId: input.messageId,
      tag: `chat:${input.conversationId}`,
    } satisfies ChatPushPayload;
  }

  const preview = getChatPushPreview({
    attachmentPreviewKind: input.attachmentPreviewKind ?? null,
    body: input.body ?? null,
    contentMode: input.contentMode,
    labels,
    messageKind: input.messageKind,
  });
  const body =
    input.presentation.conversationKind === 'group'
      ? `${input.presentation.senderLabel}: ${preview}`
      : preview;

  return {
    title,
    body,
    url,
    conversationId: input.conversationId,
    spaceId: input.presentation.spaceId,
    messageId: input.messageId,
    tag: `chat:${input.conversationId}`,
  } satisfies ChatPushPayload;
}

async function getChatPushPresentation(
  input: Pick<
    ChatPushSendInput,
    'conversationId' | 'senderId' | 'spaceId'
  >,
) {
  const conversation = await getConversationForUser(input.conversationId, input.senderId, {
    spaceId: input.spaceId ?? null,
  });

  if (!conversation) {
    return null;
  }

  const participants = await getConversationParticipants(input.conversationId);
  const identities = await getProfileIdentities(
    Array.from(new Set([input.senderId, ...participants.map((item) => item.userId)])),
    {
      includeAvatarPath: false,
      includeStatuses: false,
    },
  );
  const identityByUserId = new Map(
    identities.map((identity) => [identity.userId, identity]),
  );
  const senderIdentity = identityByUserId.get(input.senderId);
  const senderLabel = getProfileLabel({
    displayName: senderIdentity?.displayName ?? null,
    username: senderIdentity?.username ?? null,
    emailLocalPart: senderIdentity?.emailLocalPart ?? null,
  });
  const participantLabels =
    conversation.kind === 'group'
      ? participants
          .map((participant) => identityByUserId.get(participant.userId))
          .map((identity) =>
            getProfileLabel({
              displayName: identity?.displayName ?? null,
              username: identity?.username ?? null,
              emailLocalPart: identity?.emailLocalPart ?? null,
            }),
          )
      : participants
          .filter((participant) => participant.userId !== input.senderId)
          .map((participant) => identityByUserId.get(participant.userId))
          .map((identity) =>
            getProfileLabel({
              displayName: identity?.displayName ?? null,
              username: identity?.username ?? null,
              emailLocalPart: identity?.emailLocalPart ?? null,
            }),
          );
  const conversationLabel = getConversationDisplayName({
    kind: conversation.kind,
    title: conversation.title,
    participantLabels,
    fallbackTitles: {
      dm: 'New chat',
      group: 'Group chat',
    },
  });

  return {
    conversationKind: conversation.kind,
    conversationLabel,
    senderLabel,
    spaceId: conversation.spaceId ?? input.spaceId ?? null,
  } satisfies ChatPushPresentation;
}

export function isMissingPushSubscriptionsSchemaMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('push_subscriptions') ||
    normalizedMessage.includes('browser_language') ||
    normalizedMessage.includes('expiration_time') ||
    normalizedMessage.includes('disabled_at') ||
    normalizedMessage.includes('p256dh')
  );
}

function isMissingPushSubscriptionPreviewSchemaMessage(message: string) {
  return message.toLowerCase().includes('preview_mode');
}

function isMissingPushSubscriptionPresenceSchemaMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('presence_updated_at') ||
    normalizedMessage.includes('active_conversation_id')
  );
}

function isFreshPushPresenceTimestamp(input: {
  now: number;
  timestamp: string | null | undefined;
  windowMs: number;
}) {
  if (!input.timestamp) {
    return false;
  }

  const parsed = new Date(input.timestamp);
  const time = parsed.getTime();

  if (Number.isNaN(time)) {
    return false;
  }

  return input.now - time <= input.windowMs;
}

function applyPushPresenceSuppression(input: {
  conversationId: string;
  rows: PushSubscriptionRow[];
}) {
  const rowsByUserId = new Map<string, PushSubscriptionRow[]>();

  for (const row of input.rows) {
    const userId = typeof row.user_id === 'string' ? row.user_id.trim() : '';

    if (!userId) {
      continue;
    }

    const existing = rowsByUserId.get(userId) ?? [];
    existing.push(row);
    rowsByUserId.set(userId, existing);
  }

  const now = Date.now();
  const sameConversationSuppressedUserIds = new Set<string>();
  const appActiveSuppressedUserIds = new Set<string>();

  for (const [userId, rows] of rowsByUserId) {
    const hasSameConversationPresence = rows.some((row) => {
      const activeConversationId =
        typeof row.active_conversation_id === 'string'
          ? row.active_conversation_id.trim()
          : '';

      return (
        activeConversationId === input.conversationId &&
        isFreshPushPresenceTimestamp({
          now,
          timestamp: row.presence_updated_at,
          windowMs: CHAT_PUSH_SAME_CONVERSATION_WINDOW_MS,
        })
      );
    });

    if (hasSameConversationPresence) {
      sameConversationSuppressedUserIds.add(userId);
      continue;
    }

    const hasGeneralAppPresence = rows.some((row) =>
      isFreshPushPresenceTimestamp({
        now,
        timestamp: row.presence_updated_at,
        windowMs: CHAT_PUSH_APP_ACTIVE_WINDOW_MS,
      }),
    );

    if (hasGeneralAppPresence) {
      appActiveSuppressedUserIds.add(userId);
    }
  }

  const filteredRows = input.rows.filter((row) => {
    const userId = typeof row.user_id === 'string' ? row.user_id.trim() : '';

    if (!userId) {
      return true;
    }

    return (
      !sameConversationSuppressedUserIds.has(userId) &&
      !appActiveSuppressedUserIds.has(userId)
    );
  });

  const skippedReason =
    filteredRows.length === 0
      ? sameConversationSuppressedUserIds.size > 0
        ? 'recipient-viewing-conversation'
        : appActiveSuppressedUserIds.size > 0
          ? 'recipient-active-in-app'
          : null
      : null;

  return {
    appActiveSuppressedUserCount: appActiveSuppressedUserIds.size,
    rows: filteredRows,
    sameConversationSuppressedUserCount: sameConversationSuppressedUserIds.size,
    skippedReason,
    suppressedSubscriptionCount: input.rows.length - filteredRows.length,
  };
}

function parsePushSubscriptionRecency(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsedValue = new Date(value).getTime();
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function buildPushSubscriptionDedupeFingerprint(
  row: PushSubscriptionRow,
) {
  const userId = typeof row.user_id === 'string' ? row.user_id.trim() : '';

  if (!userId) {
    return null;
  }

  const browserLanguage =
    typeof row.browser_language === 'string'
      ? row.browser_language.trim().toLowerCase()
      : '';
  const platform =
    typeof row.platform === 'string' ? row.platform.trim().toLowerCase() : '';
  const userAgent =
    typeof row.user_agent === 'string'
      ? row.user_agent.replace(/\s+/g, ' ').trim().toLowerCase()
      : '';

  if (!browserLanguage && !platform && !userAgent) {
    return null;
  }

  return `${userId}::${platform}::${browserLanguage}::${userAgent}`;
}

function dedupePushSubscriptionsForDelivery(rows: PushSubscriptionRow[]) {
  const seenFingerprints = new Set<string>();
  let dedupedSubscriptionCount = 0;
  const nextRows = [...rows].sort((left, right) => {
    return (
      parsePushSubscriptionRecency(right.updated_at ?? right.created_at) -
      parsePushSubscriptionRecency(left.updated_at ?? left.created_at)
    );
  });
  const dedupedRows: PushSubscriptionRow[] = [];

  for (const row of nextRows) {
    const fingerprint = buildPushSubscriptionDedupeFingerprint(row);

    if (fingerprint) {
      if (seenFingerprints.has(fingerprint)) {
        dedupedSubscriptionCount += 1;
        continue;
      }

      seenFingerprints.add(fingerprint);
    }

    dedupedRows.push(row);
  }

  return {
    dedupedSubscriptionCount,
    rows: dedupedRows,
  };
}

async function getPushSubscriptionRowsForRecipients(input: {
  client: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>;
  userIds: string[];
}) {
  const baseSelect =
    'id, user_id, endpoint, expiration_time, p256dh, auth, browser_language, platform, user_agent, created_at, updated_at, disabled_at';
  const attempts = [
    {
      presenceSchemaPresent: true,
      previewModeSchemaPresent: true,
      select: `${baseSelect}, preview_mode, presence_updated_at, active_conversation_id`,
    },
    {
      presenceSchemaPresent: true,
      previewModeSchemaPresent: false,
      select: `${baseSelect}, presence_updated_at, active_conversation_id`,
    },
    {
      presenceSchemaPresent: false,
      previewModeSchemaPresent: true,
      select: `${baseSelect}, preview_mode`,
    },
    {
      presenceSchemaPresent: false,
      previewModeSchemaPresent: false,
      select: baseSelect,
    },
  ] as const;
  let lastSchemaErrorMessage: string | null = null;

  for (const attempt of attempts) {
    const result = await input.client
      .from('push_subscriptions')
      .select(attempt.select)
      .in('user_id', input.userIds)
      .is('disabled_at', null);

    if (!result.error) {
      return {
        presenceSchemaPresent: attempt.presenceSchemaPresent,
        previewModeSchemaPresent: attempt.previewModeSchemaPresent,
        rows: (result.data ?? []) as unknown as PushSubscriptionRow[],
      };
    }

    const message = result.error.message;
    const previewSchemaMissing =
      attempt.previewModeSchemaPresent &&
      isMissingPushSubscriptionPreviewSchemaMessage(message);
    const presenceSchemaMissing =
      attempt.presenceSchemaPresent &&
      isMissingPushSubscriptionPresenceSchemaMessage(message);

    if (previewSchemaMissing || presenceSchemaMissing) {
      lastSchemaErrorMessage = message;
      continue;
    }

    throw new Error(message);
  }

  throw new Error(lastSchemaErrorMessage ?? 'Unable to resolve push subscriptions.');
}

async function getActivePushSubscriptionRowsForRecipients(input: {
  conversationId: string;
  senderId: string;
}): Promise<PushRecipientResolutionResult> {
  const client = createSupabaseServiceRoleClient();

  if (!client) {
    return {
      appActiveSuppressedUserCount: 0,
      eligibleRecipientCount: 0,
      membershipCount: 0,
      presenceSchemaPresent: true,
      rows: [] as PushSubscriptionRow[],
      sameConversationSuppressedUserCount: 0,
      skippedReason: 'missing-service-role',
      suppressedSubscriptionCount: 0,
      subscriptionCount: 0,
    };
  }

  const membershipsWithNotificationLevel = await client
    .from('conversation_members')
    .select('user_id, notification_level')
    .eq('conversation_id', input.conversationId)
    .eq('state', 'active')
    .neq('user_id', input.senderId);

  let membershipRows: ChatPushMembershipRow[] = [];

  if (!membershipsWithNotificationLevel.error) {
    membershipRows = (membershipsWithNotificationLevel.data ?? []) as ChatPushMembershipRow[];
  } else if (
    membershipsWithNotificationLevel.error.message &&
    membershipsWithNotificationLevel.error.message
      .toLowerCase()
      .includes('notification_level')
  ) {
    const membershipsWithoutNotificationLevel = await client
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', input.conversationId)
      .eq('state', 'active')
      .neq('user_id', input.senderId);

    if (membershipsWithoutNotificationLevel.error) {
      throw new Error(membershipsWithoutNotificationLevel.error.message);
    }

    membershipRows = (membershipsWithoutNotificationLevel.data ?? []) as ChatPushMembershipRow[];
  } else {
    throw new Error(membershipsWithNotificationLevel.error.message);
  }

  const eligibleUserIds = membershipRows
    .filter((membership) => membership.notification_level !== 'muted')
    .map((membership) => membership.user_id)
    .filter(Boolean);

  if (eligibleUserIds.length === 0) {
    return {
      appActiveSuppressedUserCount: 0,
      eligibleRecipientCount: 0,
      membershipCount: membershipRows.length,
      presenceSchemaPresent: true,
      rows: [] as PushSubscriptionRow[],
      sameConversationSuppressedUserCount: 0,
      skippedReason: 'no-eligible-recipients',
      suppressedSubscriptionCount: 0,
      subscriptionCount: 0,
    };
  }

  const subscriptionsResult = await getPushSubscriptionRowsForRecipients({
    client,
    userIds: eligibleUserIds,
  });
  const subscriptionRows = subscriptionsResult.rows;
  const presenceSchemaPresent = subscriptionsResult.presenceSchemaPresent;

  const rows = subscriptionRows.filter(
    (row) => row.endpoint && row.p256dh && row.auth,
  );
  const presenceSuppression = applyPushPresenceSuppression({
    conversationId: input.conversationId,
    rows,
  });

  if (
    presenceSuppression.sameConversationSuppressedUserCount > 0 ||
    presenceSuppression.appActiveSuppressedUserCount > 0
  ) {
    logPushDiagnostics('recipient-presence-suppressed', {
      appActiveSuppressedUserCount:
        presenceSuppression.appActiveSuppressedUserCount,
      conversationId: input.conversationId,
      sameConversationSuppressedUserCount:
        presenceSuppression.sameConversationSuppressedUserCount,
      suppressedSubscriptionCount:
        presenceSuppression.suppressedSubscriptionCount,
    });
  }

  const dedupedRows = dedupePushSubscriptionsForDelivery(
    presenceSuppression.rows,
  );

  if (dedupedRows.dedupedSubscriptionCount > 0) {
    logPushDiagnostics('recipient-subscription-deduped', {
      conversationId: input.conversationId,
      dedupedSubscriptionCount: dedupedRows.dedupedSubscriptionCount,
      remainingSubscriptionCount: dedupedRows.rows.length,
    });
  }

  return {
    appActiveSuppressedUserCount:
      presenceSuppression.appActiveSuppressedUserCount,
    dedupedSubscriptionCount: dedupedRows.dedupedSubscriptionCount,
    eligibleRecipientCount: eligibleUserIds.length,
    membershipCount: membershipRows.length,
    presenceSchemaPresent,
    rows: dedupedRows.rows,
    sameConversationSuppressedUserCount:
      presenceSuppression.sameConversationSuppressedUserCount,
    skippedReason: presenceSuppression.skippedReason,
    suppressedSubscriptionCount: presenceSuppression.suppressedSubscriptionCount,
    subscriptionCount: rows.length,
  };
}

export async function getChatUnreadBadgeStateForUser(input: {
  userId: string;
}): Promise<ChatUnreadBadgeState> {
  const [visibleConversations, archivedConversations, supabase] = await Promise.all([
    getInboxConversations(input.userId),
    getArchivedConversations(input.userId),
    getRequestSupabaseServerClient(),
  ]);
  const allConversations = Array.from(
    new Map(
      [...visibleConversations, ...archivedConversations].map((conversation) => [
        conversation.conversationId,
        conversation,
      ]),
    ).values(),
  );

  if (allConversations.length === 0) {
    return {
      mutedExcluded: true,
      unreadCount: 0,
    };
  }

  const membershipsWithNotificationLevel = await supabase
    .from('conversation_members')
    .select('conversation_id, notification_level')
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .in(
      'conversation_id',
      allConversations.map((conversation) => conversation.conversationId),
    );
  let mutedExcluded = true;
  let membershipRows: Array<{
    conversation_id: string;
    notification_level?: string | null;
  }> = [];

  if (
    !membershipsWithNotificationLevel.error
  ) {
    membershipRows = (membershipsWithNotificationLevel.data ?? []) as Array<{
      conversation_id: string;
      notification_level?: string | null;
    }>;
  } else if (
    membershipsWithNotificationLevel.error.message &&
    membershipsWithNotificationLevel.error.message
      .toLowerCase()
      .includes('notification_level')
  ) {
    const membershipsWithoutNotificationLevel = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', input.userId)
      .eq('state', 'active')
      .in(
        'conversation_id',
        allConversations.map((conversation) => conversation.conversationId),
      );

    if (membershipsWithoutNotificationLevel.error) {
      throw new Error(membershipsWithoutNotificationLevel.error.message);
    }

    mutedExcluded = false;
    membershipRows = (membershipsWithoutNotificationLevel.data ?? []) as Array<{
      conversation_id: string;
      notification_level?: string | null;
    }>;
  } else {
    throw new Error(membershipsWithNotificationLevel.error.message);
  }

  const mutedConversationIds = new Set(
    membershipRows
      .filter((membership) => membership.notification_level === 'muted')
      .map((membership) => membership.conversation_id),
  );
  const unreadCount = allConversations.reduce((total, conversation) => {
    if (mutedConversationIds.has(conversation.conversationId)) {
      return total;
    }

    return total + Math.max(0, conversation.unreadCount);
  }, 0);

  return {
    mutedExcluded,
    unreadCount,
  };
}

export async function upsertPushSubscriptionForUser(input: {
  previewMode?: InboxPreviewDisplayMode | null;
  userId: string;
  subscription: PushSubscriptionRecordInput;
}) {
  const client = await getPushSubscriptionWriteClient();
  const now = new Date().toISOString();
  const basePayload = {
    user_id: input.userId,
    endpoint: input.subscription.endpoint,
    expiration_time: input.subscription.expirationTime,
    p256dh: input.subscription.keys.p256dh,
    auth: input.subscription.keys.auth,
    user_agent: input.subscription.userAgent,
    platform: input.subscription.platform,
    browser_language: input.subscription.language,
    updated_at: now,
    disabled_at: null,
  };
  let { data, error } = await client
    .from('push_subscriptions')
    .upsert(
      {
        ...basePayload,
        preview_mode: normalizePreviewPrivacyMode(input.previewMode),
      },
      {
        onConflict: 'endpoint',
      },
    )
    .select('id, endpoint, created_at, updated_at, disabled_at')
    .single<PushSubscriptionRow>();

  if (error && isMissingPushSubscriptionPreviewSchemaMessage(error.message)) {
    const fallbackResult = await client
      .from('push_subscriptions')
      .upsert(basePayload, {
        onConflict: 'endpoint',
      })
      .select('id, endpoint, created_at, updated_at, disabled_at')
      .single<PushSubscriptionRow>();

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Push subscription upsert returned no row.');
  }

  return mapStoredPushSubscription(data);
}

export async function updatePushSubscriptionPresenceForUser(input: {
  userId: string;
  presence: PushSubscriptionPresenceInput;
}) {
  const client = await getPushSubscriptionWriteClient();
  const now = new Date().toISOString();
  const attempts = [
    {
      includePresence: true,
      includePreview: input.presence.previewMode != null,
    },
    {
      includePresence: true,
      includePreview: false,
    },
    {
      includePresence: false,
      includePreview: input.presence.previewMode != null,
    },
  ].filter(
    (attempt, index, attemptsList) =>
      (attempt.includePresence || attempt.includePreview) &&
      attemptsList.findIndex(
        (candidate) =>
          candidate.includePresence === attempt.includePresence &&
          candidate.includePreview === attempt.includePreview,
      ) === index,
  );
  let lastSchemaError: string | null = null;

  for (const attempt of attempts) {
    const payload: Record<string, string | null> = {
      updated_at: now,
    };

    if (attempt.includePresence) {
      payload.active_conversation_id = input.presence.activeInApp
        ? input.presence.activeConversationId
        : null;
      payload.presence_updated_at = input.presence.activeInApp ? now : null;
    }

    if (attempt.includePreview) {
      payload.preview_mode = normalizePreviewPrivacyMode(input.presence.previewMode);
    }

    const { data, error } = await client
      .from('push_subscriptions')
      .update(payload)
      .eq('user_id', input.userId)
      .eq('endpoint', input.presence.endpoint)
      .is('disabled_at', null)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (!error) {
      return Boolean(data?.id);
    }

    const missingPresence =
      attempt.includePresence &&
      isMissingPushSubscriptionPresenceSchemaMessage(error.message);
    const missingPreview =
      attempt.includePreview &&
      isMissingPushSubscriptionPreviewSchemaMessage(error.message);

    if (missingPresence || missingPreview) {
      lastSchemaError = error.message;
      continue;
    }

    throw error;
  }

  if (lastSchemaError) {
    return false;
  }

  return false;
}

export async function getPushSubscriptionStateForUser(input: {
  userId: string;
  endpoint?: string | null;
}): Promise<PushSubscriptionState> {
  const client = await getRequestSupabaseServerClient();
  const { data, error } = await client
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', input.userId)
    .is('disabled_at', null);

  if (error) {
    throw error;
  }

  const activeRows = ((data ?? []) as Array<{ endpoint?: string | null }>).filter(
    (row) => typeof row.endpoint === 'string' && row.endpoint.length > 0,
  );
  const currentEndpoint = input.endpoint?.trim() || null;

  return {
    activeCount: activeRows.length,
    currentEndpointRegistered: currentEndpoint
      ? activeRows.some((row) => row.endpoint === currentEndpoint)
      : false,
  };
}

export async function disablePushSubscriptionForUser(input: {
  userId: string;
  endpoint: string;
}) {
  const client = await getPushSubscriptionWriteClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('push_subscriptions')
    .update({
      updated_at: now,
      disabled_at: now,
    })
    .eq('user_id', input.userId)
    .eq('endpoint', input.endpoint)
    .is('disabled_at', null)
    .select('id, endpoint, created_at, updated_at, disabled_at')
    .maybeSingle<PushSubscriptionRow>();

  if (error) {
    throw error;
  }

  return data ? mapStoredPushSubscription(data) : null;
}

async function disablePushSubscriptionByEndpoint(endpoint: string) {
  const client = createSupabaseServiceRoleClient();

  if (!client) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await client
    .from('push_subscriptions')
    .update({
      updated_at: now,
      disabled_at: now,
    })
    .eq('endpoint', endpoint)
    .is('disabled_at', null);

  if (error) {
    throw error;
  }
}

async function getActivePushSubscriptionRowForUserEndpoint(input: {
  userId: string;
  endpoint: string;
}) {
  const client = await getPushSubscriptionWriteClient();
  const { data, error } = await client
    .from('push_subscriptions')
    .select(
      'id, user_id, endpoint, expiration_time, p256dh, auth, created_at, updated_at, disabled_at',
    )
    .eq('user_id', input.userId)
    .eq('endpoint', input.endpoint)
    .is('disabled_at', null)
    .maybeSingle<PushSubscriptionRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

function getPushErrorStatusCode(error: unknown) {
  const value = error as { statusCode?: unknown } | null;
  return typeof value?.statusCode === 'number' ? value.statusCode : null;
}

function isExpiredPushEndpointStatusCode(statusCode: number | null) {
  return statusCode === 404 || statusCode === 410;
}

export async function sendPushTestNotificationToUserDevice(input: {
  endpoint: string;
  spaceId?: string | null;
  userId: string;
}): Promise<PushTestSendResult> {
  try {
    if (!ensureWebPushConfigured()) {
      logPushTestOutcome({
        attempted: false,
        failureReason: 'delivery-config-missing',
        sent: false,
        skippedReason: 'missing-vapid-config',
        spaceId: input.spaceId ?? null,
        userId: input.userId,
      });

      return {
        attempted: false,
        disabledCount: 0,
        endpointHost: null,
        errorMessage: null,
        errorStatusCode: null,
        failureReason: 'delivery-config-missing',
        failedCount: 0,
        nodeCode: null,
        providerBody: null,
        sent: false,
        skippedReason: 'missing-vapid-config',
        subscriptionCreatedAt: null,
        subscriptionUpdatedAt: null,
      };
    }
  } catch (error) {
    logPushDiagnostics('test-vapid-config-error', {
      message:
        error instanceof Error
          ? error.message
          : 'Unable to configure VAPID details for test push.',
      userId: input.userId,
    });

    logPushTestOutcome(
      {
        attempted: false,
        endpointHost: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Invalid VAPID delivery configuration.',
        failureReason: 'delivery-config-invalid',
        nodeCode: getPushErrorNodeCode(error),
        providerBody: getPushErrorBody(error),
        sent: false,
        skippedReason: 'invalid-vapid-config',
        spaceId: input.spaceId ?? null,
        userId: input.userId,
      },
      { level: 'error' },
    );

    return {
      attempted: false,
      disabledCount: 0,
      endpointHost: null,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Invalid VAPID delivery configuration.',
      errorStatusCode: null,
      failureReason: 'delivery-config-invalid',
      failedCount: 0,
      nodeCode: getPushErrorNodeCode(error),
      providerBody: getPushErrorBody(error),
      sent: false,
      skippedReason: 'invalid-vapid-config',
      subscriptionCreatedAt: null,
      subscriptionUpdatedAt: null,
    };
  }

  const subscription = await getActivePushSubscriptionRowForUserEndpoint({
    endpoint: input.endpoint,
    userId: input.userId,
  });

  if (!subscription?.endpoint || !subscription.p256dh || !subscription.auth) {
    logPushTestOutcome({
      attempted: false,
      failureReason: 'subscription-not-found',
      sent: false,
      skippedReason: 'subscription-not-found',
      spaceId: input.spaceId ?? null,
      subscriptionFound: false,
      userId: input.userId,
    });

    return {
      attempted: false,
      disabledCount: 0,
      endpointHost: null,
      errorMessage: null,
      errorStatusCode: null,
      failureReason: 'subscription-not-found',
      failedCount: 0,
      nodeCode: null,
      providerBody: null,
      sent: false,
      skippedReason: 'subscription-not-found',
      subscriptionCreatedAt: null,
      subscriptionUpdatedAt: null,
    };
  }

  const payload = JSON.stringify({
    body: 'Test notification for this device.',
    tag: `push:test:${input.userId}`,
    title: 'BWC Products',
    url: withSpaceParam('/activity', input.spaceId ?? null),
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expiration_time ?? null,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      payload,
      {
        TTL: 60 * 5,
        urgency: 'high',
      },
    );

    logPushTestOutcome({
      attempted: true,
      disabledCount: 0,
      endpointHost: getPushEndpointHost(subscription.endpoint),
      failureReason: null,
      failedCount: 0,
      nodeCode: null,
      providerBody: null,
      sent: true,
      skippedReason: null,
      spaceId: input.spaceId ?? null,
      subscriptionFound: true,
      subscriptionCreatedAt: subscription.created_at,
      subscriptionUpdatedAt: subscription.updated_at,
      userId: input.userId,
    });

    return {
      attempted: true,
      disabledCount: 0,
      endpointHost: getPushEndpointHost(subscription.endpoint),
      errorMessage: null,
      errorStatusCode: null,
      failureReason: null,
      failedCount: 0,
      nodeCode: null,
      providerBody: null,
      sent: true,
      skippedReason: null,
      subscriptionCreatedAt: subscription.created_at,
      subscriptionUpdatedAt: subscription.updated_at,
    };
  } catch (error) {
    const failure = getPushDeliveryFailureDetails({
      endpoint: subscription.endpoint,
      error,
    });

    logPushDiagnostics('test-send-error', {
      endpoint: subscription.endpoint,
      message: failure.message,
      nodeCode: failure.nodeCode,
      providerBody: failure.providerBody,
      reason: failure.reason,
      statusCode: failure.statusCode,
      userId: input.userId,
    });

    let disabledCount = 0;
    let skippedReason = 'send-failed';

    if (isExpiredPushEndpointStatusCode(failure.statusCode)) {
      try {
        await disablePushSubscriptionByEndpoint(subscription.endpoint);
        disabledCount = 1;
      } catch (disableError) {
        logPushDiagnostics('test-disable-endpoint-error', {
          endpoint: subscription.endpoint,
          message:
            disableError instanceof Error
              ? disableError.message
              : 'Unable to disable expired test push endpoint.',
        });
      }

      skippedReason = 'subscription-expired';
    } else if (failure.reason === 'vapid-rejected') {
      skippedReason = 'vapid-rejected';
    }

    logPushTestOutcome(
      {
        attempted: true,
        disabledCount,
        endpointHost: failure.endpointHost,
        errorMessage: failure.message,
        errorStatusCode: failure.statusCode,
        failureReason:
          skippedReason === 'subscription-expired'
            ? 'subscription-expired'
            : skippedReason === 'vapid-rejected'
              ? 'vapid-rejected'
              : failure.reason,
        failedCount: 1,
        nodeCode: failure.nodeCode,
        providerBody: failure.providerBody,
        sent: false,
        skippedReason,
        spaceId: input.spaceId ?? null,
        subscriptionFound: true,
        subscriptionCreatedAt: subscription.created_at,
        subscriptionUpdatedAt: subscription.updated_at,
        userId: input.userId,
      },
      { level: 'error' },
    );

    return {
      attempted: true,
      disabledCount,
      endpointHost: failure.endpointHost,
      errorMessage: failure.message,
      errorStatusCode: failure.statusCode,
      failureReason:
        skippedReason === 'subscription-expired'
          ? 'subscription-expired'
          : skippedReason === 'vapid-rejected'
            ? 'vapid-rejected'
            : failure.reason,
      failedCount: 1,
      nodeCode: failure.nodeCode,
      providerBody: failure.providerBody,
      sent: false,
      skippedReason,
      subscriptionCreatedAt: subscription.created_at,
      subscriptionUpdatedAt: subscription.updated_at,
    };
  }
}

export async function sendChatPushNotifications(
  input: ChatPushSendInput,
): Promise<ChatPushSendResult> {
  if (!ensureWebPushConfigured()) {
    logPushFanoutOutcome({
      attempted: false,
      contentMode: input.contentMode,
      conversationId: input.conversationId,
      failedCount: 0,
      messageId: input.messageId,
      messageKind: input.messageKind,
      sentCount: 0,
      skippedReason: 'missing-vapid-config',
    });

    return {
      attempted: false,
      sentCount: 0,
      disabledCount: 0,
      failedCount: 0,
      skippedReason: 'missing-vapid-config',
    };
  }

  const presentation = await getChatPushPresentation({
    conversationId: input.conversationId,
    senderId: input.senderId,
    spaceId: input.spaceId ?? null,
  });

  if (!presentation) {
    logPushFanoutOutcome(
      {
        attempted: false,
        contentMode: input.contentMode,
        conversationId: input.conversationId,
        failedCount: 0,
        messageId: input.messageId,
        messageKind: input.messageKind,
        sentCount: 0,
        skippedReason: 'conversation-unavailable',
      },
      { level: 'error' },
    );

    return {
      attempted: false,
      sentCount: 0,
      disabledCount: 0,
      failedCount: 0,
      skippedReason: 'conversation-unavailable',
    };
  }

  let subscriptions: PushSubscriptionRow[] = [];
  let subscriptionSkipReason: string | null = null;
  let appActiveSuppressedUserCount = 0;
  let dedupedSubscriptionCount = 0;
  let membershipCount = 0;
  let eligibleRecipientCount = 0;
  let presenceSchemaPresent = true;
  let sameConversationSuppressedUserCount = 0;
  let suppressedSubscriptionCount = 0;
  let subscriptionCount = 0;

  try {
    const result = await getActivePushSubscriptionRowsForRecipients({
      conversationId: input.conversationId,
      senderId: input.senderId,
    });
    appActiveSuppressedUserCount = result.appActiveSuppressedUserCount ?? 0;
    dedupedSubscriptionCount = result.dedupedSubscriptionCount ?? 0;
    eligibleRecipientCount = result.eligibleRecipientCount;
    membershipCount = result.membershipCount;
    presenceSchemaPresent = result.presenceSchemaPresent;
    sameConversationSuppressedUserCount =
      result.sameConversationSuppressedUserCount ?? 0;
    subscriptions = result.rows;
    subscriptionSkipReason = result.skippedReason;
    suppressedSubscriptionCount = result.suppressedSubscriptionCount ?? 0;
    subscriptionCount = result.subscriptionCount;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to resolve push subscriptions.';

    if (isMissingPushSubscriptionsSchemaMessage(message)) {
      logPushFanoutOutcome({
        attempted: false,
        contentMode: input.contentMode,
        conversationId: input.conversationId,
        eligibleRecipientCount,
        failedCount: 0,
        membershipCount,
        messageId: input.messageId,
        messageKind: input.messageKind,
        appActiveSuppressedUserCount,
        presenceSchemaPresent,
        sameConversationSuppressedUserCount,
        sentCount: 0,
        skippedReason: 'missing-push-subscriptions-schema',
        suppressedSubscriptionCount,
        subscriptionCount,
      });

      return {
        attempted: false,
        sentCount: 0,
        disabledCount: 0,
        failedCount: 0,
        skippedReason: 'missing-push-subscriptions-schema',
      };
    }

    logPushDiagnostics('recipient-resolution-error', {
      conversationId: input.conversationId,
      message,
    });
    logPushFanoutOutcome(
      {
        attempted: false,
        contentMode: input.contentMode,
        conversationId: input.conversationId,
        eligibleRecipientCount,
        failedCount: 0,
        membershipCount,
        message,
        messageId: input.messageId,
        messageKind: input.messageKind,
        appActiveSuppressedUserCount,
        presenceSchemaPresent,
        sameConversationSuppressedUserCount,
        sentCount: 0,
        skippedReason: 'recipient-resolution-error',
        suppressedSubscriptionCount,
        subscriptionCount,
      },
      { level: 'error' },
    );

    return {
      attempted: false,
      sentCount: 0,
      disabledCount: 0,
      failedCount: 0,
      skippedReason: 'recipient-resolution-error',
    };
  }

  if (subscriptions.length === 0) {
    const skippedReason = subscriptionSkipReason ?? 'no-active-subscriptions';

    logPushFanoutOutcome({
      attempted: false,
      contentMode: input.contentMode,
      conversationId: input.conversationId,
      eligibleRecipientCount,
      failedCount: 0,
      membershipCount,
      messageId: input.messageId,
      messageKind: input.messageKind,
      appActiveSuppressedUserCount,
      presenceSchemaPresent,
      sameConversationSuppressedUserCount,
      sentCount: 0,
      skippedReason,
      suppressedSubscriptionCount,
      subscriptionCount,
    });

    return {
      attempted: false,
      sentCount: 0,
      disabledCount: 0,
      failedCount: 0,
      skippedReason,
    };
  }

  let sentCount = 0;
  let disabledCount = 0;
  let failedCount = 0;
  const failureReasonCounts: Partial<Record<PushDeliveryFailureReason, number>> = {};
  let firstFailure: (PushDeliveryFailureDetails & {
    subscriptionCreatedAt: string;
    subscriptionId: string;
    subscriptionUpdatedAt: string;
  }) | null = null;

  for (const subscription of subscriptions) {
    try {
      const payload = JSON.stringify(
        buildChatPushPayload({
          body: input.body ?? null,
          contentMode: input.contentMode,
          conversationId: input.conversationId,
          language: getPushLanguage(subscription.browser_language),
          messageId: input.messageId,
          messageKind: input.messageKind,
          presentation,
          previewMode: normalizePreviewPrivacyMode(subscription.preview_mode),
        }),
      );

      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expiration_time ?? null,
          keys: {
            p256dh: subscription.p256dh ?? '',
            auth: subscription.auth ?? '',
          },
        },
        payload,
        {
          TTL: 60 * 60,
          urgency: 'high',
        },
      );

      sentCount += 1;
    } catch (error) {
      failedCount += 1;

      const failure = getPushDeliveryFailureDetails({
        endpoint: subscription.endpoint,
        error,
      });

      logPushDiagnostics('send-error', {
        conversationId: input.conversationId,
        endpoint: subscription.endpoint,
        message: failure.message,
        messageId: input.messageId,
        providerBody: failure.providerBody,
        reason: failure.reason,
        statusCode: failure.statusCode,
      });

      failureReasonCounts[failure.reason] =
        (failureReasonCounts[failure.reason] ?? 0) + 1;

      if (!firstFailure) {
        firstFailure = {
          ...failure,
          subscriptionCreatedAt: subscription.created_at,
          subscriptionId: subscription.id,
          subscriptionUpdatedAt: subscription.updated_at,
        };
      }

      logPushDeliveryError({
        contentMode: input.contentMode,
        conversationId: input.conversationId,
        endpointHost: failure.endpointHost,
        message: failure.message,
        messageId: input.messageId,
        messageKind: input.messageKind,
        providerBody: failure.providerBody,
        reason: failure.reason,
        statusCode: failure.statusCode,
        subscriptionCreatedAt: subscription.created_at,
        subscriptionId: subscription.id,
        subscriptionUpdatedAt: subscription.updated_at,
      });

      if (isExpiredPushEndpointStatusCode(failure.statusCode)) {
        try {
          await disablePushSubscriptionByEndpoint(subscription.endpoint);
          disabledCount += 1;
        } catch (disableError) {
          logPushDiagnostics('disable-endpoint-error', {
            endpoint: subscription.endpoint,
            message:
              disableError instanceof Error
                ? disableError.message
                : 'Unable to disable expired push endpoint.',
          });
        }
      }
    }
  }

  logPushFanoutOutcome(
    {
      attempted: true,
      contentMode: input.contentMode,
      conversationId: input.conversationId,
      disabledCount,
      eligibleRecipientCount,
      failedCount,
      failureReasonCounts,
      firstFailure,
      membershipCount,
      messageId: input.messageId,
      messageKind: input.messageKind,
      appActiveSuppressedUserCount,
      dedupedSubscriptionCount,
      presenceSchemaPresent,
      sameConversationSuppressedUserCount,
      sentCount,
      skippedReason: null,
      suppressedSubscriptionCount,
      subscriptionCount,
    },
    {
      level: failedCount > 0 && sentCount === 0 ? 'error' : 'info',
    },
  );

  return {
    attempted: true,
    sentCount,
    disabledCount,
    failedCount,
    skippedReason: null,
  };
}

export function scheduleChatPushNotificationsAfterResponse(
  input: ChatPushSendInput,
  options?: {
    onError?: (error: unknown) => void;
  },
) {
  after(async () => {
    try {
      await sendChatPushNotifications(input);
    } catch (error) {
      options?.onError?.(error);
    }
  });
}
