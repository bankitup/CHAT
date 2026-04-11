import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  formatMemberCount,
  formatPersonFallbackLabel,
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getAvailableUsers,
  getConversationDisplayName,
  getConversationMessageStats,
  getConversationParticipantIdentities,
  getConversationParticipants,
  getDirectMessageDisplayName,
} from '@/modules/messaging/data/server';
import {
  canAddParticipantsToGroupConversation,
  canEditGroupConversationIdentity,
  canRemoveParticipantFromGroupConversation,
  normalizeGroupConversationJoinPolicy,
} from '@/modules/messaging/group-policy';
import { resolveMessagingConversationRouteContextForUser } from '@/modules/messaging/server/route-context';
import { resolvePublicIdentityLabel } from '@/modules/messaging/ui/identity-label';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';

export type MessengerThreadSettingsPageQuery = {
  error?: string;
  saved?: string;
  space?: string;
};

function formatGroupMemberSummary(
  participantIds: string[],
  currentUserId: string,
  displayNames: Map<string, string | null>,
  language: AppLanguage,
  t: ReturnType<typeof getTranslations>,
) {
  const fallbackNames = new Map<string, string>();

  const labels = participantIds.map((participantId) => {
    if (participantId === currentUserId) {
      return t.chat.you;
    }

    const displayName = displayNames.get(participantId)?.trim();

    if (displayName) {
      return displayName;
    }

    const existing = fallbackNames.get(participantId);

    if (existing) {
      return existing;
    }

    const nextLabel = formatPersonFallbackLabel(language, fallbackNames.size + 1);
    fallbackNames.set(participantId, nextLabel);

    return nextLabel;
  });

  const otherLabels = labels.filter((label) => label !== t.chat.you);
  const previewNames = otherLabels.slice(0, 2);
  const remainingCount = Math.max(0, otherLabels.length - previewNames.length);
  const memberLabel = formatMemberCount(language, participantIds.length);

  if (previewNames.length === 0) {
    return memberLabel;
  }

  return `${memberLabel} · ${previewNames.join(', ')}${
    remainingCount > 0 ? ` +${remainingCount}` : ''
  }`;
}

function formatParticipantRoleLabel(
  role: string | null,
  t: ReturnType<typeof getTranslations>,
) {
  if (role === 'owner') {
    return t.chat.owner;
  }

  if (role === 'admin') {
    return t.chat.admin;
  }

  return t.chat.member;
}

