'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createConversationWithMembers,
  findExistingActiveDmConversation,
  restoreConversationForUser,
} from '@/modules/messaging/data/server';

function redirectWithError(message: string): never {
  const params = new URLSearchParams({ error: message });
  redirect(`/inbox?${params.toString()}`);
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

    if (!participantUserId) {
      redirectWithError('Participant user ID is required.');
    }

    if (participantUserId === creatorUserId) {
      redirectWithError('Use another user ID for a DM.');
    }

    const existingConversationId = await findExistingActiveDmConversation(
      creatorUserId,
      participantUserId,
    );

    if (existingConversationId) {
      redirect(`/chat/${existingConversationId}`);
    }

    const conversationId = await createConversationWithMembers({
      kind: 'dm',
      creatorUserId,
      participantUserIds: [participantUserId],
    });

    redirect(`/chat/${conversationId}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithError(
      error instanceof Error ? error.message : 'Unable to create DM.',
    );
  }
}

export async function createGroupAction(formData: FormData) {
  try {
    const creatorUserId = await getAuthenticatedUserId();
    const title = readText(formData, 'title');
    const participantUserIds = readSelectedIds(formData, 'participantUserIds');

    if (!title) {
      redirectWithError('Group title is required.');
    }

    if (participantUserIds.length === 0) {
      redirectWithError('At least one participant user ID is required.');
    }

    const conversationId = await createConversationWithMembers({
      kind: 'group',
      creatorUserId,
      title,
      participantUserIds,
    });

    redirect(`/chat/${conversationId}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithError(
      error instanceof Error ? error.message : 'Unable to create group.',
    );
  }
}

export async function restoreConversationAction(formData: FormData) {
  try {
    const userId = await getAuthenticatedUserId();
    const conversationId = readText(formData, 'conversationId');

    if (!conversationId) {
      redirectWithError('Choose a chat to restore.');
    }

    await restoreConversationForUser({
      conversationId,
      userId,
    });

    redirect('/inbox?view=archived');
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const params = new URLSearchParams({
      view: 'archived',
      error:
        error instanceof Error ? error.message : 'Unable to restore this chat.',
    });
    redirect(`/inbox?${params.toString()}`);
  }
}
