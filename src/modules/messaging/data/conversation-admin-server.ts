import 'server-only';

import {
  getRequestSupabaseServerClient,
  requireRequestViewer,
} from '@/lib/request-context/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { isAbsoluteAvatarUrl } from '@/modules/messaging/avatar-delivery';
import {
  canAddParticipantsToGroupConversation,
  canEditGroupConversationIdentity,
  canRemoveParticipantFromGroupConversation,
  normalizeGroupConversationJoinPolicy,
} from '@/modules/messaging/group-policy';
import {
  PROFILE_AVATAR_MAX_SIZE_BYTES,
  isSupportedProfileAvatarType,
  sanitizeProfileFileName,
} from '@/modules/messaging/profile-avatar';
import type { ConversationNotificationLevel } from './server';

const PROFILE_AVATAR_BUCKET =
  process.env.SUPABASE_AVATARS_BUCKET?.trim() || 'avatars';

function normalizeJoinedRecord<T>(value: T | T[] | null) {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function isMissingColumnErrorMessage(message: string, columnName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('column') &&
    normalizedMessage.includes(columnName.toLowerCase())
  );
}

function normalizeConversationLatestMessageSeq(
  value: number | string | null | undefined,
) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function createSchemaRequirementError(details: string) {
  return new Error(
    `${details} Apply the documented Supabase changes in /Users/danya/IOS - Apps/CHAT/docs/schema-assumptions.md.`,
  );
}

function isBucketNotFoundStorageErrorMessage(message: string) {
  return message.toLowerCase().includes('bucket not found');
}

function getAvatarBucketRequirementErrorMessage() {
  console.error('[avatar-storage]', {
    bucket: PROFILE_AVATAR_BUCKET,
    issue: 'bucket-not-found',
    setupSql: 'docs/sql/2026-04-03-avatars-storage-policies.sql',
  });

  return 'Avatar uploads are not available right now.';
}

async function getActiveGroupMembership(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const buildQuery = (select: string) =>
    supabase
      .from('conversation_members')
      .select(select)
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('state', 'active')
      .eq('conversations.kind', 'group')
      .maybeSingle();
  let data: unknown = null;
  let error: { message: string } | null = null;

  const responseWithJoinPolicy = await buildQuery(
    'user_id, role, state, conversations!inner(id, kind, join_policy)',
  );

  if (
    responseWithJoinPolicy.error &&
    isMissingColumnErrorMessage(responseWithJoinPolicy.error.message, 'join_policy')
  ) {
    const fallbackResponse = await buildQuery(
      'user_id, role, state, conversations!inner(id, kind)',
    );
    data = fallbackResponse.data;
    error = fallbackResponse.error;
  } else {
    data = responseWithJoinPolicy.data;
    error = responseWithJoinPolicy.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  const membership = data as
    | {
        conversations?:
          | {
              join_policy?: string | null;
            }
          | Array<{
              join_policy?: string | null;
            }>
          | null;
        role: string | null;
        state: string | null;
        user_id: string;
      }
    | null;
  const conversation = normalizeJoinedRecord(membership?.conversations ?? null);

  if (!membership) {
    return null;
  }

  return {
    joinPolicy: normalizeGroupConversationJoinPolicy(
      conversation?.join_policy ?? null,
    ),
    role: membership.role ?? null,
    state: membership.state ?? null,
    user_id: membership.user_id,
  };
}

async function assertGroupConversationTarget(input: {
  conversationId: string;
  failureMessage: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const { data, error } = await input.supabase
    .from('conversations')
    .select('kind')
    .eq('id', input.conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('This chat is no longer available.');
  }

  const kind = ((data as { kind?: string | null } | null)?.kind ?? null)?.trim() ?? null;

  if (kind !== 'group') {
    throw new Error(input.failureMessage);
  }
}

function getGroupManagementWriteClient(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  return createSupabaseServiceRoleClient() ?? supabase;
}

function dedupeParticipantIds(ids: string[]) {
  return Array.from(new Set(ids.map((value) => value.trim()).filter(Boolean)));
}

function isManagedConversationAvatarObjectPath(
  conversationId: string,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue || isAbsoluteAvatarUrl(normalizedValue)) {
    return false;
  }

  if (normalizedValue.startsWith(`conversations/${conversationId}/`)) {
    return true;
  }

  const pathSegments = normalizedValue.split('/').filter(Boolean);

  return (
    pathSegments.length >= 4 &&
    pathSegments[1] === 'conversation-avatars' &&
    pathSegments[2] === conversationId
  );
}

function isManagedConversationAvatarUploadPathForUser(
  userId: string,
  conversationId: string,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue || isAbsoluteAvatarUrl(normalizedValue)) {
    return false;
  }

  if (normalizedValue.startsWith(`conversations/${conversationId}/`)) {
    return true;
  }

  return normalizedValue.startsWith(
    `${userId}/conversation-avatars/${conversationId}/`,
  );
}

