'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getInboxClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client';
import { resolvePublicIdentityLabel } from '@/modules/profile/ui/identity-label';
import type { NewChatMode } from './new-chat-sheet';

const NewChatSheet = dynamic(
  () => import('./new-chat-sheet').then((mod) => mod.NewChatSheet),
  {
    loading: () => (
      <section className="inbox-create-overlay" aria-label="Create chat">
        <button
          aria-label="Close create chat"
          className="inbox-create-backdrop"
          type="button"
        />
        <section
          aria-modal="true"
          className="card stack inbox-create-sheet"
          role="dialog"
        >
          <div aria-hidden="true" className="inbox-create-sheet-handle" />
          <div className="stack inbox-create-loading-state" aria-live="polite">
            <span aria-hidden="true" className="message-status-spinner" />
          </div>
        </section>
      </section>
    ),
  },
);

type AvailableUserEntry = {
  avatarPath?: string | null;
  displayName: string | null;
  label: string;
  statusEmoji?: string | null;
  statusText?: string | null;
  userId: string;
};

type CreateChatTargetUserPayload = {
  avatarPath?: string | null;
  displayName: string | null;
  emailLocalPart?: string | null;
  statusEmoji?: string | null;
  statusText?: string | null;
  userId: string;
  username?: string | null;
};

type CreateChatTargetsResponse = {
  existingDmPartnerUserIds: string[];
  users: CreateChatTargetUserPayload[];
};

type CreateChatTargetsState = {
  availableDmUserEntries: AvailableUserEntry[];
  availableUserEntries: AvailableUserEntry[];
  errorMessage: string | null;
  status: 'idle' | 'seeded' | 'loading' | 'ready' | 'error';
};

type InboxCreateSheetRuntimeProps = {
  activeSpaceId: string;
  createTargetsLoaded: boolean;
  initialAvailableDmUserEntries: AvailableUserEntry[];
  initialAvailableUserEntries: AvailableUserEntry[];
  isOpen: boolean;
  language: AppLanguage;
  manageMembersHref?: string | null;
  mode: NewChatMode;
  onClose: () => void;
  onModeChange: (mode: NewChatMode) => void;
  searchTerm: string;
};

function resolveCreateChatTargetsStatus(input: {
  availableUserEntries: AvailableUserEntry[];
  createTargetsLoaded: boolean;
}) {
  if (input.createTargetsLoaded) {
    return 'ready' as const;
  }

  return input.availableUserEntries.length > 0 ? 'seeded' as const : 'idle' as const;
}

function buildAvailableUserEntry(
  user: CreateChatTargetUserPayload,
  unknownUserLabel: string,
) {
  return {
    avatarPath: user.avatarPath ?? null,
    displayName: user.displayName ?? null,
    label: resolvePublicIdentityLabel(user, unknownUserLabel),
    statusEmoji: user.statusEmoji ?? null,
    statusText: user.statusText ?? null,
    userId: user.userId,
  } satisfies AvailableUserEntry;
}

