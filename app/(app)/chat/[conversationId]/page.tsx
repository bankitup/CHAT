import {
  formatMemberCount,
  getLocaleForLanguage,
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_ATTACHMENT_MAX_SIZE_BYTES,
} from '@/modules/messaging/data/server';
import { ActiveChatRealtimeSync } from '@/modules/messaging/realtime/active-chat-sync';
import {
  WarmNavReadyProbe,
} from '@/modules/messaging/performance/warm-nav-client';
import { loadMessengerThreadPageData } from '@/modules/messaging/server/thread-page';
import { withSpaceParam } from '@/modules/spaces/url';
import {
  GroupIdentityAvatar,
  IdentityAvatar,
} from '@/modules/messaging/ui/identity';
import {
  IdentityStatusInline,
  hasIdentityStatus,
} from '@/modules/messaging/ui/identity-status';
import Link from 'next/link';
import {
  addGroupParticipantsAction,
  hideConversationAction,
  leaveGroupAction,
  removeGroupParticipantAction,
  updateConversationNotificationLevelAction,
} from './actions';
import { ConversationPresenceStatus } from './conversation-presence-status';
import { ChatHeaderAvatarPreviewTrigger } from './chat-header-avatar-preview-trigger';
import { ComposerKeyboardOffset } from './composer-keyboard-offset';
import {
  DmThreadClientSubtree,
  DmThreadPresenceScope,
} from './dm-thread-client-diagnostics';
import { DmChatDeleteConfirmForm } from './dm-chat-delete-confirm-form';
import { DmThreadHydrationProbe } from './dm-thread-hydration-probe';
import { ThreadComposerRuntime } from './thread-composer-runtime';
import { ThreadHistoryViewport } from './thread-history-viewport';
import { GroupChatSettingsForm } from './group-chat-settings-form';
import { ThreadLiveStateHydrator } from '@/modules/messaging/realtime/thread-live-state-store';
import { GuardedServerActionForm } from '../../guarded-server-action-form';
import { PendingSubmitButton } from '../../pending-submit-button';

type ChatPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    details?: string;
    replyToMessageId?: string;
    editMessageId?: string;
    deleteMessageId?: string;
    actionMessageId?: string;
    settings?: string;
    space?: string;
  }>;
};

