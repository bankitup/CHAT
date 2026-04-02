import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

type ConversationRecord = {
  id: string;
  kind: string | null;
  title?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
};

type ConversationMemberRow = {
  conversation_id: string;
  conversations: ConversationRecord | ConversationRecord[] | null;
};

type ConversationMembershipLookupRow = {
  conversation_id: string;
  conversations: { id: string; kind: string | null } | { id: string; kind: string | null }[] | null;
};

export type InboxConversation = {
  conversationId: string;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  kind?: string | null;
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  reply_to_message_id: string | null;
  seq: number | string;
  kind: string;
  client_id: string;
  body: string | null;
  created_at: string | null;
};

export type MessageSenderProfile = {
  userId: string;
  displayName: string | null;
};

export type AvailableUser = {
  userId: string;
  label: string;
};

export type ConversationReadState = {
  lastReadMessageSeq: number | null;
};

export type ConversationParticipant = {
  userId: string;
};

type MessageReactionRow = {
  id: string;
  message_id: string;
  emoji: string;
  user_id: string;
  created_at: string | null;
};

export type MessageReactionGroup = {
  emoji: string;
  count: number;
  selectedByCurrentUser: boolean;
};

export const STARTER_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🎉'] as const;

function normalizeConversation(
  value: ConversationRecord | ConversationRecord[] | null,
) {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getInboxConversations(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations(id, kind, title, last_message_at, created_at)')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ConversationMemberRow[];

  return rows
    .map((row) => {
      const conversation = normalizeConversation(row.conversations);

      return {
        conversationId: row.conversation_id,
        kind: conversation?.kind ?? null,
        title: conversation?.title ?? null,
        lastMessageAt: conversation?.last_message_at ?? null,
        createdAt: conversation?.created_at ?? null,
      };
    })
    .sort((left, right) => {
      const leftValue = left.lastMessageAt ?? left.createdAt ?? '';
      const rightValue = right.lastMessageAt ?? right.createdAt ?? '';

      return rightValue.localeCompare(leftValue);
    });
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations(id, kind, title, last_message_at, created_at)')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as ConversationMemberRow;
  const conversation = normalizeConversation(row.conversations);

  if (!conversation) {
    return null;
  }

  return {
    conversationId: row.conversation_id,
    kind: conversation.kind,
    title: conversation.title,
    lastMessageAt: conversation.last_message_at,
    createdAt: conversation.created_at,
  };
}

export async function getConversationReadState(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('last_read_message_seq')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes('last_read_message_seq') ||
      error.message.includes('column')
    ) {
      return { lastReadMessageSeq: null } satisfies ConversationReadState;
    }

    throw new Error(error.message);
  }

  return {
    lastReadMessageSeq:
      typeof data?.last_read_message_seq === 'number'
        ? data.last_read_message_seq
        : null,
  } satisfies ConversationReadState;
}

export async function getConversationParticipants(conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('state', 'active');

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as { user_id: string }[]).map((member) => ({
    userId: member.user_id,
  })) satisfies ConversationParticipant[];
}

function dedupeParticipantIds(ids: string[]) {
  return Array.from(new Set(ids.map((value) => value.trim()).filter(Boolean)));
}

export async function getAvailableUsers(currentUserId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .neq('user_id', currentUserId)
    .order('user_id', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as { user_id: string }[]).map((profile) => ({
    userId: profile.user_id,
    label: profile.user_id,
  }));
}

export async function findExistingActiveDmConversation(
  creatorUserId: string,
  otherUserId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data: creatorMemberships, error: creatorError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', creatorUserId)
    .eq('state', 'active');

  if (creatorError) {
    throw new Error(creatorError.message);
  }

  const conversationIds = (creatorMemberships ?? []).map(
    (row) => row.conversation_id as string,
  );

  if (conversationIds.length === 0) {
    return null;
  }

  const { data: otherMemberships, error: otherError } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations!inner(id, kind)')
    .eq('user_id', otherUserId)
    .eq('state', 'active')
    .in('conversation_id', conversationIds)
    .eq('conversations.kind', 'dm');

  if (otherError) {
    throw new Error(otherError.message);
  }

  const match = ((otherMemberships ?? []) as ConversationMembershipLookupRow[]).find(
    (row) => normalizeConversation(row.conversations)?.kind === 'dm',
  );

  return match?.conversation_id ?? null;
}

