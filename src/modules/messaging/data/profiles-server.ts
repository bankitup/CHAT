import 'server-only';

import type { User } from '@supabase/supabase-js';
import {
  getRequestSupabaseServerClient,
  getRequestViewer,
  requireRequestViewer,
} from '@/lib/request-context/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { normalizeLanguage, type AppLanguage } from '@/modules/i18n';
import {
  PROFILE_AVATAR_MAX_SIZE_BYTES,
  isSupportedProfileAvatarType,
  sanitizeProfileFileName,
} from '@/modules/profile/avatar';
import type {
  CurrentUserProfile,
  ProfileIdentityRecord,
} from '@/modules/profile/types';
import {
  buildAvatarDeliveryPath,
  isAbsoluteAvatarUrl,
} from '@/modules/messaging/avatar-delivery';

const PROFILE_AVATAR_BUCKET =
  process.env.SUPABASE_AVATARS_BUCKET?.trim() || 'avatars';

function createSchemaRequirementError(details: string) {
  return new Error(
    `${details} Apply the documented Supabase changes in /Users/danya/IOS - Apps/CHAT/docs/schema-assumptions.md.`,
  );
}

function getSupabaseErrorDiagnostics(error: unknown) {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const details = error as {
    code?: string | null;
    status?: number | null;
    details?: string | null;
    hint?: string | null;
  };

  return {
    error_code: details.code ?? null,
    error_details: details.details ?? null,
    error_hint: details.hint ?? null,
    error_status: details.status ?? null,
  };
}

function logProfileSettingsDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (details) {
    console.error('[profile-settings]', stage, details);
    return;
  }

  console.error('[profile-settings]', stage);
}

function isMissingColumnErrorMessage(message: string, columnName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('column') &&
    normalizedMessage.includes(columnName.toLowerCase())
  );
}

function isManagedAvatarObjectPath(
  userId: string,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue || isAbsoluteAvatarUrl(normalizedValue)) {
    return false;
  }

  return normalizedValue.startsWith(`${userId}/`);
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

function resolveStoredAvatarPath(
  _supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue) {
    return null;
  }

  if (isAbsoluteAvatarUrl(normalizedValue)) {
    return normalizedValue;
  }

  const deliveryPath = buildAvatarDeliveryPath(normalizedValue);

  if (!deliveryPath) {
    return null;
  }

  if (process.env.CHAT_DEBUG_AVATARS === '1') {
    console.info('[avatar-storage]', {
      bucket: PROFILE_AVATAR_BUCKET,
      issue: 'stable-delivery-path',
      objectPath: normalizedValue,
      url: deliveryPath,
    });
  }

  return deliveryPath;
}

function getProfileStatusFromUserMetadata(user: User | null) {
  const metadata =
    user?.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>)
      : null;

  const normalizeMetadataValue = (value: unknown) =>
    typeof value === 'string' ? value.trim() || null : null;

  return {
    statusEmoji: normalizeMetadataValue(metadata?.status_emoji),
    statusText: normalizeMetadataValue(metadata?.status_text),
    statusUpdatedAt: normalizeMetadataValue(metadata?.status_updated_at),
  };
}

async function updateCurrentUserStatusMetadata(input: {
  supabase: Awaited<ReturnType<typeof getRequestSupabaseServerClient>>;
  statusEmoji: string | null;
  statusText: string | null;
  statusUpdatedAt: string | null;
}) {
  const response = await input.supabase.auth.updateUser({
    data: {
      status_emoji: input.statusEmoji,
      status_text: input.statusText,
      status_updated_at: input.statusUpdatedAt,
    },
  });

  if (response.error) {
    throw new Error(response.error.message);
  }
}

