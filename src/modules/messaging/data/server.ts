import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

type ConversationRecord = {
  id: string;
  kind: string | null;
  title?: string | null;
  created_by?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
};

type ConversationMemberRow = {
  conversation_id: string;
  last_read_message_seq?: number | null;
  last_read_at?: string | null;
  conversations: ConversationRecord | ConversationRecord[] | null;
};

type ConversationMembershipLookupRow = {
  conversation_id: string;
  conversations: { id: string; kind: string | null } | { id: string; kind: string | null }[] | null;
};

export type InboxConversation = {
  conversationId: string;
  title: string | null;
  createdBy?: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  kind?: string | null;
  lastReadMessageSeq: number | null;
  lastReadAt: string | null;
  latestMessageSeq: number | null;
  unreadCount: number;
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
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
};

type MessageAttachmentRow = {
  id: string;
  message_id: string;
  bucket: string;
  object_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
};

export type MessageAttachment = {
  id: string;
  messageId: string;
  bucket: string;
  objectPath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string | null;
  fileName: string;
  signedUrl: string | null;
  isImage: boolean;
};

export type MessageSenderProfile = {
  userId: string;
  displayName: string | null;
  avatarPath?: string | null;
};

export type AvailableUser = {
  userId: string;
  displayName: string | null;
  avatarPath?: string | null;
};

export type ConversationReadState = {
  lastReadMessageSeq: number | null;
  lastReadAt: string | null;
};

export type ConversationMemberReadState = {
  userId: string;
  lastReadMessageSeq: number | null;
  lastReadAt: string | null;
};

export type ConversationParticipant = {
  userId: string;
  role: string | null;
  state: string | null;
};

