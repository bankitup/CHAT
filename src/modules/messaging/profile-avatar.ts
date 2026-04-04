export const PROFILE_AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif';
export const PROFILE_AVATAR_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET?.trim() || 'avatars';

const SUPPORTED_PROFILE_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function isSupportedProfileAvatarType(mimeType: string | null | undefined) {
  return Boolean(mimeType && SUPPORTED_PROFILE_AVATAR_TYPES.has(mimeType));
}

export function sanitizeProfileFileName(value: string) {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return 'avatar';
  }

  return (
    trimmed
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'avatar'
  );
}