export async function getProfileIdentities(
  userIds: string[],
  options?: {
    includeAvatarPath?: boolean;
    includeStatuses?: boolean;
  },
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const includeAvatarPath = options?.includeAvatarPath !== false;
  const includeStatuses = options?.includeStatuses !== false;

  if (uniqueUserIds.length === 0) {
    return [] as ProfileIdentityRecord[];
  }

  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const loadProfiles = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    ids: string[],
  ) => {
    if (includeStatuses) {
      const withStatusesProjection = [
        'user_id',
        'display_name',
        'username',
        'email_local_part',
        ...(includeAvatarPath ? ['avatar_path'] : []),
        'status_emoji',
        'status_text',
        'status_updated_at',
      ].join(', ');
      const withStatuses = await client
        .from('profiles')
        .select(withStatusesProjection)
        .in('user_id', ids);

      if (!withStatuses.error) {
        const profiles = ((withStatuses.data ?? []) as unknown as {
          avatar_path?: string | null;
          display_name: string | null;
          email_local_part?: string | null;
          status_emoji?: string | null;
          status_text?: string | null;
          status_updated_at?: string | null;
          user_id: string;
          username?: string | null;
        }[]);

        return profiles.map((profile) => ({
          avatarPath: includeAvatarPath
            ? resolveStoredAvatarPath(client, profile.avatar_path)
            : null,
          displayName: profile.display_name?.trim() || null,
          emailLocalPart: profile.email_local_part?.trim() || null,
          statusEmoji: profile.status_emoji?.trim() || null,
          statusText: profile.status_text?.trim() || null,
          statusUpdatedAt: profile.status_updated_at?.trim() || null,
          userId: profile.user_id,
          username: profile.username?.trim() || null,
        }));
      }
    }

    const withIdentityProjection = [
      'user_id',
      'display_name',
      'username',
      'email_local_part',
      ...(includeAvatarPath ? ['avatar_path'] : []),
    ].join(', ');
    const withIdentityFallbacksAndAvatars = await client
      .from('profiles')
      .select(withIdentityProjection)
      .in('user_id', ids);

    if (!withIdentityFallbacksAndAvatars.error) {
      const profiles = ((withIdentityFallbacksAndAvatars.data ?? []) as unknown as {
        avatar_path?: string | null;
        display_name: string | null;
        email_local_part?: string | null;
        user_id: string;
        username?: string | null;
      }[]);

      return profiles.map((profile) => ({
        avatarPath: includeAvatarPath
          ? resolveStoredAvatarPath(client, profile.avatar_path)
          : null,
        displayName: profile.display_name?.trim() || null,
        emailLocalPart: profile.email_local_part?.trim() || null,
        statusEmoji: null,
        statusText: null,
        statusUpdatedAt: null,
        userId: profile.user_id,
        username: profile.username?.trim() || null,
      }));
    }

    if (includeAvatarPath) {
      const withDisplayNamesAndAvatars = await client
        .from('profiles')
        .select('user_id, display_name, avatar_path')
        .in('user_id', ids);

      if (!withDisplayNamesAndAvatars.error) {
        const profiles = ((withDisplayNamesAndAvatars.data ?? []) as {
          avatar_path?: string | null;
          display_name: string | null;
          user_id: string;
        }[]);

        return profiles.map((profile) => ({
          avatarPath: resolveStoredAvatarPath(client, profile.avatar_path),
          displayName: profile.display_name?.trim() || null,
          emailLocalPart: null,
          statusEmoji: null,
          statusText: null,
          statusUpdatedAt: null,
          userId: profile.user_id,
          username: null,
        }));
      }
    }

    const withIdentityFallbacks = await client
      .from('profiles')
      .select('user_id, display_name, username, email_local_part')
      .in('user_id', ids);

    if (!withIdentityFallbacks.error) {
      return ((withIdentityFallbacks.data ?? []) as {
        display_name: string | null;
        email_local_part?: string | null;
        user_id: string;
        username?: string | null;
      }[]).map((profile) => ({
        avatarPath: null,
        displayName: profile.display_name?.trim() || null,
        emailLocalPart: profile.email_local_part?.trim() || null,
        statusEmoji: null,
        statusText: null,
        statusUpdatedAt: null,
        userId: profile.user_id,
        username: profile.username?.trim() || null,
      }));
    }

    const withDisplayNames = await client
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', ids);

    if (!withDisplayNames.error) {
      return ((withDisplayNames.data ?? []) as {
        display_name: string | null;
        user_id: string;
      }[]).map((profile) => ({
        avatarPath: null,
        displayName: profile.display_name?.trim() || null,
        emailLocalPart: null,
        statusEmoji: null,
        statusText: null,
        statusUpdatedAt: null,
        userId: profile.user_id,
        username: null,
      }));
    }

    const fallback = await client
      .from('profiles')
      .select('user_id')
      .in('user_id', ids);

    if (fallback.error) {
      throw new Error(fallback.error.message);
    }

    return ((fallback.data ?? []) as { user_id: string }[]).map((profile) => ({
      avatarPath: null,
      displayName: null,
      emailLocalPart: null,
      statusEmoji: null,
      statusText: null,
      statusUpdatedAt: null,
      userId: profile.user_id,
      username: null,
    }));
  };

  const mergeIdentity = (
    base: ProfileIdentityRecord | undefined,
    fallback: ProfileIdentityRecord,
  ) => ({
    avatarPath: base?.avatarPath ?? fallback.avatarPath ?? null,
    displayName: base?.displayName ?? fallback.displayName ?? null,
    emailLocalPart: base?.emailLocalPart ?? fallback.emailLocalPart ?? null,
    statusEmoji: base?.statusEmoji ?? fallback.statusEmoji ?? null,
    statusText: base?.statusText ?? fallback.statusText ?? null,
    statusUpdatedAt: base?.statusUpdatedAt ?? fallback.statusUpdatedAt ?? null,
    userId: fallback.userId,
    username: base?.username ?? fallback.username ?? null,
  });

  const authProfiles = await loadProfiles(supabase, uniqueUserIds);
  const profilesByUserId = new Map(
    authProfiles.map((profile) => [profile.userId, profile]),
  );

  const missingUserIds = uniqueUserIds.filter(
    (userId) => !profilesByUserId.has(userId),
  );

  if (missingUserIds.length > 0 && serviceSupabase) {
    const fallbackProfiles = await loadProfiles(serviceSupabase, missingUserIds);

    for (const profile of fallbackProfiles) {
      profilesByUserId.set(
        profile.userId,
        mergeIdentity(profilesByUserId.get(profile.userId), profile),
      );
    }
  }

  const orderedProfiles: ProfileIdentityRecord[] = [];

  for (const userId of uniqueUserIds) {
    const profile = profilesByUserId.get(userId);

    if (profile) {
      orderedProfiles.push(profile);
    }
  }

  return orderedProfiles;
}