export type ConversationParticipantIdentity = {
  conversationId: string;
  userId: string;
  displayName: string | null;
  avatarPath?: string | null;
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
export const CHAT_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain';

const CHAT_ATTACHMENT_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_ATTACHMENTS_BUCKET ?? 'message-attachments';
const SUPPORTED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
]);

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
    .select(
      'conversation_id, last_read_message_seq, last_read_at, conversations(id, kind, title, created_by, last_message_at, created_at)',
    )
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ConversationMemberRow[];
  const conversationIds = rows.map((row) => row.conversation_id);
  const latestMessageSeqByConversation = new Map<string, number>();
  const unreadCountByConversation = new Map<string, number>();

  if (conversationIds.length > 0) {
    const { data: messageRows, error: messageError } = await supabase
      .from('messages')
      .select('conversation_id, seq')
      .in('conversation_id', conversationIds)
      .order('conversation_id', { ascending: true })
      .order('seq', { ascending: false });

    if (messageError) {
      throw new Error(messageError.message);
    }

    for (const row of (messageRows ?? []) as {
      conversation_id: string;
      seq: number | string;
    }[]) {
      const messageSeq =
        typeof row.seq === 'number' ? row.seq : Number(row.seq);

      if (!Number.isFinite(messageSeq)) {
        continue;
      }

      if (!latestMessageSeqByConversation.has(row.conversation_id)) {
        latestMessageSeqByConversation.set(row.conversation_id, messageSeq);
      }
    }

    for (const membershipRow of rows) {
      const lastReadSeq =
        typeof membershipRow.last_read_message_seq === 'number'
          ? membershipRow.last_read_message_seq
          : null;
      const latestSeq =
        latestMessageSeqByConversation.get(membershipRow.conversation_id) ?? null;

      if (latestSeq === null) {
        unreadCountByConversation.set(membershipRow.conversation_id, 0);
        continue;
      }

      if (lastReadSeq === null) {
        unreadCountByConversation.set(membershipRow.conversation_id, latestSeq);
        continue;
      }

      unreadCountByConversation.set(
        membershipRow.conversation_id,
        Math.max(0, latestSeq - lastReadSeq),
      );
    }
  }

  return rows
    .map((row) => {
      const conversation = normalizeConversation(row.conversations);
      const lastReadMessageSeq =
        typeof row.last_read_message_seq === 'number'
          ? row.last_read_message_seq
          : null;
      const latestMessageSeq =
        latestMessageSeqByConversation.get(row.conversation_id) ?? null;
      const unreadCount =
        unreadCountByConversation.get(row.conversation_id) ?? 0;

      return {
        conversationId: row.conversation_id,
        kind: conversation?.kind ?? null,
        title: conversation?.title ?? null,
        createdBy: conversation?.created_by ?? null,
        lastMessageAt: conversation?.last_message_at ?? null,
        createdAt: conversation?.created_at ?? null,
        lastReadMessageSeq,
        lastReadAt: row.last_read_at ?? null,
        latestMessageSeq,
        unreadCount,
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
    .select('conversation_id, conversations(id, kind, title, created_by, last_message_at, created_at)')
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
    createdBy: conversation.created_by ?? null,
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
    .select('last_read_message_seq, last_read_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes('last_read_message_seq') ||
      error.message.includes('last_read_at') ||
      error.message.includes('column')
    ) {
      return {
        lastReadMessageSeq: null,
        lastReadAt: null,
      } satisfies ConversationReadState;
    }

    throw new Error(error.message);
  }

  return {
    lastReadMessageSeq:
      typeof data?.last_read_message_seq === 'number'
        ? data.last_read_message_seq
        : null,
    lastReadAt:
      typeof data?.last_read_at === 'string' ? data.last_read_at : null,
  } satisfies ConversationReadState;
}

export async function getConversationMemberReadStates(conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id, last_read_message_seq, last_read_at')
    .eq('conversation_id', conversationId)
    .eq('state', 'active');

  if (error) {
    if (
      error.message.includes('last_read_message_seq') ||
      error.message.includes('last_read_at') ||
      error.message.includes('column')
    ) {
      const fallback = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('state', 'active');

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return ((fallback.data ?? []) as { user_id: string }[]).map((row) => ({
        userId: row.user_id,
        lastReadMessageSeq: null,
        lastReadAt: null,
      })) satisfies ConversationMemberReadState[];
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as {
    user_id: string;
    last_read_message_seq?: number | null;
    last_read_at?: string | null;
  }[]).map((row) => ({
    userId: row.user_id,
    lastReadMessageSeq:
      typeof row.last_read_message_seq === 'number'
        ? row.last_read_message_seq
        : null,
    lastReadAt: row.last_read_at ?? null,
  })) satisfies ConversationMemberReadState[];
}

export async function getConversationParticipants(conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id, role, state')
    .eq('conversation_id', conversationId)
    .eq('state', 'active');

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as {
    user_id: string;
    role?: string | null;
    state?: string | null;
  }[]).map((member) => ({
    userId: member.user_id,
    role: member.role ?? null,
    state: member.state ?? null,
  })) satisfies ConversationParticipant[];
}

async function getActiveGroupMembership(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id, role, state, conversations!inner(id, kind)')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .eq('conversations.kind', 'group')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | {
        user_id: string;
        role: string | null;
        state: string | null;
      }
    | null;
}

function dedupeParticipantIds(ids: string[]) {
  return Array.from(new Set(ids.map((value) => value.trim()).filter(Boolean)));
}

function sanitizeAttachmentFileName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'attachment';
  }

  return trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function getAttachmentFileName(objectPath: string) {
  const rawName = objectPath.split('/').pop()?.trim() || 'attachment';

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

function isImageAttachment(mimeType: string | null) {
  return Boolean(mimeType?.startsWith('image/'));
}

export async function getProfileIdentities(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return [] as MessageSenderProfile[];
  }

  const supabase = await createSupabaseServerClient();
  const withDisplayNamesAndAvatars = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_path')
    .in('user_id', uniqueUserIds);

  if (!withDisplayNamesAndAvatars.error) {
    return ((withDisplayNamesAndAvatars.data ?? []) as {
      user_id: string;
      display_name: string | null;
      avatar_path?: string | null;
    }[]).map((profile) => ({
      userId: profile.user_id,
      displayName: profile.display_name?.trim() || null,
      avatarPath: profile.avatar_path?.trim() || null,
    }));
  }

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
      avatarPath: null,
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
    avatarPath: null,
  }));
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

  const userIds = ((data ?? []) as { user_id: string }[]).map(
    (profile) => profile.user_id,
  );
  const identities = await getProfileIdentities(userIds);
  const identityByUserId = new Map(
    identities.map((identity) => [identity.userId, identity]),
  );

  return userIds.map((userId) => {
    const identity = identityByUserId.get(userId);

    return {
      userId,
      displayName: identity?.displayName ?? null,
      avatarPath: identity?.avatarPath ?? null,
    };
  }) satisfies AvailableUser[];
}

