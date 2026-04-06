export type GroupConversationJoinPolicy = 'open' | 'closed';

export type GroupConversationMemberRole = 'owner' | 'admin' | 'member';

export function normalizeGroupConversationJoinPolicy(
  value: string | null | undefined,
): GroupConversationJoinPolicy {
  return value?.trim().toLowerCase() === 'open' ? 'open' : 'closed';
}

export function normalizeGroupConversationMemberRole(
  value: string | null | undefined,
): GroupConversationMemberRole {
  if (value === 'owner' || value === 'admin') {
    return value;
  }

  return 'member';
}

export function isGroupConversationAdminRole(
  value: string | null | undefined,
) {
  const role = normalizeGroupConversationMemberRole(value);
  return role === 'owner' || role === 'admin';
}

export function canEditGroupConversationIdentity(
  value: string | null | undefined,
) {
  return isGroupConversationAdminRole(value);
}

export function canAddParticipantsToGroupConversation(
  joinPolicy: GroupConversationJoinPolicy,
  role: string | null | undefined,
) {
  if (isGroupConversationAdminRole(role)) {
    return true;
  }

  return (
    joinPolicy === 'open' &&
    normalizeGroupConversationMemberRole(role) === 'member'
  );
}

export function canRemoveParticipantFromGroupConversation(
  actingRole: string | null | undefined,
  targetRole: string | null | undefined,
) {
  const normalizedActingRole = normalizeGroupConversationMemberRole(actingRole);
  const normalizedTargetRole = normalizeGroupConversationMemberRole(targetRole);

  if (normalizedActingRole === 'owner') {
    return normalizedTargetRole !== 'owner';
  }

  if (normalizedActingRole === 'admin') {
    return normalizedTargetRole === 'member';
  }

  return false;
}

export function canSelfJoinGroupConversation(
  joinPolicy: GroupConversationJoinPolicy,
) {
  return joinPolicy === 'open';
}
