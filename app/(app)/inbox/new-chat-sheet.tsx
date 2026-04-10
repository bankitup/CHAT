'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
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
  initialMode: NewChatMode;
  onClose: () => void;
  onModeChange?: (mode: NewChatMode) => void;
  language: AppLanguage;
  manageMembersHref?: string | null;
  spaceId: string;
};

export type NewChatMode = 'dm' | 'group';

function filterNewChatUsers(
  users: NewChatSheetUser[],
  normalizedPeopleSearch: string,
) {
  if (!normalizedPeopleSearch) {
    return users;
  }

  return users.filter((user) => {
    const haystack = [user.label, user.displayName, user.statusText]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedPeopleSearch);
  });
}

export function NewChatSheet({
  availableDmUsers,
  availableGroupUsers,
  hasAnyDmUsers,
  hasAnyUsers,
  initialMode,
  onClose,
  onModeChange,
  language,
  manageMembersHref,
  spaceId,
}: NewChatSheetProps) {
  const t = getTranslations(language);
  const [mode, setMode] = useState<NewChatMode>(initialMode);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [selectedDmUserId, setSelectedDmUserId] = useState<string | null>(null);
  const [selectedGroupUserIds, setSelectedGroupUserIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const deferredPeopleSearch = useDeferredValue(peopleSearch);
  const normalizedPeopleSearch = deferredPeopleSearch.trim().toLowerCase();
  const isDmMode = mode === 'dm';
  const activeUsers = isDmMode ? availableDmUsers : availableGroupUsers;
  const filteredUsers = useMemo(
    () => filterNewChatUsers(activeUsers, normalizedPeopleSearch),
    [activeUsers, normalizedPeopleSearch],
  );
  const filteredDmUsers = isDmMode ? filteredUsers : availableDmUsers;
  const filteredGroupUsers = isDmMode ? availableGroupUsers : filteredUsers;
  const visibleUserCount = filteredUsers.length;

  const selectedDmUser = useMemo(
    () =>
      availableDmUsers.find((availableUser) => availableUser.userId === selectedDmUserId) ??
      null,
    [availableDmUsers, selectedDmUserId],
  );
  const isGroupReady =
    selectedGroupUserIds.length > 0 && groupTitle.trim().length > 0;

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  function handleModeChange(nextMode: NewChatMode) {
    setMode(nextMode);
    onModeChange?.(nextMode);
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
      <div aria-hidden="true" className="inbox-create-sheet-handle" />

      <div className="inbox-create-hero">
        <div className="inbox-create-header">
          <div className="stack inbox-create-copy">
            <h2 className="section-title">{t.inbox.create.title}</h2>
            <p className="muted">{t.inbox.create.subtitle}</p>
          </div>
          <button
            aria-label={t.inbox.create.closeAria}
            className="inbox-create-close"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true" className="inbox-create-close-glyph">
              ×
            </span>
            <span className="sr-only">{t.inbox.create.close}</span>
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

        <label className="field inbox-create-search-shell">
          <span className="sr-only">{t.inbox.create.searchAria}</span>
          <input
            className="input inbox-create-search-input"
            enterKeyHint="search"
            onChange={(event) => setPeopleSearch(event.target.value)}
            placeholder={t.inbox.create.searchPlaceholder}
            type="search"
            value={peopleSearch}
          />
        </label>
      </div>

      {mode === 'dm' ? (
        <section className="stack inbox-create-panel inbox-create-section">
          <div className="inbox-create-section-head">
            <div className="stack inbox-create-copy">
              <h3 className="card-title">{t.inbox.create.peopleTitle}</h3>
              <p className="muted">{t.inbox.create.peopleSubtitle}</p>
            </div>
            {hasAnyDmUsers ? (
              <span className="summary-pill summary-pill-muted inbox-create-count-pill">
                {visibleUserCount}
              </span>
            ) : null}
          </div>

          {!hasAnyUsers ? (
            <div className="stack inbox-compose-empty-state">
              <p className="muted inbox-compose-empty">
                {manageMembersHref
                  ? t.inbox.create.noUsersAdmin
                  : t.inbox.create.noUsers}
              </p>
              {manageMembersHref ? (
                <Link className="button button-secondary" href={manageMembersHref}>
                  {t.spaces.manageMembersAction}
                </Link>
              ) : null}
            </div>
          ) : !hasAnyDmUsers ? (
            <p className="muted inbox-compose-empty">
              {t.inbox.create.existingDmOnly}
            </p>
          ) : filteredDmUsers.length === 0 ? (
            <p className="muted inbox-compose-empty">
              {t.inbox.create.noMatches}
            </p>
          ) : (
            <div className="inbox-compose-user-list inbox-create-user-list">
              {filteredDmUsers.map((availableUser) => {
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
                    <div className="inbox-create-option-main">
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
                    </div>
                    <div className="inbox-create-option-meta">
                      <span
                        aria-hidden="true"
                        className={
                          isSelected
                            ? 'inbox-create-option-indicator inbox-create-option-indicator-selected'
                            : 'inbox-create-option-indicator'
                        }
                      />
                      {isSelected ? (
                        <span className="inbox-create-option-state">
                          {t.inbox.create.selected}
                        </span>
                      ) : null}
                    </div>
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
                className="button inbox-create-submit"
                pendingLabel={t.inbox.create.createDm}
                type="submit"
              >
                {t.inbox.create.createDm}
              </PendingSubmitButton>
            </GuardedServerActionForm>
          ) : null}
        </section>
      ) : (
        <section className="stack inbox-create-panel inbox-create-section">
          <div className="inbox-create-section-head">
            <div className="stack inbox-create-copy">
              <h3 className="card-title">{t.inbox.create.groupTitle}</h3>
              <p className="muted">{t.inbox.create.groupSubtitle}</p>
            </div>
            {hasAnyUsers ? (
              <span className="summary-pill summary-pill-muted inbox-create-count-pill">
                {visibleUserCount}
              </span>
            ) : null}
          </div>

          <GuardedServerActionForm
            action={createGroupAction}
            className="stack compact-form inbox-create-form-stack"
          >
            <input name="spaceId" type="hidden" value={spaceId} />
            <label className="field inbox-create-field-shell">
              <span className="sr-only">{t.inbox.create.groupTitle}</span>
              <input
                className="input inbox-create-title-input"
                name="title"
                onChange={(event) => setGroupTitle(event.target.value)}
                placeholder={t.inbox.create.groupNamePlaceholder}
                required
                value={groupTitle}
              />
            </label>

            {!hasAnyUsers ? (
              <div className="stack inbox-compose-empty-state">
                <p className="muted inbox-compose-empty">
                  {manageMembersHref
                    ? t.inbox.create.noUsersAdmin
                    : t.inbox.create.noUsers}
                </p>
                {manageMembersHref ? (
                  <Link className="button button-secondary" href={manageMembersHref}>
                    {t.spaces.manageMembersAction}
                  </Link>
                ) : null}
              </div>
          ) : filteredGroupUsers.length === 0 ? (
            <p className="muted inbox-compose-empty">
              {t.inbox.create.noMatches}
            </p>
          ) : (
              <div className="inbox-compose-user-list inbox-create-user-list">
                {filteredGroupUsers.map((availableUser) => {
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
                      <div className="inbox-create-option-main">
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
                      </div>
                      <div className="inbox-create-option-meta">
                        <span
                          aria-hidden="true"
                          className={
                            isSelected
                              ? 'inbox-create-option-indicator inbox-create-option-indicator-selected'
                              : 'inbox-create-option-indicator'
                          }
                        />
                        {isSelected ? (
                          <span className="inbox-create-option-state">
                            {t.inbox.create.selected}
                          </span>
                        ) : null}
                      </div>
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
                className="button inbox-create-submit"
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