export async function createConversationWithMembers(input: {
  kind: 'dm' | 'group';
  creatorUserId: string;
  participantUserIds: string[];
  title?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const conversationId = crypto.randomUUID();

  if (!input.creatorUserId) {
    throw new Error('Authenticated user is required to create a conversation.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      'Conversation creation debug: no authenticated user found in the server action client.',
    );
  }

  if (!user.id) {
    throw new Error(
      'Conversation creation debug: authenticated user is present but user.id is missing.',
    );
  }

  const participantUserIds = dedupeParticipantIds(input.participantUserIds).filter(
    (userId) => userId !== input.creatorUserId,
  );

  if (participantUserIds.length === 0) {
    throw new Error('At least one participant is required.');
  }

  const conversationPayload =
    input.kind === 'group'
      ? {
          id: conversationId,
          created_by: input.creatorUserId,
          kind: 'group',
          title: input.title?.trim() || null,
        }
      : {
          id: conversationId,
          created_by: input.creatorUserId,
          kind: 'dm',
          title: null,
        };

  if (conversationPayload.created_by !== input.creatorUserId) {
    throw new Error(
      'Conversation created_by must match the authenticated user.',
    );
  }

  if (conversationPayload.created_by !== user.id) {
    throw new Error(
      `Conversation creation debug: created_by mismatch. auth user id=${user.id}, payload created_by=${conversationPayload.created_by}.`,
    );
  }

  const { error: conversationError } = await supabase
    .from('conversations')
    .insert(conversationPayload);

  if (conversationError) {
    if (conversationError.message.includes('row-level security policy')) {
      throw new Error(
        `Conversation creation debug: insert blocked by conversations RLS. auth user id=${user.id}, payload created_by=${conversationPayload.created_by}. Values match, so the failure is likely in database policy state or auth context rather than payload construction.`,
      );
    }

    throw new Error(conversationError.message);
  }

  const membershipRows = [
    {
      conversation_id: conversationId,
      user_id: input.creatorUserId,
      role: 'owner',
      state: 'active',
    },
    ...participantUserIds.map((userId) => ({
      conversation_id: conversationId,
      user_id: userId,
      role: 'member',
      state: 'active',
    })),
  ];

  const { error: membershipError } = await supabase
    .from('conversation_members')
    .insert(membershipRows);

  if (membershipError) {
    await supabase.from('conversations').delete().eq('id', conversationId);
    throw new Error(membershipError.message);
  }

  return conversationId;
}

export async function getConversationMessages(conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('messages')
    .select(
      'id, conversation_id, sender_id, reply_to_message_id, seq, kind, client_id, body, created_at',
    )
    .eq('conversation_id', conversationId)
    .order('seq', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ConversationMessage[];
}

export async function getMessageSenderProfiles(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return [] as MessageSenderProfile[];
  }

  const supabase = await createSupabaseServerClient();
  const withDisplayNames = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', uniqueUserIds);

  if (!withDisplayNames.error) {
    return ((withDisplayNames.data ?? []) as {
      user_id: string;
      display_name: string | null;
    }[]).map((profile) => ({
      userId: profile.user_id,
      displayName: profile.display_name?.trim() || null,
    }));
  }

  const fallback = await supabase
    .from('profiles')
    .select('user_id')
    .in('user_id', uniqueUserIds);

  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  return ((fallback.data ?? []) as { user_id: string }[]).map((profile) => ({
    userId: profile.user_id,
    displayName: null,
  }));
}

export async function getGroupedReactionsForMessages(
  messageIds: string[],
  currentUserId: string,
) {
  if (messageIds.length === 0) {
    return new Map<string, MessageReactionGroup[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('message_reactions')
    .select('id, message_id, emoji, user_id, created_at')
    .in('message_id', messageIds);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MessageReactionRow[];
  const grouped = new Map<string, Map<string, MessageReactionGroup>>();

  for (const row of rows) {
    const perMessage = grouped.get(row.message_id) ?? new Map<string, MessageReactionGroup>();
    const current = perMessage.get(row.emoji) ?? {
      emoji: row.emoji,
      count: 0,
      selectedByCurrentUser: false,
    };

    current.count += 1;
    current.selectedByCurrentUser ||= row.user_id === currentUserId;

    perMessage.set(row.emoji, current);
    grouped.set(row.message_id, perMessage);
  }

  return new Map(
    Array.from(grouped.entries()).map(([messageId, reactions]) => {
      const groups = Array.from(reactions.values())
        .sort((left, right) => {
          if (left.selectedByCurrentUser !== right.selectedByCurrentUser) {
            return left.selectedByCurrentUser ? -1 : 1;
          }

          if (left.count !== right.count) {
            return right.count - left.count;
          }

          return left.emoji.localeCompare(right.emoji);
        })
        .slice(0, 5);

      return [messageId, groups];
    }),
  );
}

export async function assertConversationMembership(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function assertConversationExists(conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function assertMessageInConversation(
  messageId: string,
  conversationId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

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

    return;
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
}

export async function sendTextMessage(input: {
  conversationId: string;
  body: string;
  senderId: string;
  replyToMessageId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const timestamp = new Date().toISOString();
  const clientId = crypto.randomUUID();

  if (!input.senderId) {
    throw new Error(
      'Message sending debug: authenticated sender is required before insert.',
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      'Message sending debug: no authenticated user found in the server action client.',
    );
  }

  if (!user.id) {
    throw new Error(
      'Message sending debug: authenticated user is present but user.id is missing.',
    );
  }

  if (input.senderId !== user.id) {
    throw new Error(
      `Message sending debug: sender_id mismatch. auth user id=${user.id}, payload sender_id=${input.senderId}.`,
    );
  }

  const { error: insertError } = await supabase.from('messages').insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    reply_to_message_id: input.replyToMessageId ?? null,
    kind: 'text',
    client_id: clientId,
    body: input.body,
  });

  if (insertError) {
    if (insertError.message.includes('row-level security policy')) {
      throw new Error(
        `Message sending debug: insert blocked by messages RLS. auth user id=${user.id}, payload sender_id=${input.senderId}, conversation_id=${input.conversationId}. Values match, so the failure is likely database-side RLS state or membership policy rather than payload construction.`,
      );
    }

    throw new Error(insertError.message);
  }

  const { error: updateError } = await supabase
    .from('conversations')
    .update({ last_message_at: timestamp })
    .eq('id', input.conversationId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
