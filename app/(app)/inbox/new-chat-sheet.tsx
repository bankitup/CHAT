'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import { IdentityAvatar } from '@/modules/messaging/ui/identity';
import { createDmAction, createGroupAction } from './actions';

type NewChatSheetUser = {
  userId: string;
  label: string;
  displayName: string | null;
  avatarPath?: string | null;
};

type NewChatSheetProps = {
  availableUsers: NewChatSheetUser[];
  hasAnyUsers: boolean;
  closeHref: string;
  language: AppLanguage;
  spaceId: string;
};

type NewChatMode = 'dm' | 'group';

export function NewChatSheet({
  availableUsers,
  hasAnyUsers,
  closeHref,
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
      availableUsers.find((availableUser) => availableUser.userId === selectedDmUserId) ??
      null,
    [availableUsers, selectedDmUserId],
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
    <section className="card stack inbox-create-sheet">
      <div className="inbox-create-header">
        <div className="stack inbox-create-copy">
          <h2 className="section-title">{t.inbox.create.title}</h2>
          <p className="muted">{t.inbox.create.subtitle}</p>
        </div>
        <Link
          aria-label={t.inbox.create.closeAria}
          className="pill inbox-create-close"
          href={closeHref}
        >
          {t.inbox.create.close}
        </Link>
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
          ) : availableUsers.length === 0 ? (
            <p className="muted inbox-compose-empty">
              {t.inbox.create.noMatches}
            </p>
          ) : (
            <div className="inbox-compose-user-list inbox-create-user-list">
              {availableUsers.map((availableUser) => {
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
                        identity={availableUser}
                        label={availableUser.label}
                        size="sm"
                      />
                      <div className="stack user-copy">
                        <span className="user-label">{availableUser.label}</span>
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
            <form action={createDmAction} className="stack inbox-create-action-block">
              <input name="spaceId" type="hidden" value={spaceId} />
              <input
                name="participantUserId"
                type="hidden"
                value={selectedDmUser.userId}
              />
              <p className="muted inbox-create-selection-note">
                {t.inbox.create.messageSelection(selectedDmUser.label)}
              </p>
              <button className="button" type="submit">
                {t.inbox.create.createDm}
              </button>
            </form>
          ) : null}
        </section>
      ) : (
        <section className="stack inbox-create-section">
          <div className="stack inbox-create-copy">
            <h3 className="card-title">{t.inbox.create.groupTitle}</h3>
            <p className="muted">{t.inbox.create.groupSubtitle}</p>
          </div>

          <form action={createGroupAction} className="stack compact-form">
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
            ) : availableUsers.length === 0 ? (
              <p className="muted inbox-compose-empty">
                {t.inbox.create.noMatches}
              </p>
            ) : (
              <div className="inbox-compose-user-list inbox-create-user-list">
                {availableUsers.map((availableUser) => {
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
                          identity={availableUser}
                          label={availableUser.label}
                          size="sm"
                        />
                        <div className="stack user-copy">
                          <span className="user-label">{availableUser.label}</span>
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
              <button className="button" disabled={!isGroupReady} type="submit">
                {t.inbox.create.createGroup}
              </button>
            </div>
          </form>
        </section>
      )}
    </section>
  );
}