export async function getConversationParticipantIdentities(
  conversationIds: string[],
) {
  const uniqueConversationIds = Array.from(
    new Set(conversationIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueConversationIds.length === 0) {
    return [] as ConversationParticipantIdentity[];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, user_id')
    .in('conversation_id', uniqueConversationIds)
    .eq('state', 'active');

  if (error) {
    throw new Error(error.message);
  }

  const memberships = (data ?? []) as {
    conversation_id: string;
    user_id: string;
  }[];
  const identities = await getProfileIdentities(
    memberships.map((membership) => membership.user_id),
  );
  const identityByUserId = new Map(
    identities.map((identity) => [identity.userId, identity]),
  );

  return memberships.map((membership) => {
    const identity = identityByUserId.get(membership.user_id);

    return {
      conversationId: membership.conversation_id,
      userId: membership.user_id,
      displayName: identity?.displayName ?? null,
      avatarPath: identity?.avatarPath ?? null,
    };
  }) satisfies ConversationParticipantIdentity[];
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
      'id, conversation_id, sender_id, reply_to_message_id, seq, kind, client_id, body, edited_at, deleted_at, created_at',
    )
    .eq('conversation_id', conversationId)
    .order('seq', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ConversationMessage[];
}

export async function getMessageSenderProfiles(userIds: string[]) {
  return getProfileIdentities(userIds);
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

export async function getMessageAttachments(messageIds: string[]) {
  const uniqueMessageIds = Array.from(new Set(messageIds.filter(Boolean)));

  if (uniqueMessageIds.length === 0) {
    return new Map<string, MessageAttachment[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('message_attachments')
    .select('id, message_id, bucket, object_path, mime_type, size_bytes, created_at')
    .in('message_id', uniqueMessageIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MessageAttachmentRow[];
  const attachments = await Promise.all(
    rows.map(async (row) => {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(row.bucket)
        .createSignedUrl(row.object_path, 60 * 60);

      if (signedUrlError) {
        return {
          id: row.id,
          messageId: row.message_id,
          bucket: row.bucket,
          objectPath: row.object_path,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          createdAt: row.created_at,
          fileName: getAttachmentFileName(row.object_path),
          signedUrl: null,
          isImage: isImageAttachment(row.mime_type),
        } satisfies MessageAttachment;
      }

      return {
        id: row.id,
        messageId: row.message_id,
        bucket: row.bucket,
        objectPath: row.object_path,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        createdAt: row.created_at,
        fileName: getAttachmentFileName(row.object_path),
        signedUrl: signedUrlData.signedUrl,
        isImage: isImageAttachment(row.mime_type),
      } satisfies MessageAttachment;
    }),
  );

  const grouped = new Map<string, MessageAttachment[]>();

  for (const attachment of attachments) {
    const existing = grouped.get(attachment.messageId) ?? [];
    existing.push(attachment);
    grouped.set(attachment.messageId, existing);
  }

  return grouped;
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

export async function markConversationRead(input: {
  conversationId: string;
  userId: string;
  lastReadMessageSeq: number;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Read state debug: authenticated user is required.');
  }

  if (!Number.isFinite(input.lastReadMessageSeq) || input.lastReadMessageSeq < 0) {
    throw new Error('Read state debug: invalid last read message sequence.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Read state debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Read state debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('last_read_message_seq')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error(
      'Read state debug: authenticated user is not an active member of this conversation.',
    );
  }

  const currentReadSeq =
    typeof membershipRow.last_read_message_seq === 'number'
      ? membershipRow.last_read_message_seq
      : null;

  const { data: latestMessageRow, error: latestMessageError } = await supabase
    .from('messages')
    .select('seq')
    .eq('conversation_id', input.conversationId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestMessageError) {
    throw new Error(latestMessageError.message);
  }

  const latestMessageSeq =
    typeof latestMessageRow?.seq === 'number'
      ? latestMessageRow.seq
      : typeof latestMessageRow?.seq === 'string'
        ? Number(latestMessageRow.seq)
        : null;

  if (latestMessageSeq === null || !Number.isFinite(latestMessageSeq)) {
    return {
      updated: false,
      lastReadMessageSeq: currentReadSeq,
    };
  }

  const nextReadSeq = Math.min(input.lastReadMessageSeq, latestMessageSeq);

  if (currentReadSeq !== null && currentReadSeq >= nextReadSeq) {
    return {
      updated: false,
      lastReadMessageSeq: currentReadSeq,
    };
  }

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({
      last_read_message_seq: nextReadSeq,
      last_read_at: new Date().toISOString(),
    })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Read state debug: update blocked by conversation_members RLS.',
      );
    }

    throw new Error(updateError.message);
  }

  return {
    updated: true,
    lastReadMessageSeq: nextReadSeq,
  };
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

export async function assertMessageOwnedByUser(
  messageId: string,
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('sender_id', userId)
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
  await createMessageRecord({
    conversationId: input.conversationId,
    senderId: input.senderId,
    body: input.body,
    replyToMessageId: input.replyToMessageId ?? null,
  });
}

async function createMessageRecord(input: {
  conversationId: string;
  senderId: string;
  body?: string | null;
  replyToMessageId?: string | null;
  touchConversation?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const timestamp = new Date().toISOString();
  const clientId = crypto.randomUUID();
  const messageId = crypto.randomUUID();

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
    id: messageId,
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    reply_to_message_id: input.replyToMessageId ?? null,
    kind: 'text',
    client_id: clientId,
    body: input.body?.trim() || null,
  });

  if (insertError) {
    if (insertError.message.includes('row-level security policy')) {
      throw new Error(
        `Message sending debug: insert blocked by messages RLS. auth user id=${user.id}, payload sender_id=${input.senderId}, conversation_id=${input.conversationId}. Values match, so the failure is likely database-side RLS state or membership policy rather than payload construction.`,
      );
    }

    throw new Error(insertError.message);
  }

  if (input.touchConversation ?? true) {
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ last_message_at: timestamp })
      .eq('id', input.conversationId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return {
    messageId,
    timestamp,
    clientId,
  };
}

export async function editMessage(input: {
  messageId: string;
  conversationId: string;
  senderId: string;
  body: string;
}) {
  const supabase = await createSupabaseServerClient();
  const timestamp = new Date().toISOString();

  if (!input.senderId) {
    throw new Error('Authenticated sender is required to edit a message.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Message edit debug: no authenticated user found.');
  }

  if (user.id !== input.senderId) {
    throw new Error(
      `Message edit debug: sender mismatch. auth user id=${user.id}, payload sender_id=${input.senderId}.`,
    );
  }

  const { error } = await supabase
    .from('messages')
    .update({
      body: input.body.trim(),
      edited_at: timestamp,
    })
    .eq('id', input.messageId)
    .eq('conversation_id', input.conversationId)
    .eq('sender_id', input.senderId)
    .is('deleted_at', null);

  if (error) {
    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Message edit debug: update blocked by messages RLS.',
      );
    }

    throw new Error(error.message);
  }
}

export async function softDeleteMessage(input: {
  messageId: string;
  conversationId: string;
  senderId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const timestamp = new Date().toISOString();

  if (!input.senderId) {
    throw new Error('Authenticated sender is required to delete a message.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Message delete debug: no authenticated user found.');
  }

  if (user.id !== input.senderId) {
    throw new Error(
      `Message delete debug: sender mismatch. auth user id=${user.id}, payload sender_id=${input.senderId}.`,
    );
  }

  const { error } = await supabase
    .from('messages')
    .update({
      deleted_at: timestamp,
      edited_at: null,
    })
    .eq('id', input.messageId)
    .eq('conversation_id', input.conversationId)
    .eq('sender_id', input.senderId)
    .is('deleted_at', null);

  if (error) {
    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Message delete debug: update blocked by messages RLS.',
      );
    }

    throw new Error(error.message);
  }
}

export async function updateConversationTitle(input: {
  conversationId: string;
  userId: string;
  title: string;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to edit a group title.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Conversation settings debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation settings debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { error } = await supabase
    .from('conversations')
    .update({ title: input.title.trim() })
    .eq('id', input.conversationId)
    .eq('kind', 'group')
    .eq('created_by', input.userId);

  if (error) {
    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation settings debug: title update blocked by conversations RLS.',
      );
    }

    throw new Error(error.message);
  }
}