export async function getCurrentUserProfile(userId: string, email?: string | null) {
  const supabase = await createSupabaseServerClient();
  const requestViewer = await getRequestViewer();
  const [identity] = await getProfileIdentities([userId]);
  let preferredLanguage: AppLanguage | null = null;
  let statusEmoji: string | null = null;
  let statusText: string | null = null;
  let statusUpdatedAt: string | null = null;
  let usedStatusMetadataFallback = false;
  const requestViewerStatusFallback = getProfileStatusFromUserMetadata(
    requestViewer?.id === userId ? requestViewer : null,
  );

  const withLanguage = await supabase
    .from('profiles')
    .select('preferred_language, status_emoji, status_text, status_updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!withLanguage.error) {
    const row = withLanguage.data as
      | {
          preferred_language?: string | null;
          status_emoji?: string | null;
          status_text?: string | null;
          status_updated_at?: string | null;
        }
      | null;
    const rawLanguage = row?.preferred_language;
    preferredLanguage = rawLanguage ? normalizeLanguage(rawLanguage) : null;
    statusEmoji = row?.status_emoji?.trim() || null;
    statusText = row?.status_text?.trim() || null;
    statusUpdatedAt = row?.status_updated_at?.trim() || null;
  } else if (
    isMissingColumnErrorMessage(withLanguage.error.message, 'status_emoji') ||
    isMissingColumnErrorMessage(withLanguage.error.message, 'status_text') ||
    isMissingColumnErrorMessage(withLanguage.error.message, 'status_updated_at')
  ) {
    const languageOnly = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('user_id', userId)
      .maybeSingle();

    if (!languageOnly.error) {
      const rawLanguage = (
        languageOnly.data as { preferred_language?: string | null } | null
      )?.preferred_language;
      preferredLanguage = rawLanguage ? normalizeLanguage(rawLanguage) : null;
    } else if (
      !isMissingColumnErrorMessage(languageOnly.error.message, 'preferred_language')
    ) {
      throw new Error(languageOnly.error.message);
    }

    usedStatusMetadataFallback = true;
  } else if (
    !isMissingColumnErrorMessage(withLanguage.error.message, 'preferred_language')
  ) {
    throw new Error(withLanguage.error.message);
  }

  const hasMetadataStatusFallback = Boolean(
    requestViewerStatusFallback.statusEmoji ||
      requestViewerStatusFallback.statusText ||
      requestViewerStatusFallback.statusUpdatedAt,
  );

  if (
    usedStatusMetadataFallback ||
    (hasMetadataStatusFallback &&
      !statusEmoji &&
      !statusText &&
      !statusUpdatedAt)
  ) {
    statusEmoji = requestViewerStatusFallback.statusEmoji;
    statusText = requestViewerStatusFallback.statusText;
    statusUpdatedAt = requestViewerStatusFallback.statusUpdatedAt;
  }

  return {
    avatarPath: identity?.avatarPath ?? null,
    displayName: identity?.displayName ?? null,
    email: email?.trim() || null,
    preferredLanguage,
    statusEmoji,
    statusText,
    statusUpdatedAt,
    userId,
    username: identity?.username ?? null,
  } satisfies CurrentUserProfile;
}

