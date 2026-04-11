import {
  formatMemberCount,
  getLocaleForLanguage,
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import { loadMessengerThreadSettingsPageData } from '@/modules/messaging/server/thread-settings-page';
import {
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/profile/ui/identity';
import {
  IdentityStatusInline,
  hasIdentityStatus,
} from '@/modules/profile/ui/identity-status';
import { withSpaceParam } from '@/modules/spaces/url';
import Link from 'next/link';
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

export default async function ChatSettingsPage({
  params,
  searchParams,
}: ChatSettingsPageProps) {
  const { conversationId } = await params;
  const query = await searchParams;
  const data = await loadMessengerThreadSettingsPageData({
    conversationId,
    query,
  });

  return (
    <section className="stack settings-screen settings-shell conversation-settings-route-screen">
      <section className="stack settings-hero conversation-settings-route-hero">
        <div className="conversation-settings-header conversation-settings-route-header">
          <Link
            aria-label={data.t.chat.backToChats}
            className="back-arrow-link conversation-settings-back-link"
            href={withSpaceParam(`/chat/${conversationId}`, data.activeSpaceId)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      </section>

      <section className="card stack settings-surface conversation-settings-route-surface">
        {data.visibleSettingsError ? (
          <p className="notice notice-error">{data.visibleSettingsError}</p>
        ) : null}

        {data.hasSettingsSavedState ? (
          <div className="notice notice-success notice-inline conversation-settings-success">
            <span aria-hidden="true" className="notice-check conversation-settings-success-check">
              ✓
            </span>
            <span className="notice-copy conversation-settings-success-copy">
              {data.t.chat.changesSaved}
            </span>
          </div>
        ) : null}

        <section className="conversation-info-summary">
          <div className="conversation-info-identity">
            {data.conversation.kind === 'group' ? (
              <GroupIdentityAvatar
                avatarPath={data.conversation.avatarPath}
                label={data.directConversationDisplayTitle}
                size="lg"
              />
            ) : (
              <IdentityAvatar
                diagnosticsSurface="chat-settings:summary"
                identity={data.directParticipantIdentity}
                label={data.directConversationDisplayTitle}
                size="lg"
              />
            )}

            <div className="stack conversation-info-copy">
              <h1 className="conversation-info-title">{data.directConversationDisplayTitle}</h1>
              {data.conversation.kind === 'group' ? (
                <p className="muted conversation-info-subtitle">
                  {data.groupMemberSummary}
                </p>
              ) : hasIdentityStatus(data.directParticipantIdentity) ? (
                <IdentityStatusInline
                  className="conversation-info-status"
                  identity={data.directParticipantIdentity}
                />
              ) : (
                <p className="muted conversation-info-subtitle">
                  {data.t.chat.directChat}
                </p>
              )}
            </div>
          </div>

          <div className="conversation-info-meta">
            <span className="conversation-info-meta-item">
              {data.conversation.kind === 'group' ? data.t.chat.group : data.t.chat.person}
            </span>
            <span className="conversation-info-meta-item">
              {data.t.chat.startedAt(formatLongDate(data.conversation.createdAt ?? null, data.language, data.t))}
            </span>
            {data.conversation.kind === 'group' ? (
              <span className="conversation-info-meta-item">
                {formatMemberCount(data.language, data.participants.length)}
              </span>
            ) : null}
          </div>
        </section>

        <dl className="conversation-info-list">
          <div className="conversation-info-row">
            <dt className="conversation-info-label">{data.t.chat.type}</dt>
            <dd className="conversation-info-value">
              {data.conversation.kind === 'group' ? data.t.inbox.create.group : data.t.chat.directChat}
            </dd>
          </div>
          {data.conversation.kind === 'group' ? (
            <div className="conversation-info-row">
              <dt className="conversation-info-label">{data.t.chat.members}</dt>
              <dd className="conversation-info-value">
                {formatMemberCount(data.language, data.participants.length)}
              </dd>
            </div>
          ) : null}
          {data.conversation.kind === 'group' ? (
            <div className="conversation-info-row">
              <dt className="conversation-info-label">{data.t.chat.groupPrivacy}</dt>
              <dd className="conversation-info-value">
                {data.groupJoinPolicy === 'open'
                  ? data.t.chat.groupPrivacyOpen
                  : data.t.chat.groupPrivacyClosed}
              </dd>
            </div>
          ) : null}
          <div className="conversation-info-row">
            <dt className="conversation-info-label">{data.t.chat.started}</dt>
            <dd className="conversation-info-value">
              {formatLongDate(data.conversation.createdAt ?? null, data.language, data.t)}
            </dd>
          </div>
        </dl>

        <section className="conversation-settings-panel stack">
          <div className="stack conversation-settings-panel-copy">
            <h3 className="card-title">{data.t.chat.people}</h3>
            <p className="muted conversation-settings-note">
              {data.conversation.kind === 'group'
                ? formatMemberCount(data.language, data.participants.length)
                : data.t.chat.inThisChat}
            </p>
          </div>

          <div className="conversation-member-list">
            {data.participantItems.map((participant) => (
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
                      {data.conversation.kind === 'group' ? (
                        <span className="conversation-role-chip">
                          {participant.roleLabel}
                        </span>
                      ) : null}
                      {participant.isCurrentUser ? (
                        <span className="conversation-member-self-chip">{data.t.chat.you}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {data.conversation.kind === 'group' && participant.canRemove ? (
                  <GuardedServerActionForm action={removeGroupParticipantAction}>
                    <input name="conversationId" type="hidden" value={conversationId} />
                    <input name="returnTo" type="hidden" value="settings-screen" />
                    <input name="spaceId" type="hidden" value={data.activeSpaceId ?? ''} />
                    <input name="targetUserId" type="hidden" value={participant.userId} />
                    <PendingSubmitButton
                      className="button button-compact button-danger-subtle"
                      type="submit"
                    >
                      {data.t.chat.remove}
                    </PendingSubmitButton>
                  </GuardedServerActionForm>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {data.conversation.kind === 'group' ? (
          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">{data.t.chat.groupSection}</h3>
              <p className="muted conversation-settings-note">
                {data.t.chat.nameAndPeople}
              </p>
            </div>

            <div className="conversation-group-actions">
              {data.canEditGroupIdentity ? (
                <GroupChatSettingsForm
                  key={`group-settings-${data.conversation.title ?? ''}-${data.conversation.avatarPath ?? ''}-${data.groupJoinPolicy ?? 'closed'}-${data.hasSettingsSavedState ? 'saved' : 'idle'}`}
                  conversationId={conversationId}
                  currentUserId={data.currentUserId}
                  defaultAvatarPath={data.conversation.avatarPath}
                  defaultJoinPolicy={data.groupJoinPolicy ?? 'closed'}
                  defaultTitle={data.conversation.title?.trim() || ''}
                  labels={{
                    title: data.t.chat.chatIdentity,
                    subtitle: data.t.chat.chatIdentityNote,
                    name: data.t.chat.name,
                    namePlaceholder: data.t.chat.groupNamePlaceholder,
                    nameRequired: data.t.chat.groupNameRequired,
                    changePhoto: data.t.chat.changePhoto,
                    removePhoto: data.t.chat.removePhoto,
                    saveChanges: data.t.chat.saveChanges,
                    cancelEdit: data.t.chat.cancel,
                    avatarDraftReady: data.t.chat.chatAvatarDraftReady,
                    avatarRemovedDraft: data.t.chat.chatAvatarRemovedDraft,
                    avatarUploading: data.t.chat.avatarUploading,
                    avatarTooLarge: data.t.chat.avatarTooLarge,
                    avatarInvalidType: data.t.chat.avatarInvalidType,
                    avatarUploadFailed: data.t.chat.avatarUploadFailed,
                    avatarSchemaRequired: data.t.chat.avatarSchemaRequired,
                    avatarStorageUnavailable: data.t.chat.avatarStorageUnavailable,
                    tapPhotoToChange: data.t.settings.tapPhotoToChange,
                    avatarEditorHint: data.t.settings.avatarEditorHint,
                    avatarEditorZoom: data.t.settings.avatarEditorZoom,
                    avatarEditorApply: data.t.settings.avatarEditorApply,
                    avatarEditorPreparing: data.t.settings.avatarEditorPreparing,
                    avatarEditorLoadFailed: data.t.settings.avatarEditorLoadFailed,
                    avatarEditorApplyBeforeSave:
                      data.t.settings.avatarEditorApplyBeforeSave,
                    privacyTitle: data.t.chat.groupPrivacy,
                    privacyNote: data.t.chat.groupPrivacyNote,
                    privacyOpen: data.t.chat.groupPrivacyOpen,
                    privacyOpenNote: data.t.chat.groupPrivacyOpenNote,
                    privacyClosed: data.t.chat.groupPrivacyClosed,
                    privacyClosedNote: data.t.chat.groupPrivacyClosedNote,
                  }}
                  returnTo="settings-screen"
                  spaceId={data.activeSpaceId}
                />
              ) : (
                <section className="stack conversation-settings-subsection">
                  <div className="stack conversation-settings-panel-copy">
                    <h4 className="conversation-settings-subtitle">{data.t.chat.chatIdentity}</h4>
                    <div className="conversation-settings-static conversation-settings-group-identity-preview">
                      <GroupIdentityAvatar
                        avatarPath={data.conversation.avatarPath}
                        label={data.directConversationDisplayTitle}
                        size="md"
                      />
                      <div className="stack conversation-settings-group-identity-copy">
                        <p className="conversation-settings-title-preview">
                          {data.directConversationDisplayTitle}
                        </p>
                        <p className="muted conversation-settings-note">
                          {data.t.chat.adminOnly}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className="stack conversation-settings-subsection conversation-participant-manager">
                <div className="stack conversation-settings-panel-copy">
                  <h4 className="conversation-settings-subtitle">{data.t.chat.addPeople}</h4>
                  <p className="muted conversation-settings-note">
                    {data.groupJoinPolicy === 'open'
                      ? data.t.chat.groupOpenMembersCanAdd
                      : data.t.chat.groupClosedAdminsOnly}
                  </p>
                </div>

                {data.canManageGroupParticipants ? (
                  data.availableParticipantsToAdd.length === 0 ? (
                    <p className="muted conversation-settings-note">
                      {data.t.chat.everyoneIsHere}
                    </p>
                  ) : (
                    <GuardedServerActionForm
                      action={addGroupParticipantsAction}
                      className="stack compact-form"
                    >
                      <input name="conversationId" type="hidden" value={conversationId} />
                      <input name="returnTo" type="hidden" value="settings-screen" />
                      <input name="spaceId" type="hidden" value={data.activeSpaceId ?? ''} />
                      <div className="checkbox-list conversation-checkbox-list">
                        {data.availableParticipantsToAdd.map((participant) => (
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
                        {data.t.chat.addPeople}
                      </PendingSubmitButton>
                    </GuardedServerActionForm>
                  )
                ) : null}
              </section>

              <section className="stack conversation-settings-subsection conversation-leave-panel">
                <div className="stack conversation-settings-panel-copy">
                  <h4 className="conversation-settings-subtitle">{data.t.chat.leaveGroup}</h4>
                </div>
                <GuardedServerActionForm action={leaveGroupAction}>
                  <input name="conversationId" type="hidden" value={conversationId} />
                  <input name="returnTo" type="hidden" value="settings-screen" />
                  <input name="spaceId" type="hidden" value={data.activeSpaceId ?? ''} />
                  <PendingSubmitButton
                    className="button button-compact button-danger-subtle"
                    type="submit"
                  >
                    {data.t.chat.leaveGroupButton}
                  </PendingSubmitButton>
                </GuardedServerActionForm>
              </section>
            </div>
          </section>
        ) : (
          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">{data.t.chat.messageStatsTitle}</h3>
              <p className="muted conversation-settings-note">
                {data.t.chat.messageStatsNote}
              </p>
            </div>

            <div className="conversation-stats-grid">
              <div className="conversation-stats-card">
                <span className="conversation-stats-label">{data.t.chat.totalMessagesStat}</span>
                <strong className="conversation-stats-value">{data.totalMessages}</strong>
              </div>
              <div className="conversation-stats-card">
                <span className="conversation-stats-label">{data.t.chat.messageSplitStat}</span>
                <strong className="conversation-stats-value">
                  {data.currentUserShare}% / {data.otherParticipantShare}%
                </strong>
              </div>
            </div>

            <div className="conversation-member-list conversation-stats-list">
              <div className="conversation-member-row conversation-stats-row">
                <div className="conversation-member-identity">
                  <IdentityAvatar
                    diagnosticsSurface="chat-settings:stats-self"
                    identity={data.identitiesByUserId.get(data.currentUserId)}
                    label={data.participantItems.find((participant) => participant.isCurrentUser)?.label ?? data.t.chat.you}
                    size="sm"
                  />
                  <div className="stack conversation-member-copy">
                    <span className="user-label">{data.t.chat.you}</span>
                    <span className="muted conversation-settings-note">
                      {data.currentUserMessageCount} · {data.currentUserShare}%
                    </span>
                  </div>
                </div>
              </div>
              {data.dmPrimaryParticipant ? (
                <div className="conversation-member-row conversation-stats-row">
                  <div className="conversation-member-identity">
                    <IdentityAvatar
                      diagnosticsSurface="chat-settings:stats-other"
                      identity={data.dmPrimaryParticipant.identity}
                      label={data.dmPrimaryParticipant.label}
                      size="sm"
                    />
                    <div className="stack conversation-member-copy">
                      <span className="user-label">{data.dmPrimaryParticipant.label}</span>
                      <span className="muted conversation-settings-note">
                        {data.otherParticipantMessageCount} · {data.otherParticipantShare}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <p className="muted conversation-settings-note">
              {data.leadingParticipantLabel
                ? data.t.chat.messageLeadSummary(data.leadingParticipantLabel, data.shareDelta)
                : data.t.chat.messageLeadTie}
            </p>
          </section>
        )}

        <section className="conversation-settings-panel stack">
          <div className="stack conversation-settings-panel-copy">
            <h3 className="card-title">{data.t.chat.historySection}</h3>
            <p className="muted conversation-settings-note">
              {data.historyBaselineStartsAfterLatest
                ? data.t.chat.historyBaselineActiveNote
                : data.t.chat.historyBaselineNote}
            </p>
          </div>

          <div className="conversation-manage-actions">
            <GuardedServerActionForm action={resetConversationHistoryBaselineAction}>
              <input name="conversationId" type="hidden" value={conversationId} />
              <input name="returnTo" type="hidden" value="settings-screen" />
              <input name="spaceId" type="hidden" value={data.activeSpaceId ?? ''} />
              <PendingSubmitButton
                className="button button-compact button-secondary"
                disabled={!data.canResetVisibleHistoryBaseline}
                type="submit"
              >
                {data.t.chat.historyBaselineAction}
              </PendingSubmitButton>
            </GuardedServerActionForm>
          </div>
        </section>

        <section className="conversation-settings-panel stack">
          <div className="stack conversation-settings-panel-copy">
            <h3 className="card-title">{data.t.chat.notifications}</h3>
            <p className="muted conversation-settings-note">
              {data.t.chat.notificationsNote}
            </p>
          </div>

          <GuardedServerActionForm
            action={updateConversationNotificationLevelAction}
            className="conversation-notification-form"
          >
            <input name="conversationId" type="hidden" value={conversationId} />
            <input name="returnTo" type="hidden" value="settings-screen" />
            <input name="spaceId" type="hidden" value={data.activeSpaceId ?? ''} />

            <PendingSubmitButton
              className={
                data.conversation.notificationLevel === 'default'
                  ? 'conversation-choice-button conversation-choice-button-active'
                  : 'conversation-choice-button'
              }
              name="notificationLevel"
              type="submit"
              value="default"
            >
              <span className="conversation-choice-copy">
                <span className="conversation-choice-title">{data.t.chat.notificationsDefault}</span>
                <span className="conversation-choice-note">
                  {data.t.chat.notificationsDefaultNote}
                </span>
              </span>
            </PendingSubmitButton>

            <PendingSubmitButton
              className={
                data.conversation.notificationLevel === 'muted'
                  ? 'conversation-choice-button conversation-choice-button-active'
                  : 'conversation-choice-button'
              }
              name="notificationLevel"
              type="submit"
              value="muted"
            >
              <span className="conversation-choice-copy">
                <span className="conversation-choice-title">{data.t.chat.notificationsMuted}</span>
                <span className="conversation-choice-note">
                  {data.t.chat.notificationsMutedNote}
                </span>
              </span>
            </PendingSubmitButton>
          </GuardedServerActionForm>
        </section>

        {data.canDeleteDirectConversation ? (
          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">{data.t.chat.deleteChat}</h3>
              <p className="muted conversation-settings-note">
                {data.t.chat.deleteChatCurrentUserOnlyNote}
              </p>
            </div>

            <div className="conversation-manage-actions">
              <DmChatDeleteConfirmForm
                cancelLabel={data.t.chat.cancel}
                confirmBody={data.t.chat.deleteChatConfirmBody}
                confirmButtonLabel={data.t.chat.deleteChatConfirmButton}
                confirmHint={data.t.chat.deleteChatConfirmHint}
                confirmPlaceholder={data.t.chat.deleteChatConfirmPlaceholder}
                confirmTitle={data.t.chat.deleteChatConfirmTitle}
                conversationId={conversationId}
                deleteButtonLabel={data.t.chat.deleteChatButton}
                returnTo="settings-screen"
                spaceId={data.activeSpaceId}
              />
            </div>
          </section>
        ) : data.conversation.kind === 'group' ? (
          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h3 className="card-title">{data.t.chat.inbox}</h3>
              <p className="muted conversation-settings-note">
                {data.t.chat.inboxNote}
              </p>
            </div>

            <div className="conversation-manage-actions">
              <GuardedServerActionForm action={hideConversationAction}>
                <input name="conversationId" type="hidden" value={conversationId} />
                <input name="spaceId" type="hidden" value={data.activeSpaceId ?? ''} />
                <PendingSubmitButton
                  className="button button-compact button-secondary"
                  type="submit"
                >
                  {data.t.chat.hideFromInbox}
                </PendingSubmitButton>
              </GuardedServerActionForm>
                </div>
              </section>
        ) : null}
      </section>
    </section>
  );
}
