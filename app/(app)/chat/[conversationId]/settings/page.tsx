import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  formatMemberCount,
  formatPersonFallbackLabel,
  getLocaleForLanguage,
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getAvailableUsers,
  getConversationDisplayName,
  getConversationForUser,
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
import {
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/messaging/ui/identity';
import {
  IdentityStatusInline,
  hasIdentityStatus,
} from '@/modules/messaging/ui/identity-status';
import { resolvePublicIdentityLabel } from '@/modules/messaging/ui/identity-label';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import {
  isSpaceMembersSchemaCacheErrorMessage,
  resolveActiveSpaceForUser,
  resolveV1TestSpaceFallback,
} from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  addGroupParticipantsAction,
  hideConversationAction,
  leaveGroupAction,
  removeGroupParticipantAction,
  resetConversationHistoryBaselineAction,
  updateConversationNotificationLevelAction,
} from '../actions';
import { DmChatDeleteConfirmForm } from '../dm-chat-delete-confirm-form';
import { GroupChatSettingsForm } from '../group-chat-settings-form';
import { GuardedServerActionForm } from '../../../guarded-server-action-form';
import { PendingSubmitButton } from '../../../pending-submit-button';

type ChatSettingsPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    space?: string;
  }>;
};

function parseSafeDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatLongDate(
  value: string | null,
  language: AppLanguage,
  t: ReturnType<typeof getTranslations>,
) {
  const parsedDate = parseSafeDate(value);

  if (!parsedDate) {
    return t.chat.unknown;
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
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

export default async function ChatSettingsPage({
  params,
  searchParams,
}: ChatSettingsPageProps) {
  const { conversationId } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect('/login');
  }

  let activeSpaceId: string | null = null;
  let conversation = null as Awaited<ReturnType<typeof getConversationForUser>> | null;
  let isV1TestBypass = false;
  const requestedSpaceId = query.space?.trim() || null;

  if (requestedSpaceId) {
    const explicitV1TestSpace = await resolveV1TestSpaceFallback({
      requestedSpaceId,
      source: 'chat-settings-page-explicit-v1-test-bypass',
    });

    if (explicitV1TestSpace) {
      activeSpaceId = explicitV1TestSpace.id;
      isV1TestBypass = true;
      conversation = await getConversationForUser(conversationId, user.id, {
        spaceId: activeSpaceId,
      });
    } else {
      conversation = await getConversationForUser(conversationId, user.id, {
        spaceId: requestedSpaceId,
      });

      if (conversation) {
        activeSpaceId = requestedSpaceId;
      }
    }
  }

  if (!conversation || !activeSpaceId) {
    const baseConversation =
      conversation ?? (await getConversationForUser(conversationId, user.id));

    if (!baseConversation) {
      notFound();
    }

    if (!baseConversation.spaceId) {
      throw new Error('Active space routing requires public.conversations.space_id.');
    }

    const fallbackRequestedSpaceId = requestedSpaceId || baseConversation.spaceId;
    const explicitV1TestSpace = await resolveV1TestSpaceFallback({
      requestedSpaceId: fallbackRequestedSpaceId,
      source: 'chat-settings-page-explicit-v1-test-bypass',
    });
    isV1TestBypass = Boolean(explicitV1TestSpace);

    if (explicitV1TestSpace) {
      activeSpaceId = explicitV1TestSpace.id;
    } else {
      let activeSpaceState: Awaited<
        ReturnType<typeof resolveActiveSpaceForUser>
      > | null = null;

      try {
        activeSpaceState = await resolveActiveSpaceForUser({
          userId: user.id,
          userEmail: user.email ?? null,
          requestedSpaceId: fallbackRequestedSpaceId,
          source: 'chat-settings-page',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (isSpaceMembersSchemaCacheErrorMessage(message)) {
          const fallbackSpace = await resolveV1TestSpaceFallback({
            requestedSpaceId: fallbackRequestedSpaceId,
            source: 'chat-settings-page',
          });

          if (!fallbackSpace) {
            redirect('/spaces');
          }

          activeSpaceId = fallbackSpace.id;
        } else {
          throw error;
        }
      }

      if (!activeSpaceId) {
        if (
          !activeSpaceState?.activeSpace ||
          activeSpaceState.requestedSpaceWasInvalid
        ) {
          notFound();
        }

        activeSpaceId = activeSpaceState.activeSpace.id;
      }
    }

    if (!activeSpaceId) {
      redirect('/spaces');
    }

    conversation = await getConversationForUser(conversationId, user.id, {
      spaceId: activeSpaceId,
    });

    if (!conversation) {
      notFound();
    }
  }

  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const visibleSettingsError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'chat-settings'),
        language,
        rawMessage: query.error,
      })
    : null;
  const hasSettingsSavedState = query.saved === '1';
  const [participants, participantIdentities, availableUsers, messageStats] =
    await Promise.all([
      getConversationParticipants(conversationId),
      getConversationParticipantIdentities([conversationId]),
      conversation.kind === 'group' && !isV1TestBypass
        ? getAvailableUsers(user.id, { spaceId: activeSpaceId })
        : Promise.resolve([]),
      conversation.kind === 'dm'
        ? getConversationMessageStats(conversationId)
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
    kind: conversation.kind === 'group' ? conversation.kind : null,
    title: conversation.title,
    participantLabels:
      conversation.kind === 'group' ? otherParticipantLabels : [],
    fallbackTitles: {
      group: language === 'ru' ? 'Новая группа' : 'New group',
    },
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
      userId: participant.userId,
      identity,
      isCurrentUser: participant.userId === user.id,
      label,
      role: participant.role ?? 'member',
      roleLabel: formatParticipantRoleLabel(participant.role ?? 'member', t),
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
  const dmPrimaryParticipant = participantItems.find((participant) => !participant.isCurrentUser) ?? null;
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

  return (
    <section className="stack settings-screen settings-shell conversation-settings-route-screen">
      <section className="stack settings-hero conversation-settings-route-hero">
        <div className="conversation-settings-header conversation-settings-route-header">
          <Link
            aria-label={t.chat.backToChats}
            className="back-arrow-link conversation-settings-back-link"
            href={withSpaceParam(`/chat/${conversationId}`, activeSpaceId)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      </section>

      <section className="card stack settings-surface conversation-settings-route-surface">
        {visibleSettingsError ? (
          <p className="notice notice-error">{visibleSettingsError}</p>
        ) : null}

        {hasSettingsSavedState ? (
          <div className="notice notice-success notice-inline conversation-settings-success">
            <span aria-hidden="true" className="notice-check conversation-settings-success-check">
              ✓
            </span>
            <span className="notice-copy conversation-settings-success-copy">
              {t.chat.changesSaved}
            </span>
          </div>
        ) : null}

        <section className="conversation-info-summary">
          <div className="conversation-info-identity">
            {conversation.kind === 'group' ? (
              <GroupIdentityAvatar
                avatarPath={conversation.avatarPath}
                label={directConversationDisplayTitle}
                size="lg"
              />
            ) : (
              <IdentityAvatar
                diagnosticsSurface="chat-settings:summary"
                identity={directParticipantIdentity}
                label={directConversationDisplayTitle}
                size="lg"
              />
            )}

            <div className="stack conversation-info-copy">
              <h1 className="conversation-info-title">{directConversationDisplayTitle}</h1>
              {conversation.kind === 'group' ? (
                <p className="muted conversation-info-subtitle">
                  {groupMemberSummary}
                </p>
              ) : hasIdentityStatus(directParticipantIdentity) ? (
                <IdentityStatusInline
                  className="conversation-info-status"
                  identity={directParticipantIdentity}
                />
              ) : (
                <p className="muted conversation-info-subtitle">
                  {t.chat.directChat}
                </p>
              )}
            </div>
          </div>

          <div className="conversation-info-meta">
            <span className="conversation-info-meta-item">
              {conversation.kind === 'group' ? t.chat.group : t.chat.person}
            </span>
            <span className="conversation-info-meta-item">
              {t.chat.startedAt(formatLongDate(conversation.createdAt ?? null, language, t))}
            </span>
            {conversation.kind === 'group' ? (
              <span className="conversation-info-meta-item">
                {formatMemberCount(language, participants.length)}
              </span>
            ) : null}
          </div>
        </section>

        <dl className="conversation-info-list">
          <div className="conversation-info-row">
            <dt className="conversation-info-label">{t.chat.type}</dt>
            <dd className="conversation-info-value">
              {conversation.kind === 'group' ? t.inbox.create.group : t.chat.directChat}
            </dd>
          </div>
          {conversation.kind === 'group' ? (
            <div className="conversation-info-row">
              <dt className="conversation-info-label">{t.chat.members}</dt>
              <dd className="conversation-info-value">
                {formatMemberCount(language, participants.length)}
              </dd>
            </div>
          ) : null}
          {conversation.kind === 'group' ? (
            <div className="conversation-info-row">
              <dt className="conversation-info-label">{t.chat.groupPrivacy}</dt>
              <dd className="conversation-info-value">
                {groupJoinPolicy === 'open'
                  ? t.chat.groupPrivacyOpen
                  : t.chat.groupPrivacyClosed}
              </dd>
            </div>
          ) : null}
          <div className="conversation-info-row">
            <dt className="conversation-info-label">{t.chat.started}</dt>
            <dd className="conversation-info-value">
              {formatLongDate(conversation.createdAt ?? null, language, t)}
            </dd>
          </div>
        </dl>

        <section className="conversation-settings-panel stack">
          <div className="stack conversation-settings-panel-copy">
            <h3 className="card-title">{t.chat.people}</h3>
            <p className="muted conversation-settings-note">
              {conversation.kind === 'group'
                ? formatMemberCount(language, participants.length)
                : t.chat.inThisChat}
            </p>
          </div>

          <div className="conversation-member-list">
            {participantItems.map((participant) => (
              <div
                key={participant.userId}
                className="conversation-member-row"
              >
                <div className="conversation-member-identity">
                  <IdentityAvatar
                    diagnosticsSurface="chat-settings:participant-item"
                    identity={participant.identity}
                    label={participant.label}
                    size="sm"
                  />
                  <div className="stack conversation-member-copy">
                    <div className="conversation-member-title-row">
                      <span className="user-label">{participant.label}</span>
                      <IdentityStatusInline
                        className="conversation-member-status"
                        identity={participant.identity}
                      />
                    </div>
                    <div className="conversation-member-meta">
                      {conversation.kind === 'group' ? (
                        <span className="conversation-role-chip">
                          {participant.roleLabel}
                        </span>
                      ) : null}
                      {participant.isCurrentUser ? (
                        <span className="conversation-member-self-chip">{t.chat.you}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {conversation.kind === 'group' &&
                canManageGroupParticipants &&
                !participant.isCurrentUser &&
                canRemoveParticipantFromGroupConversation(
                  currentUserGroupRole,
                  participant.role,
                ) ? (
                  <GuardedServerActionForm action={removeGroupParticipantAction}>
                    <input name="conversationId" type="hidden" value={conversationId} />
                    <input name="returnTo" type="hidden" value="settings-screen" />
                    <input name="spaceId" type="hidden" value={activeSpaceId ?? ''} />
                    <input name="targetUserId" type="hidden" value={participant.userId} />
                    <PendingSubmitButton
                      className="button button-compact button-danger-subtle"
                      type="submit"
                    >
                      {t.chat.remove}
                    </PendingSubmitButton>
                  </GuardedServerActionForm>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {conversation.kind === 'group' ? (
          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">{t.chat.groupSection}</h3>
              <p className="muted conversation-settings-note">
                {t.chat.nameAndPeople}
              </p>
            </div>

            <div className="conversation-group-actions">
              {canEditGroupIdentity ? (
                <GroupChatSettingsForm
                  key={`group-settings-${conversation.title ?? ''}-${conversation.avatarPath ?? ''}-${groupJoinPolicy ?? 'closed'}-${hasSettingsSavedState ? 'saved' : 'idle'}`}
                  conversationId={conversationId}
                  currentUserId={user.id}
                  defaultAvatarPath={conversation.avatarPath}
                  defaultJoinPolicy={groupJoinPolicy ?? 'closed'}
                  defaultTitle={conversation.title?.trim() || ''}
                  labels={{
                    title: t.chat.chatIdentity,
                    subtitle: t.chat.chatIdentityNote,
                    name: t.chat.name,
                    namePlaceholder: t.chat.groupNamePlaceholder,
                    nameRequired: t.chat.groupNameRequired,
                    changePhoto: t.chat.changePhoto,
                    removePhoto: t.chat.removePhoto,
                    saveChanges: t.chat.saveChanges,
                    cancelEdit: t.chat.cancel,
                    avatarDraftReady: t.chat.chatAvatarDraftReady,
                    avatarRemovedDraft: t.chat.chatAvatarRemovedDraft,
                    avatarUploading: t.chat.avatarUploading,
                    avatarTooLarge: t.chat.avatarTooLarge,
                    avatarInvalidType: t.chat.avatarInvalidType,
                    avatarUploadFailed: t.chat.avatarUploadFailed,
                    avatarSchemaRequired: t.chat.avatarSchemaRequired,
                    avatarStorageUnavailable: t.chat.avatarStorageUnavailable,
                    tapPhotoToChange: t.settings.tapPhotoToChange,
                    avatarEditorHint: t.settings.avatarEditorHint,
                    avatarEditorZoom: t.settings.avatarEditorZoom,
                    avatarEditorApply: t.settings.avatarEditorApply,
                    avatarEditorPreparing: t.settings.avatarEditorPreparing,
                    avatarEditorLoadFailed: t.settings.avatarEditorLoadFailed,
                    avatarEditorApplyBeforeSave:
                      t.settings.avatarEditorApplyBeforeSave,
                    privacyTitle: t.chat.groupPrivacy,
                    privacyNote: t.chat.groupPrivacyNote,
                    privacyOpen: t.chat.groupPrivacyOpen,
                    privacyOpenNote: t.chat.groupPrivacyOpenNote,
                    privacyClosed: t.chat.groupPrivacyClosed,
                    privacyClosedNote: t.chat.groupPrivacyClosedNote,
                  }}
                  returnTo="settings-screen"
                  spaceId={activeSpaceId}
                />
              ) : (
                <section className="stack conversation-settings-subsection">
                  <div className="stack conversation-settings-panel-copy">
                    <h4 className="conversation-settings-subtitle">{t.chat.chatIdentity}</h4>
                    <div className="conversation-settings-static conversation-settings-group-identity-preview">
                      <GroupIdentityAvatar
                        avatarPath={conversation.avatarPath}
                        label={directConversationDisplayTitle}
                        size="md"
                      />
                      <div className="stack conversation-settings-group-identity-copy">
                        <p className="conversation-settings-title-preview">
                          {directConversationDisplayTitle}
                        </p>
                        <p className="muted conversation-settings-note">
                          {t.chat.adminOnly}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className="stack conversation-settings-subsection conversation-participant-manager">
                <div className="stack conversation-settings-panel-copy">
                  <h4 className="conversation-settings-subtitle">{t.chat.addPeople}</h4>
                  <p className="muted conversation-settings-note">
                    {groupJoinPolicy === 'open'
                      ? t.chat.groupOpenMembersCanAdd
                      : t.chat.groupClosedAdminsOnly}
                  </p>
                </div>

                {canManageGroupParticipants ? (
                  availableParticipantsToAdd.length === 0 ? (
                    <p className="muted conversation-settings-note">
                      {t.chat.everyoneIsHere}
                    </p>
                  ) : (
                    <GuardedServerActionForm
                      action={addGroupParticipantsAction}
                      className="stack compact-form"
                    >
                      <input name="conversationId" type="hidden" value={conversationId} />
                      <input name="returnTo" type="hidden" value="settings-screen" />
                      <input name="spaceId" type="hidden" value={activeSpaceId ?? ''} />
                      <div className="checkbox-list conversation-checkbox-list">
                        {availableParticipantsToAdd.map((participant) => (
                          <label
                            key={`add-${participant.userId}`}
                            className="checkbox-row"
                          >
                            <input
                              name="participantUserIds"
                              type="checkbox"
                              value={participant.userId}
                            />
                            <span className="checkbox-copy">
                              <span className="checkbox-identity">
                                <IdentityAvatar
                                  diagnosticsSurface="chat-settings:add-participant"
                                  identity={participant}
                                  label={participant.label}
                                  size="sm"
                                />
                              </span>
                              <span className="stack user-copy">
                                <span className="user-label">{participant.label}</span>
                                <IdentityStatusInline
                                  className="user-status-inline"
                                  identity={participant}
                                />
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <PendingSubmitButton className="button button-compact" type="submit">
                        {t.chat.addPeople}
                      </PendingSubmitButton>
                    </GuardedServerActionForm>
                  )
                ) : null}
              </section>

              <section className="stack conversation-settings-subsection conversation-leave-panel">
                <div className="stack conversation-settings-panel-copy">
                  <h4 className="conversation-settings-subtitle">{t.chat.leaveGroup}</h4>
                </div>
                <GuardedServerActionForm action={leaveGroupAction}>
                  <input name="conversationId" type="hidden" value={conversationId} />
                  <input name="returnTo" type="hidden" value="settings-screen" />
                  <input name="spaceId" type="hidden" value={activeSpaceId ?? ''} />
                  <PendingSubmitButton
                    className="button button-compact button-danger-subtle"
                    type="submit"
                  >
                    {t.chat.leaveGroupButton}
                  </PendingSubmitButton>
                </GuardedServerActionForm>
              </section>
            </div>
          </section>
        ) : (
          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">{t.chat.messageStatsTitle}</h3>
              <p className="muted conversation-settings-note">
                {t.chat.messageStatsNote}
              </p>
            </div>

            <div className="conversation-stats-grid">
              <div className="conversation-stats-card">
                <span className="conversation-stats-label">{t.chat.totalMessagesStat}</span>
                <strong className="conversation-stats-value">{totalMessages}</strong>
              </div>
              <div className="conversation-stats-card">
                <span className="conversation-stats-label">{t.chat.messageSplitStat}</span>
                <strong className="conversation-stats-value">
                  {currentUserShare}% / {otherParticipantShare}%
                </strong>
              </div>
            </div>

            <div className="conversation-member-list conversation-stats-list">
              <div className="conversation-member-row conversation-stats-row">
                <div className="conversation-member-identity">
                  <IdentityAvatar
                    diagnosticsSurface="chat-settings:stats-self"
                    identity={identitiesByUserId.get(user.id)}
                    label={participantItems.find((participant) => participant.isCurrentUser)?.label ?? t.chat.you}
                    size="sm"
                  />
                  <div className="stack conversation-member-copy">
                    <span className="user-label">{t.chat.you}</span>
                    <span className="muted conversation-settings-note">
                      {currentUserMessageCount} · {currentUserShare}%
                    </span>
                  </div>
                </div>
              </div>
              {dmPrimaryParticipant ? (
                <div className="conversation-member-row conversation-stats-row">
                  <div className="conversation-member-identity">
                    <IdentityAvatar
                      diagnosticsSurface="chat-settings:stats-other"
                      identity={dmPrimaryParticipant.identity}
                      label={dmPrimaryParticipant.label}
                      size="sm"
                    />
                    <div className="stack conversation-member-copy">
                      <span className="user-label">{dmPrimaryParticipant.label}</span>
                      <span className="muted conversation-settings-note">
                        {otherParticipantMessageCount} · {otherParticipantShare}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <p className="muted conversation-settings-note">
              {leadingParticipantLabel
                ? t.chat.messageLeadSummary(leadingParticipantLabel, shareDelta)
                : t.chat.messageLeadTie}
            </p>
          </section>
        )}

        <section className="conversation-settings-panel stack">
          <div className="stack conversation-settings-panel-copy">
            <h3 className="card-title">{t.chat.historySection}</h3>
            <p className="muted conversation-settings-note">
              {historyBaselineStartsAfterLatest
                ? t.chat.historyBaselineActiveNote
                : t.chat.historyBaselineNote}
            </p>
          </div>

          <div className="conversation-manage-actions">
            <GuardedServerActionForm action={resetConversationHistoryBaselineAction}>
              <input name="conversationId" type="hidden" value={conversationId} />
              <input name="returnTo" type="hidden" value="settings-screen" />
              <input name="spaceId" type="hidden" value={activeSpaceId ?? ''} />
              <PendingSubmitButton
                className="button button-compact button-secondary"
                disabled={!canResetVisibleHistoryBaseline}
                type="submit"
              >
                {t.chat.historyBaselineAction}
              </PendingSubmitButton>
            </GuardedServerActionForm>
          </div>
        </section>

        <section className="conversation-settings-panel stack">
          <div className="stack conversation-settings-panel-copy">
            <h3 className="card-title">{t.chat.notifications}</h3>
            <p className="muted conversation-settings-note">
              {t.chat.notificationsNote}
            </p>
          </div>

          <GuardedServerActionForm
            action={updateConversationNotificationLevelAction}
            className="conversation-notification-form"
          >
            <input name="conversationId" type="hidden" value={conversationId} />
            <input name="returnTo" type="hidden" value="settings-screen" />
            <input name="spaceId" type="hidden" value={activeSpaceId ?? ''} />

            <PendingSubmitButton
              className={
                conversation.notificationLevel === 'default'
                  ? 'conversation-choice-button conversation-choice-button-active'
                  : 'conversation-choice-button'
              }
              name="notificationLevel"
              type="submit"
              value="default"
            >
              <span className="conversation-choice-copy">
                <span className="conversation-choice-title">{t.chat.notificationsDefault}</span>
                <span className="conversation-choice-note">
                  {t.chat.notificationsDefaultNote}
                </span>
              </span>
            </PendingSubmitButton>

            <PendingSubmitButton
              className={
                conversation.notificationLevel === 'muted'
                  ? 'conversation-choice-button conversation-choice-button-active'
                  : 'conversation-choice-button'
              }
              name="notificationLevel"
              type="submit"
              value="muted"
            >
              <span className="conversation-choice-copy">
                <span className="conversation-choice-title">{t.chat.notificationsMuted}</span>
                <span className="conversation-choice-note">
                  {t.chat.notificationsMutedNote}
                </span>
              </span>
            </PendingSubmitButton>
          </GuardedServerActionForm>
        </section>

        {canDeleteDirectConversation ? (
          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">{t.chat.deleteChat}</h3>
              <p className="muted conversation-settings-note">
                {t.chat.deleteChatCurrentUserOnlyNote}
              </p>
            </div>

            <div className="conversation-manage-actions">
              <DmChatDeleteConfirmForm
                cancelLabel={t.chat.cancel}
                confirmBody={t.chat.deleteChatConfirmBody}
                confirmButtonLabel={t.chat.deleteChatConfirmButton}
                confirmHint={t.chat.deleteChatConfirmHint}
                confirmPlaceholder={t.chat.deleteChatConfirmPlaceholder}
                confirmTitle={t.chat.deleteChatConfirmTitle}
                conversationId={conversationId}
                deleteButtonLabel={t.chat.deleteChatButton}
                returnTo="settings-screen"
                spaceId={activeSpaceId}
              />
            </div>
          </section>
        ) : conversation.kind === 'group' ? (
          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">{t.chat.inbox}</h3>
              <p className="muted conversation-settings-note">
                {t.chat.inboxNote}
              </p>
            </div>

            <div className="conversation-manage-actions">
              <GuardedServerActionForm action={hideConversationAction}>
                <input name="conversationId" type="hidden" value={conversationId} />
                <input name="spaceId" type="hidden" value={activeSpaceId ?? ''} />
                <PendingSubmitButton
                  className="button button-compact button-secondary"
                  type="submit"
                >
                  {t.chat.hideFromInbox}
                </PendingSubmitButton>
              </GuardedServerActionForm>
                </div>
              </section>
        ) : null}
      </section>
    </section>
  );
}
