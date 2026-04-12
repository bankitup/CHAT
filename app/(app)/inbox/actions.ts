'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  createConversationWithMembers,
  findExistingActiveDmConversation,
  isExistingDmConversationConflictError,
  restoreConversationForUser,
  isUniqueConstraintErrorMessage,
} from '@/modules/messaging/data/conversation-lifecycle-server';
import {
  getConversationAutoRestoreHealthForUser,
} from '@/modules/messaging/data/thread-read-server';
import {
  normalizeInboxListDensity,
  normalizeInboxPreviewDisplayMode,
  normalizeInboxSectionPreferences,
} from '@/modules/messaging/inbox/preferences';
import { setInboxSectionPreferencesCookie } from '@/modules/messaging/inbox/preferences-server';
import {
  logControlledUiError,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import { withSpaceParam } from '@/modules/spaces/url';

const INBOX_ERROR_FALLBACK = 'Unable to load your chats right now. Please try again.';

function redirectWithError(message: string, spaceId?: string | null): never {
  const safeMessage = sanitizeUserFacingErrorMessage({
    fallback: INBOX_ERROR_FALLBACK,
    language: 'en',
    rawMessage: message,
  });
  const params = new URLSearchParams({ error: safeMessage });
  const href = withSpaceParam(`/inbox?${params.toString()}`, spaceId);
  redirect(href);
}

function getFriendlyInboxActionErrorMessage(
  error: unknown,
  fallback: string,
  surface: string,
) {
  const rawMessage = error instanceof Error ? error.message : fallback;

  logControlledUiError({
    fallback,
    rawMessage,
    surface,
  });

  return sanitizeUserFacingErrorMessage({
    fallback,
    language: 'en',
    rawMessage,
  });
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function readSelectedIds(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

async function getAuthenticatedUserId() {
  const user = await getRequestViewer();

  if (!user) {
    throw new Error('You must be logged in to create a conversation.');
  }

  if (!user.id) {
    throw new Error('Authenticated user is missing an ID.');
  }

  return user.id;
}

async function redirectToExistingDmConversation(input: {
  conversationId: string;
  creatorUserId: string;
  spaceId: string;
}) {
  try {
    await restoreConversationForUser({
      conversationId: input.conversationId,
      userId: input.creatorUserId,
    });
  } catch {
    // Opening the existing DM is still the safest fallback, even if hidden-state
    // restoration is unavailable in the current schema/runtime.
  }

  redirect(withSpaceParam(`/chat/${input.conversationId}`, input.spaceId));
}

async function resolveExistingDmAutoRestoreOrThrow(input: {
  conversationId: string;
  creatorUserId: string;
  spaceId: string;
}) {
  const autoRestoreHealth = await getConversationAutoRestoreHealthForUser({
    conversationId: input.conversationId,
    userId: input.creatorUserId,
  });

  if (autoRestoreHealth.status === 'blocked') {
    throw new Error(
      'This direct chat needs explicit recovery before it can be reopened automatically. Use the current chat cleanup/delete flow to retire it and then create a clean replacement.',
    );
  }

  await redirectToExistingDmConversation(input);
}

function redirectToInboxSettings(
  spaceId?: string | null,
  options?: {
    error?: string | null;
    saved?: boolean;
  },
): never {
  const params = new URLSearchParams();

  if (options?.error?.trim()) {
    params.set('error', options.error.trim());
  }

  if (options?.saved) {
    params.set('saved', '1');
  }

  const baseHref = params.toString()
    ? `/inbox/settings?${params.toString()}`
    : '/inbox/settings';

  redirect(withSpaceParam(baseHref, spaceId));
}

export async function createDmAction(formData: FormData) {
  try {
    const creatorUserId = await getAuthenticatedUserId();
    const participantUserId = readText(formData, 'participantUserId');
    const spaceId = readText(formData, 'spaceId');

    if (!participantUserId) {
      redirectWithError('Participant user ID is required.', spaceId);
    }

    if (participantUserId === creatorUserId) {
      redirectWithError('Use another user ID for a DM.', spaceId);
    }

    const existingConversationId = await findExistingActiveDmConversation(
      creatorUserId,
      participantUserId,
      {
        spaceId: spaceId || null,
      },
    );

    if (existingConversationId) {
      await resolveExistingDmAutoRestoreOrThrow({
        conversationId: existingConversationId,
        creatorUserId,
        spaceId,
      });
    }

    const conversationId = await createConversationWithMembers({
      kind: 'dm',
      creatorUserId,
      participantUserIds: [participantUserId],
      spaceId: spaceId || null,
    }, {
      existingDmBehavior: 'throw-conflict',
    });

    redirect(withSpaceParam(`/chat/${conversationId}`, spaceId));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const spaceId = readText(formData, 'spaceId');
    const participantUserId = readText(formData, 'participantUserId');

    if (isExistingDmConversationConflictError(error)) {
      const creatorUserId = await getAuthenticatedUserId();
      await resolveExistingDmAutoRestoreOrThrow({
        conversationId: error.conversationId,
        creatorUserId,
        spaceId,
      });
    }

    if (
      error instanceof Error &&
      participantUserId &&
      isUniqueConstraintErrorMessage(error.message, 'conversations_dm_key_unique')
    ) {
      try {
        const creatorUserId = await getAuthenticatedUserId();
        const existingConversationId = await findExistingActiveDmConversation(
          creatorUserId,
          participantUserId,
          {
            spaceId: spaceId || null,
          },
        );

        if (existingConversationId) {
          await resolveExistingDmAutoRestoreOrThrow({
            conversationId: existingConversationId,
            creatorUserId,
            spaceId,
          });
        }
      } catch {
        // Fall through to the friendly generic error below.
      }
    }

    redirectWithError(
      error instanceof Error &&
        isUniqueConstraintErrorMessage(error.message, 'conversations_dm_key_unique')
        ? 'This direct chat already exists. Please try again.'
        : getFriendlyInboxActionErrorMessage(
            error,
            'Unable to open that chat right now.',
            'inbox:create-dm',
          ),
      spaceId,
    );
  }
}

export async function createGroupAction(formData: FormData) {
  try {
    const creatorUserId = await getAuthenticatedUserId();
    const title = readText(formData, 'title');
    const participantUserIds = readSelectedIds(formData, 'participantUserIds');
    const spaceId = readText(formData, 'spaceId');

    if (!title) {
      redirectWithError('Group title is required.', spaceId);
    }

    if (participantUserIds.length === 0) {
      redirectWithError('At least one participant user ID is required.', spaceId);
    }

    const conversationId = await createConversationWithMembers({
      kind: 'group',
      creatorUserId,
      title,
      participantUserIds,
      spaceId: spaceId || null,
    });

    redirect(withSpaceParam(`/chat/${conversationId}`, spaceId));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithError(
      getFriendlyInboxActionErrorMessage(
        error,
        'Unable to create that group right now.',
        'inbox:create-group',
      ),
      readText(formData, 'spaceId'),
    );
  }
}

export async function restoreConversationAction(formData: FormData) {
  try {
    const userId = await getAuthenticatedUserId();
    const conversationId = readText(formData, 'conversationId');
    const spaceId = readText(formData, 'spaceId');

    if (!conversationId) {
      redirectWithError('Choose a chat to restore.', spaceId);
    }

    await restoreConversationForUser({
      conversationId,
      userId,
    });

    redirect(withSpaceParam('/inbox?view=archived', spaceId));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const params = new URLSearchParams({
      view: 'archived',
      error: getFriendlyInboxActionErrorMessage(
        error,
        'Unable to restore this chat right now.',
        'inbox:restore-conversation',
      ),
    });
    redirect(withSpaceParam(`/inbox?${params.toString()}`, readText(formData, 'spaceId')));
  }
}

export async function saveInboxPreferencesAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const spaceId = readText(formData, 'spaceId');

  try {
    await getAuthenticatedUserId();

    const visibleFilters = formData
      .getAll('visibleFilters')
      .map((value) => String(value).trim());
    const defaultFilter = readText(formData, 'defaultFilter');
    const density = normalizeInboxListDensity(readText(formData, 'density'));
    const previewMode = normalizeInboxPreviewDisplayMode(
      readText(formData, 'previewMode'),
    );

    const preferences = normalizeInboxSectionPreferences({
      defaultFilter,
      density,
      previewMode,
      showGroupsSeparately: readText(formData, 'showGroupsSeparately') === '1',
      showPersonalChatsFirst: readText(formData, 'showPersonalChatsFirst') === '1',
      visibleFilters,
    });

    await setInboxSectionPreferencesCookie(preferences);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToInboxSettings(
      spaceId,
      {
        error: getFriendlyInboxActionErrorMessage(
          error,
          t.inboxSettings.saveFailed,
          'inbox:save-settings',
        ),
      },
    );
  }

  revalidatePath('/inbox');
  revalidatePath('/inbox/settings');
  redirectToInboxSettings(spaceId, { saved: true });
}