export async function addParticipantsToGroupConversation(input: {
  conversationId: string;
  ownerUserId: string;
  participantUserIds: string[];
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.ownerUserId) {
    throw new Error('Group management debug: authenticated owner is required.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Group management debug: no authenticated user found.');
  }

  if (user.id !== input.ownerUserId) {
    throw new Error(
      `Group management debug: owner mismatch. auth user id=${user.id}, payload owner id=${input.ownerUserId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.ownerUserId,
  );

  if (!actingMembership) {
    throw new Error(
      'Only an active group owner can add participants in this first version.',
    );
  }

  if (actingMembership.role !== 'owner') {
    throw new Error('Only the group owner can add participants.');
  }

  const participantUserIds = dedupeParticipantIds(input.participantUserIds).filter(
    (participantUserId) => participantUserId !== input.ownerUserId,
  );

  if (participantUserIds.length === 0) {
    throw new Error('Choose at least one participant to add.');
  }

  const { data: existingMemberships, error: membershipLookupError } = await supabase
    .from('conversation_members')
    .select('user_id, state')
    .eq('conversation_id', input.conversationId)
    .in('user_id', participantUserIds);

  if (membershipLookupError) {
    throw new Error(membershipLookupError.message);
  }

  const existingByUserId = new Map(
    ((existingMemberships ?? []) as {
      user_id: string;
      state: string | null;
    }[]).map((row) => [row.user_id, row]),
  );
  const usersToReactivate = participantUserIds.filter((participantUserId) => {
    const existing = existingByUserId.get(participantUserId);
    return existing && existing.state !== 'active';
  });
  const usersToInsert = participantUserIds.filter(
    (participantUserId) => !existingByUserId.has(participantUserId),
  );

  if (usersToReactivate.length > 0) {
    const { error: reactivateError } = await supabase
      .from('conversation_members')
      .update({
        state: 'active',
        role: 'member',
        last_read_message_seq: null,
        last_read_at: null,
      })
      .eq('conversation_id', input.conversationId)
      .in('user_id', usersToReactivate);

    if (reactivateError) {
      throw new Error(reactivateError.message);
    }
  }

  if (usersToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('conversation_members')
      .insert(
        usersToInsert.map((participantUserId) => ({
          conversation_id: input.conversationId,
          user_id: participantUserId,
          role: 'member',
          state: 'active',
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

export async function removeParticipantFromGroupConversation(input: {
  conversationId: string;
  ownerUserId: string;
  targetUserId: string;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.ownerUserId) {
    throw new Error('Group management debug: authenticated owner is required.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Group management debug: no authenticated user found.');
  }

  if (user.id !== input.ownerUserId) {
    throw new Error(
      `Group management debug: owner mismatch. auth user id=${user.id}, payload owner id=${input.ownerUserId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.ownerUserId,
  );

  if (!actingMembership || actingMembership.role !== 'owner') {
    throw new Error('Only the group owner can remove participants.');
  }

  if (!input.targetUserId) {
    throw new Error('Choose a participant to remove.');
  }

  if (input.targetUserId === input.ownerUserId) {
    throw new Error('Use leave group to remove yourself from the conversation.');
  }

  const targetMembership = await getActiveGroupMembership(
    input.conversationId,
    input.targetUserId,
  );

  if (!targetMembership) {
    throw new Error('That participant is no longer active in this group.');
  }

  if (targetMembership.role === 'owner') {
    throw new Error('The current group owner cannot be removed here.');
  }

  const { error: removeError } = await supabase
    .from('conversation_members')
    .update({ state: 'removed' })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.targetUserId)
    .eq('state', 'active');

  if (removeError) {
    throw new Error(removeError.message);
  }
}

export async function leaveGroupConversation(input: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Group leave debug: authenticated user is required.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Group leave debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Group leave debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.userId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (actingMembership.role === 'owner') {
    const { data: nextOwnerRows, error: nextOwnerError } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', input.conversationId)
      .eq('state', 'active')
      .neq('user_id', input.userId)
      .order('user_id', { ascending: true })
      .limit(1);

    if (nextOwnerError) {
      throw new Error(nextOwnerError.message);
    }

    const nextOwnerUserId = nextOwnerRows?.[0]?.user_id as string | undefined;

    if (nextOwnerUserId) {
      const { error: promoteError } = await supabase
        .from('conversation_members')
        .update({ role: 'owner' })
        .eq('conversation_id', input.conversationId)
        .eq('user_id', nextOwnerUserId)
        .eq('state', 'active');

      if (promoteError) {
        throw new Error(promoteError.message);
      }
    }
  }

  const { error: leaveError } = await supabase
    .from('conversation_members')
    .update({ state: 'left' })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (leaveError) {
    throw new Error(leaveError.message);
  }
}

export async function sendMessageWithAttachment(input: {
  conversationId: string;
  senderId: string;
  body?: string | null;
  replyToMessageId?: string | null;
  file: File;
}) {
  if (!input.file || input.file.size === 0) {
    throw new Error('Choose a file before sending.');
  }

  if (input.file.size > CHAT_ATTACHMENT_MAX_SIZE_BYTES) {
    throw new Error('Attachments can be up to 10 MB in this first version.');
  }

  if (!SUPPORTED_ATTACHMENT_TYPES.has(input.file.type)) {
    throw new Error(
      'Supported attachments are JPG, PNG, WEBP, GIF, PDF, and plain text files.',
    );
  }

  const supabase = await createSupabaseServerClient();
  const messageResult = await createMessageRecord({
    conversationId: input.conversationId,
    senderId: input.senderId,
    body: input.body ?? null,
    replyToMessageId: input.replyToMessageId ?? null,
    touchConversation: false,
  });
  const fileName = sanitizeAttachmentFileName(input.file.name);
  const objectPath = `${input.conversationId}/${messageResult.messageId}/${Date.now()}-${fileName}`;
  const fileBuffer = Buffer.from(await input.file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .upload(objectPath, fileBuffer, {
      cacheControl: '3600',
      contentType: input.file.type,
      upsert: false,
    });

  if (uploadError) {
    await supabase.from('messages').delete().eq('id', messageResult.messageId);
    throw new Error(uploadError.message);
  }

  const { error: attachmentError } = await supabase
    .from('message_attachments')
    .insert({
      message_id: messageResult.messageId,
      bucket: CHAT_ATTACHMENT_BUCKET,
      object_path: objectPath,
      mime_type: input.file.type,
      size_bytes: input.file.size,
    });

  if (attachmentError) {
    await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove([objectPath]);
    await supabase.from('messages').delete().eq('id', messageResult.messageId);
    throw new Error(attachmentError.message);
  }

  const { error: updateError } = await supabase
    .from('conversations')
    .update({ last_message_at: messageResult.timestamp })
    .eq('id', input.conversationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return messageResult;
}