function formatLongDate(value: string | null, language: AppLanguage, t: ReturnType<typeof getTranslations>) {
  const parsedDate = parseSafeDate(value);

  if (!parsedDate) {
    return t.chat.unknown;
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
}

function parseSafeDate(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsedDate = new Date(trimmed);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function buildChatHref(input: {
  conversationId: string;
  spaceId: string;
  actionMessageId?: string | null;
  deleteMessageId?: string | null;
  editMessageId?: string | null;
  error?: string | null;
  saved?: string | null;
  replyToMessageId?: string | null;
  details?: string | null;
  hash?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.actionMessageId?.trim()) {
    params.set('actionMessageId', input.actionMessageId.trim());
  }

  if (input.deleteMessageId?.trim()) {
    params.set('deleteMessageId', input.deleteMessageId.trim());
  }

  if (input.editMessageId?.trim()) {
    params.set('editMessageId', input.editMessageId.trim());
  }

  if (input.error?.trim()) {
    params.set('error', input.error.trim());
  }

  if (input.saved?.trim()) {
    params.set('saved', input.saved.trim());
  }

  if (input.replyToMessageId?.trim()) {
    params.set('replyToMessageId', input.replyToMessageId.trim());
  }

  if (input.details?.trim()) {
    params.set('details', input.details.trim());
  }

  const search = params.toString();
  const baseHref = search
    ? `/chat/${input.conversationId}?${search}`
    : `/chat/${input.conversationId}`;
  const href = withSpaceParam(baseHref, input.spaceId);

  return input.hash ? `${href}${input.hash}` : href;
}

export default async function ChatPage({
  params,
  searchParams,
}: ChatPageProps) {
  const { conversationId } = await params;
  const query = await searchParams;
  const {
    activeDeleteMessageId,
    activeEditMessageId,
    activeSpaceId,
    attachmentHelpText,
    attachmentMaxSizeLabel,
    availableParticipantsToAdd,
    canDeleteDirectConversation,
    canEditGroupIdentity,
    canManageGroupParticipants,
    conversation,
    currentUserDisplayLabel,
    currentUserId,
    directConversationDisplayTitle,
    directParticipantIdentity,
    directParticipantStatus,
    encryptedDmEnabled,
    firstMessage,
    groupJoinPolicy,
    groupMemberSummary,
    hasDirectParticipantStatusEmojiOnly,
    hasDirectParticipantStatusText,
    hasSettingsSavedState,
    initialReplyTarget,
    isSettingsOpen,
    language,
    lastMessage,
    latestVisibleMessageSeq,
    mentionParticipants,
    messageIds,
    messages,
    otherParticipantReadState,
    otherParticipants,
    otherParticipantUserId,
    participantItems,
    participants,
    reactionsByMessageEntries,
    readState,
    t,
    threadClientDiagnostics,
    threadHistoryLimit,
    threadHistorySnapshot,
    visibleRouteError,
    visibleSettingsError,
    warmNavRouteKey,
  } = await loadMessengerThreadPageData({
    conversationId,
    query,
  });

  return (
    <section className="stack chat-screen">
      {conversation.kind === 'dm' ? (
        <DmThreadHydrationProbe
          conversationId={conversationId}
          debugRequestId={threadClientDiagnostics.debugRequestId}
          firstMessageId={firstMessage?.id ?? null}
          historyWindowLimit={threadHistoryLimit}
          initialServerMessageCount={messages.length}
          kind="dm"
          lastMessageId={lastMessage?.id ?? null}
          renderedEmptyState={messages.length === 0}
        />
      ) : null}
      <WarmNavReadyProbe
        details={{
          isSettingsOpen,
          kind: conversation.kind,
          messageCount: messages.length,
          spaceId: activeSpaceId,
        }}
        routeKey={warmNavRouteKey}
        routePath={`/chat/${conversationId}`}
        surface="chat"
      />
      {conversation.kind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="active-chat-realtime-sync"
        >
          <ActiveChatRealtimeSync
            conversationId={conversationId}
            currentUserId={currentUserId}
            messageIds={messageIds}
          />
        </DmThreadClientSubtree>
      ) : (
        <ActiveChatRealtimeSync
          conversationId={conversationId}
          currentUserId={currentUserId}
          messageIds={messageIds}
        />
      )}
      <ThreadLiveStateHydrator
        conversationId={conversationId}
        currentUserReadSeq={readState.lastReadMessageSeq}
        otherParticipantReadSeq={otherParticipantReadState?.lastReadMessageSeq ?? null}
        reactionsByMessage={reactionsByMessageEntries}
      />
      {conversation.kind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="composer-keyboard-offset"
        >
          <ComposerKeyboardOffset />
        </DmThreadClientSubtree>
      ) : (
        <ComposerKeyboardOffset />
      )}

      <DmThreadPresenceScope
        conversationId={conversationId}
        currentUserId={currentUserId}
        debugRequestId={threadClientDiagnostics.debugRequestId}
        deploymentId={threadClientDiagnostics.deploymentId}
        gitCommitSha={threadClientDiagnostics.gitCommitSha}
        otherUserId={conversation.kind === 'dm' ? otherParticipantUserId : null}
        vercelUrl={threadClientDiagnostics.vercelUrl}
      >
      <section className="stack chat-header-stack" id="chat-header-shell">
        <section className="card chat-header-card chat-header-shell">
          <Link
            aria-label={t.chat.backToChats}
            className="back-arrow-link conversation-back chat-header-back"
            href={withSpaceParam('/inbox', activeSpaceId)}
          >
            <span aria-hidden="true">←</span>
          </Link>

          <Link
            aria-label={t.chat.openInfoAria(directConversationDisplayTitle)}
            className="chat-header-main-link"
            href={withSpaceParam(`/chat/${conversationId}/settings`, activeSpaceId)}
            prefetch={false}
          >
            <div className="stack chat-header-copy">
              {conversation.kind === 'group' ? (
                <>
                  <h1 className="conversation-screen-title">
                    {directConversationDisplayTitle}
                  </h1>
                  <p className="muted chat-member-summary">{groupMemberSummary}</p>
                </>
              ) : hasDirectParticipantStatusText ? (
                <>
                  <span className="sr-only">{directConversationDisplayTitle}</span>
                  <span className="chat-header-status-bubble">
                    <IdentityStatusInline
                      className="chat-header-status chat-header-status-bubble-copy"
                      identity={directParticipantIdentity}
                    />
                  </span>
                </>
              ) : (
                <>
                  <h1 className="conversation-screen-title chat-header-title-with-status">
                    <span className="chat-header-title-label">
                      {directConversationDisplayTitle}
                    </span>
                    {hasDirectParticipantStatusEmojiOnly ? (
                      <span
                        aria-hidden="true"
                        className="chat-header-title-emoji"
                      >
                        {directParticipantStatus.emoji}
                      </span>
                    ) : null}
                  </h1>
                  {otherParticipants[0] ? (
                    <div className="chat-header-meta">
                      <DmThreadClientSubtree
                        conversationId={conversationId}
                        {...threadClientDiagnostics}
                        fallback={null}
                        surface="conversation-presence-status"
                      >
                        <ConversationPresenceStatus language={language} />
                      </DmThreadClientSubtree>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Link>

          <div className="chat-header-avatar-slot">
            <ChatHeaderAvatarPreviewTrigger
              closeLabel={t.chat.closeAvatarPreview}
              conversationKind={conversation.kind === 'group' ? 'group' : 'dm'}
              groupAvatarPath={conversation.avatarPath}
              openLabel={t.chat.openAvatarPreviewAria(directConversationDisplayTitle)}
              participant={directParticipantIdentity}
              title={directConversationDisplayTitle}
            />
          </div>
        </section>
      </section>

      {visibleRouteError && !isSettingsOpen ? (
        <p className="notice notice-error">{visibleRouteError}</p>
      ) : null}

      <section className="chat-main">
        <section className="message-thread" id="message-thread-scroll">
          <ThreadHistoryViewport
            activeDeleteMessageId={activeDeleteMessageId}
            activeEditMessageId={activeEditMessageId}
            activeSpaceId={activeSpaceId}
            conversationId={conversationId}
            conversationKind={conversation.kind === 'group' ? 'group' : 'dm'}
            currentReadMessageSeq={readState.lastReadMessageSeq}
            currentUserId={currentUserId}
            initialSnapshot={threadHistorySnapshot}
            language={language}
            latestVisibleMessageSeq={latestVisibleMessageSeq}
            otherParticipantReadSeq={otherParticipantReadState?.lastReadMessageSeq ?? null}
            otherParticipantUserId={otherParticipantUserId}
            threadClientDiagnostics={threadClientDiagnostics}
          />
        </section>

        <ThreadComposerRuntime
          accept={CHAT_ATTACHMENT_ACCEPT}
          attachmentHelpText={attachmentHelpText}
          attachmentMaxSizeBytes={CHAT_ATTACHMENT_MAX_SIZE_BYTES}
          attachmentMaxSizeLabel={attachmentMaxSizeLabel}
          conversationId={conversationId}
          conversationKind={conversation.kind === 'group' ? 'group' : 'dm'}
          currentUserId={currentUserId}
          currentUserLabel={currentUserDisplayLabel}
          encryptedDmEnabled={encryptedDmEnabled}
          initialReplyTarget={initialReplyTarget}
          language={language}
          latestVisibleMessageSeq={latestVisibleMessageSeq}
          mentionParticipants={mentionParticipants}
          mentionSuggestionsLabel={t.chat.mentionSuggestions}
          messagePlaceholder={t.chat.messagePlaceholder}
          recipientUserId={otherParticipantUserId}
          threadClientDiagnostics={threadClientDiagnostics}
        />
      </section>
      </DmThreadPresenceScope>

      {isSettingsOpen ? (
        <section
          className="conversation-settings-overlay"
          id="conversation-settings"
        >
          <Link
            aria-label={t.chat.closeInfo}
            className="conversation-settings-backdrop"
            href={buildChatHref({
              conversationId,
              spaceId: activeSpaceId,
            })}
            prefetch={false}
          />

          <section className="card stack conversation-settings-card conversation-settings-sheet">
            <div className="conversation-settings-grabber" aria-hidden="true" />

            <div className="conversation-settings-header">
              <Link
                aria-label={t.chat.closeInfo}
                className="back-arrow-link conversation-settings-back-link"
                href={buildChatHref({
                  conversationId,
                  spaceId: activeSpaceId,
                })}
                prefetch={false}
              >
                <span aria-hidden="true">←</span>
              </Link>
            </div>

            {visibleSettingsError ? (
              <p className="notice notice-error">{visibleSettingsError}</p>
            ) : null}

            {hasSettingsSavedState ? (
              <div
                aria-live="polite"
                className="notice notice-success notice-inline conversation-settings-success"
              >
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
                    diagnosticsSurface="chat:info-summary"
                    identity={directParticipantIdentity}
                    label={directConversationDisplayTitle}
                    size="lg"
                  />
                )}

                <div className="stack conversation-info-copy">
                  <h3 className="conversation-info-title">{directConversationDisplayTitle}</h3>
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
                        diagnosticsSurface="chat:participant-item"
                        identity={participant.identity}
                        label={participant.label}
                        size="sm"
                      />
                      <div className="stack conversation-member-copy">
                        <div className="conversation-member-title-row">
                          <span className="user-label">
                            {participant.label}
                          </span>
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
                    participant.canRemove ? (
                      <GuardedServerActionForm action={removeGroupParticipantAction}>
                        <input
                          name="conversationId"
                          type="hidden"
                          value={conversationId}
                        />
                        <input
                          name="targetUserId"
                          type="hidden"
                          value={participant.userId}
                        />
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
                      conversationId={conversationId}
                      currentUserId={currentUserId}
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
                          <input
                            name="conversationId"
                            type="hidden"
                            value={conversationId}
                          />
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
                                      diagnosticsSurface="chat:add-participant"
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
                          <PendingSubmitButton
                            className="button button-compact"
                            type="submit"
                          >
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
                      <input
                        name="conversationId"
                        type="hidden"
                        value={conversationId}
                      />
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
            ) : null}

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
                <input
                  name="conversationId"
                  type="hidden"
                  value={conversationId}
                />

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
                    returnTo="settings-overlay"
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
                    <input
                      name="conversationId"
                      type="hidden"
                      value={conversationId}
                    />
                    <input
                      name="spaceId"
                      type="hidden"
                      value={activeSpaceId ?? ''}
                    />
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
      ) : null}

    </section>
  );
}