export async function loadMessengerThreadSettingsPageData(input: {
  conversationId: string;
  query: MessengerThreadSettingsPageQuery;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect('/login');
  }

  const routeContext = await resolveMessagingConversationRouteContextForUser({
    conversationId: input.conversationId,
    requestedSpaceId: input.query.space,
    source: 'chat-settings-page',
    userEmail: user.email ?? null,
    userId: user.id,
  });

  if (routeContext.kind === 'conversation_not_found') {
    notFound();
  }

  if (routeContext.kind === 'requested_space_invalid') {
    notFound();
  }

  if (routeContext.kind === 'space_unavailable') {
    redirect('/spaces');
  }

  const { activeSpaceId, conversation, isV1TestBypass } = routeContext.context;
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const visibleSettingsError = input.query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'chat-settings'),
        language,
        rawMessage: input.query.error,
      })
    : null;
  const hasSettingsSavedState = input.query.saved === '1';
  const [participants, participantIdentities, availableUsers, messageStats] =
    await Promise.all([
      getConversationParticipants(input.conversationId),
      getConversationParticipantIdentities([input.conversationId]),
      conversation.kind === 'group' && !isV1TestBypass
        ? getAvailableUsers(user.id, { spaceId: activeSpaceId })
        : Promise.resolve([]),
      conversation.kind === 'dm'
        ? getConversationMessageStats(input.conversationId)
        : Promise.resolve(null),
    ]);

  const identitiesByUserId = new Map(
    participantIdentities.map((identity) => [identity.userId, identity] as const),
  );
  const senderNames = new Map<string, string>(
    participantIdentities.map((identity) => [
      identity.userId,
      resolvePublicIdentityLabel(identity, t.chat.unknownUser),
    ]),
  );
  const otherParticipants = participants.filter(
    (participant) => participant.userId !== user.id,
  );
  const otherParticipantLabels = otherParticipants.map((participant) =>
    resolvePublicIdentityLabel(
      identitiesByUserId.get(participant.userId),
      t.chat.unknownUser,
    ),
  );
  const directParticipantIdentity = otherParticipants[0]
    ? identitiesByUserId.get(otherParticipants[0].userId)
    : null;
  const conversationDisplayTitle = getConversationDisplayName({
    fallbackTitles: {
      group: language === 'ru' ? 'Новая группа' : 'New group',
    },
    kind: conversation.kind === 'group' ? conversation.kind : null,
    participantLabels:
      conversation.kind === 'group' ? otherParticipantLabels : [],
    title: conversation.title,
  });
  const directConversationDisplayTitle =
    conversation.kind === 'dm'
      ? getDirectMessageDisplayName(otherParticipantLabels, t.chat.unknownUser)
      : conversationDisplayTitle;
  const groupMemberSummary =
    conversation.kind === 'group'
      ? formatGroupMemberSummary(
          participants.map((participant) => participant.userId),
          user.id,
          senderNames,
          language,
          t,
        )
      : null;
  const currentUserGroupRole =
    conversation.kind === 'group'
      ? participants.find((participant) => participant.userId === user.id)?.role ?? 'member'
      : null;
  const groupJoinPolicy =
    conversation.kind === 'group'
      ? normalizeGroupConversationJoinPolicy(conversation.joinPolicy)
      : null;
  const canEditGroupIdentity =
    conversation.kind === 'group' &&
    canEditGroupConversationIdentity(currentUserGroupRole);
  const canManageGroupParticipants =
    conversation.kind === 'group' &&
    groupJoinPolicy !== null &&
    canAddParticipantsToGroupConversation(
      groupJoinPolicy,
      currentUserGroupRole,
    );
  const canDeleteDirectConversation =
    conversation.kind === 'dm' &&
    participants.some((participant) => participant.userId === user.id);
  const historyBaselineStartsAfterLatest =
    conversation.visibleFromSeq !== null &&
    conversation.latestMessageSeq !== null &&
    conversation.visibleFromSeq > conversation.latestMessageSeq;
  const canResetVisibleHistoryBaseline = conversation.latestMessageSeq !== null;
  const participantItems = participants.map((participant) => {
    const identity = identitiesByUserId.get(participant.userId);
    const label = resolvePublicIdentityLabel(identity, t.chat.unknownUser);

    return {
      canRemove:
        conversation.kind === 'group' &&
        canManageGroupParticipants &&
        participant.userId !== user.id &&
        canRemoveParticipantFromGroupConversation(
          currentUserGroupRole,
          participant.role,
        ),
      identity,
      isCurrentUser: participant.userId === user.id,
      label,
      role: participant.role ?? 'member',
      roleLabel: formatParticipantRoleLabel(participant.role ?? 'member', t),
      userId: participant.userId,
    };
  });
  const activeParticipantUserIds = new Set(participants.map((participant) => participant.userId));
  const availableParticipantsToAdd = availableUsers
    .filter((availableUser) => !activeParticipantUserIds.has(availableUser.userId))
    .map((availableUser) => ({
      ...availableUser,
      label: resolvePublicIdentityLabel(availableUser, t.chat.unknownUser),
    }));
  const totalMessages = messageStats?.totalMessages ?? 0;
  const dmPrimaryParticipant =
    participantItems.find((participant) => !participant.isCurrentUser) ?? null;
  const currentUserMessageCount = messageStats?.perSenderCount.get(user.id) ?? 0;
  const otherParticipantMessageCount =
    dmPrimaryParticipant && messageStats
      ? messageStats.perSenderCount.get(dmPrimaryParticipant.userId) ?? 0
      : 0;
  const currentUserShare =
    totalMessages > 0 ? Math.round((currentUserMessageCount / totalMessages) * 100) : 0;
  const otherParticipantShare =
    totalMessages > 0 ? Math.round((otherParticipantMessageCount / totalMessages) * 100) : 0;
  const shareDelta = Math.abs(currentUserMessageCount - otherParticipantMessageCount);
  const leadingParticipantLabel =
    currentUserMessageCount === otherParticipantMessageCount
      ? null
      : currentUserMessageCount > otherParticipantMessageCount
        ? t.chat.you
        : dmPrimaryParticipant?.label ?? t.chat.unknownUser;

  return {
    activeSpaceId,
    availableParticipantsToAdd,
    canDeleteDirectConversation,
    canEditGroupIdentity,
    canManageGroupParticipants,
    canResetVisibleHistoryBaseline,
    conversation,
    currentUserId: user.id,
    currentUserMessageCount,
    currentUserShare,
    directConversationDisplayTitle,
    directParticipantIdentity,
    dmPrimaryParticipant,
    groupJoinPolicy,
    groupMemberSummary,
    hasSettingsSavedState,
    historyBaselineStartsAfterLatest,
    identitiesByUserId,
    language,
    leadingParticipantLabel,
    otherParticipantMessageCount,
    otherParticipantShare,
    participantItems,
    participants,
    shareDelta,
    t,
    totalMessages,
    visibleSettingsError,
  };
}