export async function updateConversationNotificationLevel(input: {
  conversationId: string;
  notificationLevel: ConversationNotificationLevel;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation notifications debug: authenticated user is required.');
  }

  const user = await requireRequestViewer('Conversation notifications debug');

  if (!user?.id) {
    throw new Error('Conversation notifications debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation notifications debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  if (input.notificationLevel !== 'default' && input.notificationLevel !== 'muted') {
    throw new Error('Choose a valid notification preference.');
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error('Only an active participant can change this setting.');
  }

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({ notification_level: input.notificationLevel })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (isMissingColumnErrorMessage(updateError.message, 'notification_level')) {
      throw createSchemaRequirementError(
        'Per-chat notification preferences require public.conversation_members.notification_level.',
      );
    }

    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation notifications debug: update blocked by conversation_members RLS.',
      );
    }

    throw new Error(updateError.message);
  }

  return { updated: true };
}

export async function setConversationHistoryVisibleFromNextMessage(input: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation history baseline debug: authenticated user is required.');
  }

  const user = await requireRequestViewer('Conversation history baseline debug');

  if (!user?.id) {
    throw new Error('Conversation history baseline debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation history baseline debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error('Only an active participant can reset visible history.');
  }

  const latestRow = await supabase
    .from('messages')
    .select('seq')
    .eq('conversation_id', input.conversationId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRow.error) {
    throw new Error(latestRow.error.message);
  }

  const latestMessageSeq = normalizeConversationLatestMessageSeq(
    latestRow.data?.seq ?? null,
  );
  const nextVisibleFromSeq = latestMessageSeq === null ? 1 : latestMessageSeq + 1;

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({ visible_from_seq: nextVisibleFromSeq })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (isMissingColumnErrorMessage(updateError.message, 'visible_from_seq')) {
      throw createSchemaRequirementError(
        'Per-member history baselines require public.conversation_members.visible_from_seq.',
      );
    }

    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation history baseline debug: update blocked by conversation_members RLS.',
      );
    }

    throw new Error(updateError.message);
  }

  return {
    nextVisibleFromSeq,
    updated: true,
  };
}

export async function updateConversationTitle(input: {
  conversationId: string;
  title: string;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const writeSupabase = getGroupManagementWriteClient(supabase);

  if (!input.userId) {
    throw new Error('Authenticated user is required to edit a group title.');
  }

  const user = await requireRequestViewer('Conversation settings debug');

  if (!user?.id) {
    throw new Error('Conversation settings debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation settings debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.userId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (!canEditGroupConversationIdentity(actingMembership.role)) {
    throw new Error('Only group admins can edit chat identity.');
  }

  const { error } = await writeSupabase
    .from('conversations')
    .update({ title: input.title.trim() })
    .eq('id', input.conversationId)
    .eq('kind', 'group');

  if (error) {
    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation settings debug: title update blocked by conversations RLS.',
      );
    }

    throw new Error(error.message);
  }
}

