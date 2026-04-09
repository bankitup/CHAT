import 'server-only';

import webpush from 'web-push';
import { getRequestSupabaseServerClient } from '@/lib/request-context/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import {
  getArchivedConversations,
  getConversationDisplayName,
  getConversationForUser,
  getConversationParticipants,
  getInboxConversations,
  getProfileIdentities,
} from '@/modules/messaging/data/server';
import { resolveSuperAdminGovernanceForUser } from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';
import type {
  ChatPushPayload,
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
  created_at: string;
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

type ChatPushSendInput = {
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
  eligibleRecipientCount: number;
  membershipCount: number;
  rows: PushSubscriptionRow[];
  skippedReason: string | null;
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

function getChatPushPreview(input: {
  body?: string | null;
  contentMode: 'plaintext' | 'dm_e2ee_v1';
  messageKind: 'text' | 'attachment' | 'voice';
}) {
  if (input.contentMode === 'dm_e2ee_v1') {
    return 'Sent you an encrypted message.';
  }

  if (input.messageKind === 'voice') {
    return 'Sent a voice message.';
  }

  if (input.messageKind === 'attachment') {
    return normalizePreviewText(input.body) ?? 'Sent an attachment.';
  }

  return normalizePreviewText(input.body) ?? 'Sent a message.';
}

function buildChatPushPayload(input: {
  conversationId: string;
  messageId: string;
  preview: string;
  presentation: ChatPushPresentation;
}) {
  const title =
    input.presentation.conversationKind === 'group'
      ? input.presentation.conversationLabel
      : input.presentation.senderLabel;
  const body =
    input.presentation.conversationKind === 'group'
      ? `${input.presentation.senderLabel}: ${input.preview}`
      : input.preview;
  const url = withSpaceParam(
    `/chat/${input.conversationId}`,
    input.presentation.spaceId,
  );

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

async function getActivePushSubscriptionRowsForRecipients(input: {
  conversationId: string;
  senderId: string;
}): Promise<PushRecipientResolutionResult> {
  const client = createSupabaseServiceRoleClient();

  if (!client) {
    return {
      eligibleRecipientCount: 0,
      membershipCount: 0,
      rows: [] as PushSubscriptionRow[],
      skippedReason: 'missing-service-role',
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
      eligibleRecipientCount: 0,
      membershipCount: membershipRows.length,
      rows: [] as PushSubscriptionRow[],
      skippedReason: 'no-eligible-recipients',
      subscriptionCount: 0,
    };
  }

  const { data, error } = await client
    .from('push_subscriptions')
    .select(
      'id, user_id, endpoint, expiration_time, p256dh, auth, created_at, updated_at, disabled_at',
    )
    .in('user_id', eligibleUserIds)
    .is('disabled_at', null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as PushSubscriptionRow[]).filter(
    (row) => row.endpoint && row.p256dh && row.auth,
  );

  return {
    eligibleRecipientCount: eligibleUserIds.length,
    membershipCount: membershipRows.length,
    rows,
    skippedReason: null,
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
  userId: string;
  subscription: PushSubscriptionRecordInput;
}) {
  const client = await getPushSubscriptionWriteClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('push_subscriptions')
    .upsert(
      {
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
      },
      {
        onConflict: 'endpoint',
      },
    )
    .select('id, endpoint, created_at, updated_at, disabled_at')
    .single<PushSubscriptionRow>();

  if (error) {
    throw error;
  }

  return mapStoredPushSubscription(data);
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

  const preview = getChatPushPreview({
    body: input.body ?? null,
    contentMode: input.contentMode,
    messageKind: input.messageKind,
  });
  const payload = JSON.stringify(
    buildChatPushPayload({
      conversationId: input.conversationId,
      messageId: input.messageId,
      preview,
      presentation,
    }),
  );

  let subscriptions: PushSubscriptionRow[] = [];
  let subscriptionSkipReason: string | null = null;
  let membershipCount = 0;
  let eligibleRecipientCount = 0;
  let subscriptionCount = 0;

  try {
    const result = await getActivePushSubscriptionRowsForRecipients({
      conversationId: input.conversationId,
      senderId: input.senderId,
    });
    eligibleRecipientCount = result.eligibleRecipientCount;
    membershipCount = result.membershipCount;
    subscriptions = result.rows;
    subscriptionSkipReason = result.skippedReason;
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
        sentCount: 0,
        skippedReason: 'missing-push-subscriptions-schema',
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
        sentCount: 0,
        skippedReason: 'recipient-resolution-error',
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
      sentCount: 0,
      skippedReason,
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
      sentCount,
      skippedReason: null,
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