export function InboxCreateSheetRuntime({
  activeSpaceId,
  createTargetsLoaded,
  initialAvailableDmUserEntries,
  initialAvailableUserEntries,
  isOpen,
  language,
  manageMembersHref,
  mode,
  onClose,
  onModeChange,
  searchTerm,
}: InboxCreateSheetRuntimeProps) {
  const t = getInboxClientTranslations(language);
  const [createChatTargetsState, setCreateChatTargetsState] =
    useState<CreateChatTargetsState>(() => ({
      availableDmUserEntries: initialAvailableDmUserEntries,
      availableUserEntries: initialAvailableUserEntries,
      errorMessage: null,
      status: resolveCreateChatTargetsStatus({
        availableUserEntries: initialAvailableUserEntries,
        createTargetsLoaded,
      }),
    }));
  const createTargetsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setCreateChatTargetsState({
      availableDmUserEntries: initialAvailableDmUserEntries,
      availableUserEntries: initialAvailableUserEntries,
      errorMessage: null,
      status: resolveCreateChatTargetsStatus({
        availableUserEntries: initialAvailableUserEntries,
        createTargetsLoaded,
      }),
    });
  }, [
    createTargetsLoaded,
    initialAvailableDmUserEntries,
    initialAvailableUserEntries,
  ]);

  const retryCreateTargetsLoad = useCallback(() => {
    setCreateChatTargetsState((currentState) =>
      currentState.status === 'loading'
        ? currentState
        : {
            ...currentState,
            errorMessage: null,
            status: resolveCreateChatTargetsStatus({
              availableUserEntries: currentState.availableUserEntries,
              createTargetsLoaded: false,
            }),
          },
    );
  }, []);

  const loadCreateChatTargets = useCallback(async () => {
    if (
      createChatTargetsState.status === 'loading' ||
      createChatTargetsState.status === 'ready'
    ) {
      return;
    }

    createTargetsAbortRef.current?.abort();
    const controller = new AbortController();
    createTargetsAbortRef.current = controller;

    setCreateChatTargetsState((currentState) => ({
      ...currentState,
      errorMessage: null,
      status: 'loading',
    }));

    try {
      const response = await fetch(
        `/api/messaging/inbox/create-targets?space=${encodeURIComponent(activeSpaceId)}`,
        {
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as (CreateChatTargetsResponse & {
        error?: string;
      }) | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.trim() || t.inbox.create.loadingCandidatesFailed,
        );
      }

      const availableUserEntriesNext = Array.isArray(payload?.users)
        ? payload.users.map((user) =>
            buildAvailableUserEntry(user, t.chat.unknownUser),
          )
        : [];
      const existingDmPartnerUserIds = Array.isArray(
        payload?.existingDmPartnerUserIds,
      )
        ? payload.existingDmPartnerUserIds
        : [];
      const existingDmPartnerUserIdsSet = new Set(existingDmPartnerUserIds);
      const availableDmUserEntriesNext = availableUserEntriesNext.filter(
        (availableUser) =>
          !existingDmPartnerUserIdsSet.has(availableUser.userId),
      );

      if (createTargetsAbortRef.current !== controller) {
        return;
      }

      setCreateChatTargetsState({
        availableDmUserEntries: availableDmUserEntriesNext,
        availableUserEntries: availableUserEntriesNext,
        errorMessage: null,
        status: 'ready',
      });
    } catch (error) {
      if (controller.signal.aborted || createTargetsAbortRef.current !== controller) {
        return;
      }

      setCreateChatTargetsState((currentState) => ({
        ...currentState,
        errorMessage:
          error instanceof Error && error.message.trim()
            ? error.message
            : t.inbox.create.loadingCandidatesFailed,
        status: 'error',
      }));
    } finally {
      if (createTargetsAbortRef.current === controller) {
        createTargetsAbortRef.current = null;
      }
    }
  }, [
    activeSpaceId,
    createChatTargetsState.status,
    t.chat.unknownUser,
    t.inbox.create.loadingCandidatesFailed,
  ]);

  useEffect(() => {
    if (!isOpen) {
      createTargetsAbortRef.current?.abort();
      createTargetsAbortRef.current = null;
      return;
    }

    if (
      createChatTargetsState.status !== 'idle' &&
      createChatTargetsState.status !== 'seeded'
    ) {
      return;
    }

    void loadCreateChatTargets();
  }, [createChatTargetsState.status, isOpen, loadCreateChatTargets]);

  useEffect(() => {
    return () => {
      createTargetsAbortRef.current?.abort();
      createTargetsAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || !isOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const availableDmUserEntriesFiltered = useMemo(
    () =>
      createChatTargetsState.availableDmUserEntries.filter((availableUser) => {
        if (!searchTerm) {
          return true;
        }

        return availableUser.label.toLowerCase().includes(searchTerm);
      }),
    [createChatTargetsState.availableDmUserEntries, searchTerm],
  );

  const availableUserEntriesFiltered = useMemo(
    () =>
      createChatTargetsState.availableUserEntries.filter((availableUser) => {
        if (!searchTerm) {
          return true;
        }

        return availableUser.label.toLowerCase().includes(searchTerm);
      }),
    [createChatTargetsState.availableUserEntries, searchTerm],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <section className="inbox-create-overlay" aria-label="Create chat">
      <button
        aria-label="Close create chat"
        className="inbox-create-backdrop"
        onClick={onClose}
        type="button"
      />

      <NewChatSheet
        availableDmUsers={availableDmUserEntriesFiltered}
        availableGroupUsers={availableUserEntriesFiltered}
        hasAnyDmUsers={createChatTargetsState.availableDmUserEntries.length > 0}
        hasAnyUsers={createChatTargetsState.availableUserEntries.length > 0}
        initialMode={mode}
        isCandidatesLoading={createChatTargetsState.status === 'loading'}
        language={language}
        loadCandidatesError={
          createChatTargetsState.status === 'error'
            ? createChatTargetsState.errorMessage
            : null
        }
        manageMembersHref={manageMembersHref}
        onClose={onClose}
        onModeChange={onModeChange}
        onRetryLoadCandidates={retryCreateTargetsLoad}
        spaceId={activeSpaceId}
      />
    </section>
  );
}