export async function updateConversationIdentity(input: {
  avatarFile?: File | null;
  avatarObjectPath?: string | null;
  conversationId: string;
  joinPolicy?: 'closed' | 'open' | null;
  removeAvatar?: boolean;
  title: string;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const writeSupabase = getGroupManagementWriteClient(supabase);

  if (!input.userId) {
    throw new Error('Authenticated user is required to edit group settings.');
  }

  const user = await requireRequestViewer('Conversation settings debug');

  if (!user?.id) {
    throw new Error('Conversation settings debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation settings debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const nextTitle = input.title.trim();

  if (!nextTitle) {
    throw new Error('Group title cannot be empty.');
  }

  if (nextTitle.length > 80) {
    throw new Error('Group title can be up to 80 characters.');
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.userId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (!canEditGroupConversationIdentity(actingMembership.role)) {
    throw new Error('Only group admins can edit chat identity.');
  }

  const nextJoinPolicy =
    input.joinPolicy == null
      ? actingMembership.joinPolicy
      : normalizeGroupConversationJoinPolicy(input.joinPolicy);

  const existingConversationResponse = await supabase
    .from('conversations')
    .select('kind, avatar_path, join_policy')
    .eq('id', input.conversationId)
    .maybeSingle();

  let existingConversation = existingConversationResponse.data as
    | {
        avatar_path?: string | null;
        join_policy?: string | null;
        kind?: string | null;
      }
    | null;

  if (existingConversationResponse.error) {
    if (
      isMissingColumnErrorMessage(existingConversationResponse.error.message, 'avatar_path') ||
      isMissingColumnErrorMessage(existingConversationResponse.error.message, 'join_policy')
    ) {
      const fallbackConversationResponse = await supabase
        .from('conversations')
        .select('kind')
        .eq('id', input.conversationId)
        .maybeSingle();

      if (fallbackConversationResponse.error) {
        throw new Error(fallbackConversationResponse.error.message);
      }

      existingConversation = (fallbackConversationResponse.data as
        | {
            kind?: string | null;
          }
        | null) ?? null;
    } else {
      throw new Error(existingConversationResponse.error.message);
    }
  }

  if (!existingConversation || existingConversation.kind !== 'group') {
    throw new Error('Only group chats support editable chat identity.');
  }

  const conversationSupportsJoinPolicy = Object.prototype.hasOwnProperty.call(
    existingConversation,
    'join_policy',
  );

  if (!conversationSupportsJoinPolicy && nextJoinPolicy !== 'closed') {
    throw createSchemaRequirementError(
      'Group privacy settings require public.conversations.join_policy.',
    );
  }

  const existingAvatarPath = existingConversation.avatar_path?.trim() || null;
  const requestedAvatarObjectPath = input.avatarObjectPath?.trim() || null;
  const avatarFile = input.avatarFile && input.avatarFile.size > 0 ? input.avatarFile : null;
  const shouldRemoveAvatar =
    Boolean(input.removeAvatar) &&
    !requestedAvatarObjectPath &&
    !avatarFile;
  let nextAvatarPath: string | null | undefined;
  let uploadedAvatarObjectPath: string | null = null;

  if (requestedAvatarObjectPath) {
    if (
      !isManagedConversationAvatarUploadPathForUser(
        input.userId,
        input.conversationId,
        requestedAvatarObjectPath,
      )
    ) {
      throw new Error('Avatar upload path is invalid for this chat.');
    }

    uploadedAvatarObjectPath = requestedAvatarObjectPath;
    nextAvatarPath = requestedAvatarObjectPath;
  } else if (avatarFile) {
    if (avatarFile.size > PROFILE_AVATAR_MAX_SIZE_BYTES) {
      throw new Error('Avatar images can be up to 5 MB.');
    }

    if (!isSupportedProfileAvatarType(avatarFile.type)) {
      throw new Error('Avatar must be a JPG, PNG, WEBP, or GIF image.');
    }

    const serviceSupabase = createSupabaseServiceRoleClient();

    if (!serviceSupabase) {
      throw new Error('Chat avatar uploads are not available right now.');
    }

    const fileName = sanitizeProfileFileName(avatarFile.name);
    const objectPath = `conversations/${input.conversationId}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await serviceSupabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(objectPath, avatarFile, {
        contentType: avatarFile.type,
        upsert: false,
      });

    if (uploadError) {
      if (isBucketNotFoundStorageErrorMessage(uploadError.message)) {
        throw new Error(getAvatarBucketRequirementErrorMessage());
      }

      throw new Error(uploadError.message);
    }

    uploadedAvatarObjectPath = objectPath;
    nextAvatarPath = objectPath;
  } else if (shouldRemoveAvatar) {
    nextAvatarPath = null;
  }

  const updatePayload = {
    title: nextTitle,
    ...(conversationSupportsJoinPolicy ? { join_policy: nextJoinPolicy } : {}),
    ...(nextAvatarPath !== undefined ? { avatar_path: nextAvatarPath } : {}),
  };

  const { error } = await writeSupabase
    .from('conversations')
    .update(updatePayload)
    .eq('id', input.conversationId)
    .eq('kind', 'group');

  if (error) {
    if (uploadedAvatarObjectPath) {
      await (createSupabaseServiceRoleClient() ?? supabase)
        .storage.from(PROFILE_AVATAR_BUCKET)
        .remove([uploadedAvatarObjectPath]);
    }

    if (isMissingColumnErrorMessage(error.message, 'avatar_path')) {
      throw createSchemaRequirementError(
        'Editable group avatars require public.conversations.avatar_path.',
      );
    }

    if (isMissingColumnErrorMessage(error.message, 'join_policy')) {
      throw createSchemaRequirementError(
        'Group privacy settings require public.conversations.join_policy.',
      );
    }

    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation settings debug: identity update blocked by conversations RLS.',
      );
    }

    throw new Error(error.message);
  }

  if (
    existingAvatarPath &&
    isManagedConversationAvatarObjectPath(input.conversationId, existingAvatarPath) &&
    existingAvatarPath !== uploadedAvatarObjectPath &&
    (uploadedAvatarObjectPath || shouldRemoveAvatar)
  ) {
    await (createSupabaseServiceRoleClient() ?? supabase)
      .storage.from(PROFILE_AVATAR_BUCKET)
      .remove([existingAvatarPath]);
  }
}

export async function addParticipantsToGroupConversation(input: {
  actingUserId: string;
  conversationId: string;
  participantUserIds: string[];
}) {
  const supabase = await getRequestSupabaseServerClient();
  const writeSupabase = getGroupManagementWriteClient(supabase);

  await assertGroupConversationTarget({
    conversationId: input.conversationId,
    failureMessage: 'Direct messages are private and cannot add participants.',
    supabase,
  });

  if (!input.actingUserId) {
    throw new Error('Group management debug: authenticated member is required.');
  }

  const user = await requireRequestViewer('Group management debug');

  if (!user?.id) {
    throw new Error('Group management debug: no authenticated user found.');
  }

  if (user.id !== input.actingUserId) {
    throw new Error(
      `Group management debug: user mismatch. auth user id=${user.id}, payload user id=${input.actingUserId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.actingUserId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (
    !canAddParticipantsToGroupConversation(
      actingMembership.joinPolicy,
      actingMembership.role,
    )
  ) {
    throw new Error(
      actingMembership.joinPolicy === 'open'
        ? 'Only active group members can add people here.'
        : 'Only group admins can add people to a closed group.',
    );
  }

  const participantUserIds = dedupeParticipantIds(input.participantUserIds).filter(
    (participantUserId) => participantUserId !== input.actingUserId,
  );

  if (participantUserIds.length === 0) {
    throw new Error('Choose at least one participant to add.');
  }

  const { data: existingMemberships, error: membershipLookupError } = await writeSupabase
    .from('conversation_members')
    .select('user_id, state')
    .eq('conversation_id', input.conversationId)
    .in('user_id', participantUserIds);

  if (membershipLookupError) {
    throw new Error(membershipLookupError.message);
  }

  const existingByUserId = new Map(
    ((existingMemberships ?? []) as {
      state: string | null;
      user_id: string;
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
    const { error: reactivateError } = await writeSupabase
      .from('conversation_members')
      .update({
        last_read_at: null,
        last_read_message_seq: null,
        role: 'member',
        state: 'active',
      })
      .eq('conversation_id', input.conversationId)
      .in('user_id', usersToReactivate);

    if (reactivateError) {
      throw new Error(reactivateError.message);
    }
  }

  if (usersToInsert.length > 0) {
    const { error: insertError } = await writeSupabase
      .from('conversation_members')
      .insert(
        usersToInsert.map((participantUserId) => ({
          conversation_id: input.conversationId,
          role: 'member',
          state: 'active',
          user_id: participantUserId,
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

export async function removeParticipantFromGroupConversation(input: {
  actingUserId: string;
  conversationId: string;
  targetUserId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const writeSupabase = getGroupManagementWriteClient(supabase);

  await assertGroupConversationTarget({
    conversationId: input.conversationId,
    failureMessage: 'Only group chats can remove participants.',
    supabase,
  });

  if (!input.actingUserId) {
    throw new Error('Group management debug: authenticated member is required.');
  }

  const user = await requireRequestViewer('Group management debug');

  if (!user?.id) {
    throw new Error('Group management debug: no authenticated user found.');
  }

  if (user.id !== input.actingUserId) {
    throw new Error(
      `Group management debug: user mismatch. auth user id=${user.id}, payload user id=${input.actingUserId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.actingUserId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (!input.targetUserId) {
    throw new Error('Choose a participant to remove.');
  }

  if (input.targetUserId === input.actingUserId) {
    throw new Error('Use leave group to remove yourself from the conversation.');
  }

  const targetMembership = await getActiveGroupMembership(
    input.conversationId,
    input.targetUserId,
  );

  if (!targetMembership) {
    throw new Error('That participant is no longer active in this group.');
  }

  if (
    !canRemoveParticipantFromGroupConversation(
      actingMembership.role,
      targetMembership.role,
    )
  ) {
    throw new Error(
      targetMembership.role === 'owner'
        ? 'The current group owner cannot be removed here.'
        : 'Only group admins can remove that participant.',
    );
  }

  const { error: removeError } = await writeSupabase
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
  const supabase = await getRequestSupabaseServerClient();
  const writeSupabase = getGroupManagementWriteClient(supabase);

  await assertGroupConversationTarget({
    conversationId: input.conversationId,
    failureMessage: 'Only group chats can use leave group.',
    supabase,
  });

  if (!input.userId) {
    throw new Error('Group leave debug: authenticated user is required.');
  }

  const user = await requireRequestViewer('Group leave debug');

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
    const { data: nextOwnerRows, error: nextOwnerError } = await writeSupabase
      .from('conversation_members')
      .select('user_id, role')
      .eq('conversation_id', input.conversationId)
      .eq('state', 'active')
      .neq('user_id', input.userId)
      .order('user_id', { ascending: true });

    if (nextOwnerError) {
      throw new Error(nextOwnerError.message);
    }

    const nextOwnerUserId = ((nextOwnerRows ?? []) as Array<{
      role?: string | null;
      user_id: string;
    }>)
      .sort((left, right) => {
        const leftPriority = left.role === 'admin' ? 0 : 1;
        const rightPriority = right.role === 'admin' ? 0 : 1;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return left.user_id.localeCompare(right.user_id);
      })[0]?.user_id;

    if (nextOwnerUserId) {
      const { error: promoteError } = await writeSupabase
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

  const { error: leaveError } = await writeSupabase
    .from('conversation_members')
    .update({ state: 'left' })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (leaveError) {
    throw new Error(leaveError.message);
  }
}