export async function getStoredProfileLanguage(userId: string) {
  const supabase = await createSupabaseServerClient();
  const response = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('user_id', userId)
    .maybeSingle();

  if (!response.error) {
    const rawLanguage = (
      response.data as { preferred_language?: string | null } | null
    )?.preferred_language;
    return rawLanguage ? normalizeLanguage(rawLanguage) : null;
  }

  if (isMissingColumnErrorMessage(response.error.message, 'preferred_language')) {
    return null;
  }

  throw new Error(response.error.message);
}

export async function updateCurrentUserProfile(input: {
  avatarFile?: File | null;
  avatarObjectPath?: string | null;
  displayName: string | null;
  removeAvatar?: boolean;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to update a profile.');
  }

  const user = await requireRequestViewer('Profile settings debug');

  if (!user?.id) {
    throw new Error('Profile settings debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Profile settings debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const nextDisplayName = input.displayName?.trim() || null;
  const existingProfileResponse = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('profile-lookup-error', {
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
      userId: input.userId,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const existingAvatarPath =
    (
      existingProfileResponse.data as
        | {
            avatar_path?: string | null;
          }
        | null
    )?.avatar_path?.trim() || null;

  if (nextDisplayName && nextDisplayName.length > 40) {
    throw new Error('Display name can be up to 40 characters.');
  }

  let nextAvatarPath: string | null | undefined;
  let uploadedAvatarObjectPath: string | null = null;
  const requestedAvatarObjectPath = input.avatarObjectPath?.trim() || null;
  const shouldRemoveAvatar =
    Boolean(input.removeAvatar) &&
    !requestedAvatarObjectPath &&
    !(input.avatarFile && input.avatarFile.size > 0);

  if (requestedAvatarObjectPath) {
    if (!isManagedAvatarObjectPath(input.userId, requestedAvatarObjectPath)) {
      throw new Error('Avatar upload path is invalid for this user.');
    }

    uploadedAvatarObjectPath = requestedAvatarObjectPath;
    nextAvatarPath = requestedAvatarObjectPath;
  } else if (input.avatarFile && input.avatarFile.size > 0) {
    if (input.avatarFile.size > PROFILE_AVATAR_MAX_SIZE_BYTES) {
      throw new Error('Avatar images can be up to 5 MB.');
    }

    if (!isSupportedProfileAvatarType(input.avatarFile.type)) {
      throw new Error('Avatar must be a JPG, PNG, WEBP, or GIF image.');
    }

    const fileName = sanitizeProfileFileName(input.avatarFile.name);
    const objectPath = `${input.userId}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(objectPath, input.avatarFile, {
        contentType: input.avatarFile.type,
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

  const profilePayload = {
    user_id: input.userId,
    display_name: nextDisplayName,
    ...(nextAvatarPath !== undefined ? { avatar_path: nextAvatarPath } : {}),
  };

  const profileExists = Boolean(existingProfileResponse.data);
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update({
          display_name: nextDisplayName,
          ...(nextAvatarPath !== undefined ? { avatar_path: nextAvatarPath } : {}),
        })
        .eq('user_id', input.userId)
    : await supabase.from('profiles').insert(profilePayload);

  if (profileWrite.error) {
    if (uploadedAvatarObjectPath) {
      await supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .remove([uploadedAvatarObjectPath]);
    }

    logProfileSettingsDiagnostics('profile-write-error', {
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      hasAvatarPath: nextAvatarPath !== undefined,
      hasDisplayName: nextDisplayName !== null,
      message: profileWrite.error.message,
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId: input.userId,
    });

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Profile settings update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }

  if (
    existingAvatarPath &&
    isManagedAvatarObjectPath(input.userId, existingAvatarPath) &&
    existingAvatarPath !== uploadedAvatarObjectPath &&
    (uploadedAvatarObjectPath || shouldRemoveAvatar)
  ) {
    await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .remove([existingAvatarPath]);
  }
}

export async function updateCurrentUserStatus(input: {
  statusEmoji: string | null;
  statusText: string | null;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to update status.');
  }

  const user = await requireRequestViewer('Profile status debug');

  if (!user?.id) {
    throw new Error('Profile status debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Profile status debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const nextStatusEmoji = input.statusEmoji?.trim() || null;
  const nextStatusText = input.statusText?.trim() || null;
  const nextStatusUpdatedAt =
    nextStatusEmoji || nextStatusText ? new Date().toISOString() : null;

  if (nextStatusEmoji && nextStatusEmoji.length > 16) {
    throw new Error('Status emoji can be up to 16 characters.');
  }

  if (nextStatusText && nextStatusText.length > 80) {
    throw new Error('Status text can be up to 80 characters.');
  }

  const existingProfileResponse = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('status-profile-lookup-error', {
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
      userId: input.userId,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const profileExists = Boolean(existingProfileResponse.data);
  const statusPayload = {
    status_emoji: nextStatusEmoji,
    status_text: nextStatusText,
    status_updated_at: nextStatusUpdatedAt,
  };
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update(statusPayload)
        .eq('user_id', input.userId)
    : await supabase.from('profiles').insert({
        user_id: input.userId,
        ...statusPayload,
      });

  if (profileWrite.error) {
    logProfileSettingsDiagnostics('status-profile-write-error', {
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      message: profileWrite.error.message,
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId: input.userId,
    });

    if (
      isMissingColumnErrorMessage(profileWrite.error.message, 'status_emoji') ||
      isMissingColumnErrorMessage(profileWrite.error.message, 'status_text') ||
      isMissingColumnErrorMessage(profileWrite.error.message, 'status_updated_at')
    ) {
      logProfileSettingsDiagnostics('status-profile-write:fallback-auth-metadata', {
        userId: input.userId,
      });

      await updateCurrentUserStatusMetadata({
        statusEmoji: nextStatusEmoji,
        statusText: nextStatusText,
        statusUpdatedAt: nextStatusUpdatedAt,
        supabase,
      });
      return;
    }

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Profile status update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }

  try {
    await updateCurrentUserStatusMetadata({
      statusEmoji: nextStatusEmoji,
      statusText: nextStatusText,
      statusUpdatedAt: nextStatusUpdatedAt,
      supabase,
    });
  } catch (error) {
    logProfileSettingsDiagnostics('status-auth-metadata-sync-error', {
      message: error instanceof Error ? error.message : String(error),
      userId: input.userId,
    });
  }
}

export async function removeCurrentUserAvatar(userId: string) {
  const supabase = await getRequestSupabaseServerClient();

  if (!userId) {
    throw new Error('Authenticated user is required to update a profile.');
  }

  const user = await requireRequestViewer('Profile settings debug');

  if (!user?.id) {
    throw new Error('Profile settings debug: no authenticated user found.');
  }

  if (user.id !== userId) {
    throw new Error(
      `Profile settings debug: user mismatch. auth user id=${user.id}, payload user id=${userId}.`,
    );
  }

  const existingProfileResponse = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('avatar-remove-profile-lookup-error', {
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
      userId,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const existingAvatarPath =
    (
      existingProfileResponse.data as
        | {
            avatar_path?: string | null;
          }
        | null
    )?.avatar_path?.trim() || null;

  const profileExists = Boolean(existingProfileResponse.data);
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update({ avatar_path: null })
        .eq('user_id', userId)
    : await supabase.from('profiles').insert({
        avatar_path: null,
        user_id: userId,
      });

  if (profileWrite.error) {
    logProfileSettingsDiagnostics('avatar-remove-profile-write-error', {
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      message: profileWrite.error.message,
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId,
    });

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Profile settings update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }

  if (isManagedAvatarObjectPath(userId, existingAvatarPath)) {
    await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .remove([existingAvatarPath ?? '']);
  }
}

export async function updateCurrentUserLanguagePreference(input: {
  preferredLanguage: AppLanguage;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to update language.');
  }

  const user = await requireRequestViewer('Language update debug');

  if (!user?.id) {
    throw new Error('Language update debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Language update debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const existingProfileResponse = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('language-profile-lookup-error', {
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
      userId: input.userId,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const profileExists = Boolean(existingProfileResponse.data);
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update({
          preferred_language: input.preferredLanguage,
        })
        .eq('user_id', input.userId)
    : await supabase.from('profiles').insert({
        preferred_language: input.preferredLanguage,
        user_id: input.userId,
      });

  if (profileWrite.error) {
    logProfileSettingsDiagnostics('language-profile-write-error', {
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      message: profileWrite.error.message,
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId: input.userId,
    });

    if (isMissingColumnErrorMessage(profileWrite.error.message, 'preferred_language')) {
      throw createSchemaRequirementError(
        'Profile language preference requires profiles.preferred_language.',
      );
    }

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Language preference update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }
}
