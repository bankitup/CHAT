export const AVATAR_DELIVERY_ROUTE_PREFIX = '/api/messaging/avatar';

export function isAbsoluteAvatarUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return value.startsWith('https://') || value.startsWith('http://');
}

export function normalizeManagedAvatarObjectPath(
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (
    !normalizedValue ||
    isAbsoluteAvatarUrl(normalizedValue) ||
    normalizedValue.startsWith('/') ||
    normalizedValue.includes('..')
  ) {
    return null;
  }

  const segments = normalizedValue
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return segments.join('/');
}

export function buildAvatarDeliveryPath(value: string | null | undefined) {
  const normalizedValue = normalizeManagedAvatarObjectPath(value);

  if (!normalizedValue) {
    return null;
  }

  return `${AVATAR_DELIVERY_ROUTE_PREFIX}/${normalizedValue
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

export function decodeAvatarDeliveryPathSegments(segments: string[] | undefined) {
  if (!segments?.length) {
    return null;
  }

  try {
    return normalizeManagedAvatarObjectPath(
      segments.map((segment) => decodeURIComponent(segment)).join('/'),
    );
  } catch {
    return null;
  }
}
