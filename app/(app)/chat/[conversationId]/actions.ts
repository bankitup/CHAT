'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  assertConversationExists,
  assertConversationMembership,
  assertMessageInConversation,
  STARTER_REACTIONS,
  sendTextMessage,
  toggleMessageReaction,
} from '@/modules/messaging/data/server';

function redirectWithError(conversationId: string, message: string): never {
  const params = new URLSearchParams({ error: message });
  redirect(`/chat/${conversationId}?${params.toString()}`);
}

export async function sendMessageAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!conversationId) {
    redirect('/inbox');
  }

  if (!body) {
    redirectWithError(conversationId, 'Message cannot be empty.');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithError(
      conversationId,
      'Message sending debug: no authenticated user found.',
    );
  }

  if (!user.id) {
    redirectWithError(
      conversationId,
      'Message sending debug: authenticated user is missing an ID.',
    );
  }

  const userId = user.id;

  const conversationExists = await assertConversationExists(conversationId);

  if (!conversationExists) {
    redirectWithError(
      conversationId,
      'Message sending debug: conversation does not exist or is not readable.',
    );
  }

  const isMember = await assertConversationMembership(conversationId, userId);

  if (!isMember) {
    redirectWithError(
      conversationId,
      'Message sending debug: authenticated user is not an active member of this conversation.',
    );
  }

  try {
    await sendTextMessage({
      conversationId,
      body,
      senderId: userId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to send message.';

    redirectWithError(conversationId, message);
  }

  revalidatePath('/inbox');
  revalidatePath(`/chat/${conversationId}`);
  redirect(`/chat/${conversationId}`);
}

export async function toggleReactionAction(formData: FormData) {
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const messageId = String(formData.get('messageId') ?? '').trim();
  const emoji = String(formData.get('emoji') ?? '').trim();

  if (!conversationId) {
    redirect('/inbox');
  }

  if (!messageId || !emoji || !STARTER_REACTIONS.includes(emoji as (typeof STARTER_REACTIONS)[number])) {
    redirectWithError(conversationId, 'Invalid reaction.');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    redirect('/inbox');
  }

  const messageExists = await assertMessageInConversation(messageId, conversationId);

  if (!messageExists) {
    redirect('/inbox');
  }

  try {
    await toggleMessageReaction({
      messageId,
      userId: user.id,
      emoji,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update reaction.';

    redirectWithError(conversationId, message);
  }

  revalidatePath(`/chat/${conversationId}`);
  redirect(`/chat/${conversationId}`);
}
