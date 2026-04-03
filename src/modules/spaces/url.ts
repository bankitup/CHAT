export function withSpaceParam(pathname: string, spaceId?: string | null) {
  const normalizedSpaceId = spaceId?.trim() ?? '';

  if (!normalizedSpaceId) {
    return pathname;
  }

  const separator = pathname.includes('?') ? '&' : '?';
  return `${pathname}${separator}space=${encodeURIComponent(normalizedSpaceId)}`;
}
