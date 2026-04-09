'use client';

import { useState } from 'react';
import { PendingSubmitButton } from '../pending-submit-button';
import { IdentityAvatar } from '@/modules/messaging/ui/identity';
import type { SpaceParticipantRecord } from '@/modules/spaces/server';

type SpaceParticipantsModuleCopy = {
  body: string;
  cancelRemoveAction: string;
  confirmRemoveAction: string;
  currentUserBadge: string;
  emptyBody: string;
  lockedHint: string;
  removeAction: string;
  removeConfirmBody: string;
  removePending: string;
  requestAction: string;
  requestBody: string;
  requestPending: string;
  summaryValue: string;
  title: string;
};

type SpaceParticipantsModuleProps = {
  copy: SpaceParticipantsModuleCopy;
  defaultOpen?: boolean;
  participants: SpaceParticipantRecord[];
  removeAction: (formData: FormData) => Promise<void>;
  requestAction: (formData: FormData) => Promise<void>;
  roleLabels: Record<'admin' | 'member' | 'owner', string>;
  spaceId: string;
};

function getParticipantSecondaryLabel(participant: SpaceParticipantRecord) {
  const parts: string[] = [];
  const username = participant.username?.trim();
  const email = participant.email?.trim();
  const emailLocalPart = participant.emailLocalPart?.trim();
  const status = [participant.statusEmoji?.trim(), participant.statusText?.trim()]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (email) {
    parts.push(email);
  } else if (username) {
    parts.push(`@${username}`);
  } else if (emailLocalPart) {
    parts.push(emailLocalPart);
  }

  if (status) {
    parts.push(status);
  }

  return parts.join(' • ');
}

export function SpaceParticipantsModule({
  copy,
  defaultOpen = false,
  participants,
  removeAction,
  requestAction,
  roleLabels,
  spaceId,
}: SpaceParticipantsModuleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const selectedKey = selectedUserIds.join(',');

  const removableParticipants = participants.filter(
    (participant) => participant.role !== 'owner' && !participant.isCurrentUser,
  );

  return (
    <section className="card stack settings-surface messenger-home-participants-card">
      <details
        className="inbox-settings-accordion"
        onToggle={(event) => setIsOpen(event.currentTarget.open)}
        open={isOpen}
      >
        <summary className="inbox-settings-accordion-summary">
          <span className="stack inbox-settings-accordion-copy">
            <span className="section-title">{copy.title}</span>
            <span className="inbox-settings-accordion-value">{copy.summaryValue}</span>
          </span>
          <span aria-hidden="true" className="inbox-settings-accordion-chevron">
            ‹
          </span>
        </summary>

        <div className="stack inbox-settings-accordion-panel messenger-home-participants-panel">
          <div className="stack settings-section-copy">
            <p className="muted">{copy.body}</p>
            <p className="muted messenger-home-participants-note">{copy.lockedHint}</p>
          </div>

          {participants.length === 0 ? (
            <p className="muted">{copy.emptyBody}</p>
          ) : (
            <div className="checkbox-list messenger-home-participants-list">
              {participants.map((participant) => {
                const label =
                  participant.displayName?.trim() ||
                  participant.username?.trim() ||
                  participant.emailLocalPart?.trim() ||
                  participant.email?.split('@')[0]?.trim() ||
                  participant.userId;
                const secondaryLabel = getParticipantSecondaryLabel(participant);
                const canBeRemoved =
                  participant.role !== 'owner' && !participant.isCurrentUser;

                return (
                  <label
                    className={`checkbox-row messenger-home-participant-row${
                      canBeRemoved ? '' : ' messenger-home-participant-row-disabled'
                    }`}
                    key={participant.userId}
                  >
                    <input
                      checked={selectedUserIds.includes(participant.userId)}
                      disabled={!canBeRemoved}
                      name={`participant-${participant.userId}`}
                      onChange={(event) => {
                        setIsConfirmingRemoval(false);

                        if (event.target.checked) {
                          setSelectedUserIds((current) =>
                            current.includes(participant.userId)
                              ? current
                              : [...current, participant.userId],
                          );
                          return;
                        }

                        setSelectedUserIds((current) =>
                          current.filter((userId) => userId !== participant.userId),
                        );
                      }}
                      type="checkbox"
                    />
                    <IdentityAvatar
                      diagnosticsSurface="home:space-participants"
                      identity={{
                        avatarPath: participant.avatarPath ?? null,
                        displayName: label,
                        userId: participant.userId,
                      }}
                      label={label}
                      size="sm"
                    />
                    <span className="checkbox-copy messenger-home-participant-copy">
                      <span className="messenger-home-participant-primary">
                        <span className="checkbox-identity">{label}</span>
                        {participant.isCurrentUser ? (
                          <span className="summary-pill summary-pill-muted">
                            {copy.currentUserBadge}
                          </span>
                        ) : null}
                      </span>
                      {secondaryLabel ? (
                        <span className="muted messenger-home-participant-secondary">
                          {secondaryLabel}
                        </span>
                      ) : null}
                    </span>
                    <span className="summary-pill summary-pill-muted messenger-home-participant-role">
                      {roleLabels[participant.role]}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <form action={removeAction} className="stack messenger-home-participant-form">
            <input name="spaceId" type="hidden" value={spaceId} />
            <input name="selectedUserIds" type="hidden" value={selectedKey} />

            {isConfirmingRemoval ? (
              <div className="stack messenger-home-participant-confirmation">
                <p className="notice notice-inline">{copy.removeConfirmBody}</p>
                <div className="messenger-home-participant-actions">
                  <PendingSubmitButton
                    className="button"
                    pendingLabel={copy.removePending}
                    type="submit"
                  >
                    {copy.confirmRemoveAction}
                  </PendingSubmitButton>
                  <button
                    className="button button-secondary"
                    onClick={() => setIsConfirmingRemoval(false)}
                    type="button"
                  >
                    {copy.cancelRemoveAction}
                  </button>
                </div>
              </div>
            ) : (
              <div className="messenger-home-participant-actions">
                <button
                  className="button"
                  disabled={removableParticipants.length === 0 || selectedUserIds.length === 0}
                  onClick={() => setIsConfirmingRemoval(true)}
                  type="button"
                >
                  {copy.removeAction}
                </button>
              </div>
            )}
          </form>

          <form action={requestAction} className="stack messenger-home-account-request-form">
            <input name="spaceId" type="hidden" value={spaceId} />
            <p className="muted">{copy.requestBody}</p>
            <PendingSubmitButton
              className="button button-secondary"
              pendingLabel={copy.requestPending}
              type="submit"
            >
              {copy.requestAction}
            </PendingSubmitButton>
          </form>
        </div>
      </details>
    </section>
  );
}
