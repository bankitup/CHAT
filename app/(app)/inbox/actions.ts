'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createConversationWithMembers,
  findExistingActiveDmConversation,
  restoreConversationForUser,
} from '@/modules/messaging/data/server';
import { withSpaceParam } from '@/modules/spaces/url';

function redirectWithError(message: string, spaceId?: string | null): never {
  const params = new URLSearchParams({ error: message });
  const href = withSpaceParam(`/inbox?${params.toString()}`, spaceId);
  redirect(href);
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
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to create a conversation.');
  }

  if (!user.id) {
    throw new Error('Authenticated user is missing an ID.');
  }

  return user.id;
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
      redirect(withSpaceParam(`/chat/${existingConversationId}`, spaceId));
    }

    const conversationId = await createConversationWithMembers({
      kind: 'dm',
      creatorUserId,
      participantUserIds: [participantUserId],
      spaceId: spaceId || null,
    });

    redirect(withSpaceParam(`/chat/${conversationId}`, spaceId));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithError(
      error instanceof Error ? error.message : 'Unable to create DM.',
      readText(formData, 'spaceId'),
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
      error instanceof Error ? error.message : 'Unable to create group.',
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
      error:
        error instanceof Error ? error.message : 'Unable to restore this chat.',
    });
    redirect(withSpaceParam(`/inbox?${params.toString()}`, readText(formData, 'spaceId')));
  }
}
