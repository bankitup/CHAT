import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const STARTER_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🎉'] as const;

export async function toggleMessageReaction(input: {
  messageId: string;
  userId: string;
  emoji: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: existingRows, error: existingError } = await supabase
    .from('message_reactions')
    .select('id, emoji')
    .eq('message_id', input.messageId)
    .eq('user_id', input.userId);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const userRows = existingRows ?? [];
  const sameEmojiRows = userRows.filter((row) => row.emoji === input.emoji);

  if (sameEmojiRows.length > 0) {
    const ids = sameEmojiRows.map((row) => row.id);
    const { error: deleteError } = await supabase
      .from('message_reactions')
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return {
      selected: false,
    } as const;
  }

  if (userRows.length >= 3) {
    throw new Error('You can add up to 3 reactions to a single message.');
  }

  const { error: insertError } = await supabase.from('message_reactions').insert({
    message_id: input.messageId,
    user_id: input.userId,
    emoji: input.emoji,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    selected: true,
  } as const;
}
