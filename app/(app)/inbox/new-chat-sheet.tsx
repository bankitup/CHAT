'use client';

import { useMemo, useState } from 'react';
import {
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import { IdentityAvatar } from '@/modules/messaging/ui/identity';
import { IdentityStatusInline } from '@/modules/messaging/ui/identity-status';
import { GuardedServerActionForm } from '../guarded-server-action-form';
import { PendingSubmitButton } from '../pending-submit-button';
import { createDmAction, createGroupAction } from './actions';

type NewChatSheetUser = {
  userId: string;
  label: string;
  displayName: string | null;
  avatarPath?: string | null;
  statusEmoji?: string | null;
  statusText?: string | null;
};

type NewChatSheetProps = {
  availableDmUsers: NewChatSheetUser[];
  availableGroupUsers: NewChatSheetUser[];
  hasAnyDmUsers: boolean;
  hasAnyUsers: boolean;
  onClose: () => void;
  language: AppLanguage;
  spaceId: string;
};

type NewChatMode = 'dm' | 'group';

export function NewChatSheet({
  availableDmUsers,
  availableGroupUsers,
  hasAnyDmUsers,
  hasAnyUsers,
  onClose,
  language,
  spaceId,
}: NewChatSheetProps) {
  const t = getTranslations(language);
  const [mode, setMode] = useState<NewChatMode>('dm');
  const [selectedDmUserId, setSelectedDmUserId] = useState<string | null>(null);
  const [selectedGroupUserIds, setSelectedGroupUserIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');

  const selectedDmUser = useMemo(
    () =>
      availableDmUsers.find((availableUser) => availableUser.userId === selectedDmUserId) ??
      null,
    [availableDmUsers, selectedDmUserId],
  );
  const isGroupReady =
    selectedGroupUserIds.length > 0 && groupTitle.trim().length > 0;

  function handleModeChange(nextMode: NewChatMode) {
    setMode(nextMode);
  }

  function toggleGroupUser(userId: string) {
    setSelectedGroupUserIds((current) =>
      current.includes(userId)
        ? current.filter((currentUserId) => currentUserId !== userId)
        : [...current, userId],
    );
  }

  return (
    <section
      aria-modal="true"
      className="card stack inbox-create-sheet"
      role="dialog"
    >
      <div className="inbox-create-header">
        <div className="stack inbox-create-copy">
          <h2 className="section-title">{t.inbox.create.title}</h2>
          <p className="muted">{t.inbox.create.subtitle}</p>
        </div>
        <button
          aria-label={t.inbox.create.closeAria}
          className="pill inbox-create-close"
          onClick={onClose}
          type="button"
        >
          {t.inbox.create.close}
        </button>
      </div>

      <div
        className="inbox-create-mode-switch"
        role="tablist"
        aria-label={t.inbox.create.modeAria}
      >
        <button
          aria-selected={mode === 'dm'}
          className={
            mode === 'dm'
              ? 'inbox-create-mode-button inbox-create-mode-button-active'
              : 'inbox-create-mode-button'
          }
          onClick={() => handleModeChange('dm')}
          role="tab"
          type="button"
        >
          {t.inbox.create.direct}
        </button>
        <button
          aria-selected={mode === 'group'}
          className={
            mode === 'group'
              ? 'inbox-create-mode-button inbox-create-mode-button-active'
              : 'inbox-create-mode-button'
          }
          onClick={() => handleModeChange('group')}
          role="tab"
          type="button"
        >
          {t.inbox.create.group}
        </button>
      </div>

      {mode === 'dm' ? (
        <section className="stack inbox-create-section">
          <div className="stack inbox-create-copy">
            <h3 className="card-title">{t.inbox.create.peopleTitle}</h3>
            <p className="muted">{t.inbox.create.peopleSubtitle}</p>
          </div>

          {!hasAnyUsers ? (
            <p className="muted inbox-compose-empty">
              {t.inbox.create.noUsers}
            </p>
          ) : !hasAnyDmUsers ? (
            <p className="muted inbox-compose-empty">
              {t.inbox.create.existingDmOnly}
            </p>
          ) : availableDmUsers.length === 0 ? (
            <p className="muted inbox-compose-empty">
              {t.inbox.create.noMatches}
            </p>
          ) : (
            <div className="inbox-compose-user-list inbox-create-user-list">
              {availableDmUsers.map((availableUser) => {
                const isSelected = availableUser.userId === selectedDmUserId;

                return (
                  <button
                    key={availableUser.userId}
                    aria-pressed={isSelected}
                    className={
                      isSelected
                        ? 'inbox-create-person-option inbox-create-person-option-selected'
                        : 'inbox-create-person-option'
                    }
                    onClick={() => setSelectedDmUserId(availableUser.userId)}
                    type="button"
                  >
                    <div className="user-row">
                      <IdentityAvatar
                        diagnosticsSurface="inbox:new-chat-dm"
                        identity={availableUser}
                        label={availableUser.label}
                        size="sm"
                      />
                      <div className="stack user-copy">
                        <span className="user-label">{availableUser.label}</span>
                        <IdentityStatusInline
                          className="user-status-inline"
                          identity={availableUser}
                        />
                      </div>
                    </div>
                    <span className="inbox-create-option-state">
                      {isSelected ? t.inbox.create.selected : t.inbox.create.choose}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedDmUser ? (
            <GuardedServerActionForm
              action={createDmAction}
              className="stack inbox-create-action-block"
            >
              <input name="spaceId" type="hidden" value={spaceId} />
              <input
                name="participantUserId"
                type="hidden"
                value={selectedDmUser.userId}
              />
              <p className="muted inbox-create-selection-note">
                {t.inbox.create.messageSelection(selectedDmUser.label)}
              </p>
              <PendingSubmitButton
                className="button"
                pendingLabel={t.inbox.create.createDm}
                type="submit"
              >
                {t.inbox.create.createDm}
              </PendingSubmitButton>
            </GuardedServerActionForm>
          ) : null}
        </section>
      ) : (
        <section className="stack inbox-create-section">
          <div className="stack inbox-create-copy">
            <h3 className="card-title">{t.inbox.create.groupTitle}</h3>
            <p className="muted">{t.inbox.create.groupSubtitle}</p>
          </div>

          <GuardedServerActionForm
            action={createGroupAction}
            className="stack compact-form"
          >
            <input name="spaceId" type="hidden" value={spaceId} />
            <label className="field">
              <span className="sr-only">{t.inbox.create.groupTitle}</span>
              <input
                className="input"
                name="title"
                onChange={(event) => setGroupTitle(event.target.value)}
                placeholder={t.inbox.create.groupNamePlaceholder}
                required
                value={groupTitle}
              />
            </label>

            {!hasAnyUsers ? (
              <p className="muted inbox-compose-empty">
                {t.inbox.create.noUsers}
              </p>
            ) : availableGroupUsers.length === 0 ? (
              <p className="muted inbox-compose-empty">
                {t.inbox.create.noMatches}
              </p>
            ) : (
              <div className="inbox-compose-user-list inbox-create-user-list">
                {availableGroupUsers.map((availableUser) => {
                  const isSelected = selectedGroupUserIds.includes(
                    availableUser.userId,
                  );

                  return (
                    <button
                      key={`group-${availableUser.userId}`}
                      aria-pressed={isSelected}
                      className={
                        isSelected
                          ? 'inbox-create-person-option inbox-create-person-option-selected'
                          : 'inbox-create-person-option'
                      }
                      onClick={() => toggleGroupUser(availableUser.userId)}
                      type="button"
                    >
                      <div className="user-row">
                        <IdentityAvatar
                          diagnosticsSurface="inbox:new-chat-group"
                          identity={availableUser}
                          label={availableUser.label}
                          size="sm"
                        />
                        <div className="stack user-copy">
                          <span className="user-label">{availableUser.label}</span>
                          <IdentityStatusInline
                            className="user-status-inline"
                            identity={availableUser}
                          />
                        </div>
                      </div>
                      <span className="inbox-create-option-state">
                        {isSelected ? t.inbox.create.selected : t.inbox.create.add}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedGroupUserIds.map((participantUserId) => (
              <input
                key={participantUserId}
                name="participantUserIds"
                type="hidden"
                value={participantUserId}
              />
            ))}

            <div className="stack inbox-create-action-block">
              <p className="muted inbox-create-selection-note">
                {selectedGroupUserIds.length > 0
                  ? t.inbox.create.groupSelectionCount(selectedGroupUserIds.length)
                  : t.inbox.create.groupSelectionEmpty}
              </p>
              <PendingSubmitButton
                className="button"
                disabled={!isGroupReady}
                pendingLabel={t.inbox.create.createGroup}
                type="submit"
              >
                {t.inbox.create.createGroup}
              </PendingSubmitButton>
            </div>
          </GuardedServerActionForm>
        </section>
      )}
    </section>
  );
}
