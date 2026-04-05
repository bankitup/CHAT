'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
export { getIdentityLabel } from './identity-label';

const AVATAR_RETRY_MAX_ATTEMPTS = 2;
const AVATAR_RETRY_DELAY_MS = 900;

type IdentityRecord = {
  userId: string;
  displayName: string | null;
  avatarPath?: string | null;
};

type IdentityAvatarProps = {
  identity?: IdentityRecord | null;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  diagnosticsSurface?: string;
};

type IdentityAvatarStackProps = {
  identities: Array<IdentityRecord | null | undefined>;
  labels: string[];
  maxVisible?: number;
};

type GroupIdentityAvatarProps = {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

function normalizeClassName(values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

function getStableTone(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 7;
  }

  return `identity-avatar-tone-${hash}`;
}

function isRenderableAvatarPath(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return (
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('/')
  );
}

function withAvatarRetryParam(value: string, attempt: number) {
  if (attempt <= 0) {
    return value;
  }

  try {
    const nextUrl = new URL(value);
    nextUrl.searchParams.set('avatar_retry', String(attempt));
    return nextUrl.toString();
  } catch {
    const separator = value.includes('?') ? '&' : '?';
    return `${value}${separator}avatar_retry=${attempt}`;
  }
}

export function getIdentityInitials(label: string) {
  const words = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return '?';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words.map((word) => word[0]?.toUpperCase() ?? '').join('');
}

export function IdentityAvatar({
  identity,
  label,
  size = 'md',
  className,
  diagnosticsSurface,
}: IdentityAvatarProps) {
  const toneClass = getStableTone(identity?.userId || label);
  const initials = getIdentityInitials(label);
  const avatarPath = isRenderableAvatarPath(identity?.avatarPath)
    ? (identity?.avatarPath ?? null)
    : null;
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avatarRenderState, setAvatarRenderState] = useState(() => ({
    hasPermanentImageError: false,
    loadedAvatarPath: null as string | null,
    path: avatarPath,
    retryAttempt: 0,
  }));
  const retryAttempt =
    avatarRenderState.path === avatarPath ? avatarRenderState.retryAttempt : 0;
  const hasPermanentImageError =
    avatarRenderState.path === avatarPath
      ? avatarRenderState.hasPermanentImageError
      : false;
  const effectiveAvatarPath = useMemo(
    () => (avatarPath ? withAvatarRetryParam(avatarPath, retryAttempt) : null),
    [avatarPath, retryAttempt],
  );
  const isImageLoaded = Boolean(
    effectiveAvatarPath &&
      avatarRenderState.path === avatarPath &&
      avatarRenderState.loadedAvatarPath === effectiveAvatarPath,
  );
  const shouldRenderImage = Boolean(avatarPath && !hasPermanentImageError);
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_AVATARS === '1';

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return;
    }

    console.info('[avatar-render]', {
      stage: 'identity-avatar:resolved',
      surface: diagnosticsSurface ?? 'unknown',
      userId: identity?.userId ?? null,
      label,
      hasAvatarUrl: Boolean(avatarPath),
      avatarUrl: effectiveAvatarPath,
      retryAttempt,
      fallingBackToInitials: !avatarPath || hasPermanentImageError,
      imageLoaded: isImageLoaded,
    });
  }, [
    avatarPath,
    diagnosticsEnabled,
    diagnosticsSurface,
    effectiveAvatarPath,
    hasPermanentImageError,
    identity?.userId,
    isImageLoaded,
    label,
    retryAttempt,
  ]);

  return (
    <span
      aria-hidden="true"
      className={normalizeClassName([
        'identity-avatar',
        `identity-avatar-${size}`,
        toneClass,
        className,
      ])}
    >
      <span
        className={
          isImageLoaded
            ? 'identity-avatar-initials identity-avatar-initials-hidden'
            : 'identity-avatar-initials'
        }
      >
        {initials}
      </span>
      {shouldRenderImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className={
            isImageLoaded
              ? 'identity-avatar-image identity-avatar-image-ready'
              : 'identity-avatar-image'
          }
          loading="lazy"
          onError={() => {
            if (diagnosticsEnabled) {
              console.info('[avatar-render]', {
                stage: 'identity-avatar:image-error',
                surface: diagnosticsSurface ?? 'unknown',
                userId: identity?.userId ?? null,
                label,
                avatarUrl: effectiveAvatarPath,
                retryAttempt,
              });
            }
            setAvatarRenderState((currentState) => ({
              ...currentState,
              loadedAvatarPath: null,
              path: avatarPath,
            }));

            if (retryAttempt < AVATAR_RETRY_MAX_ATTEMPTS) {
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
              }

              retryTimeoutRef.current = setTimeout(() => {
                setAvatarRenderState((currentState) => ({
                  hasPermanentImageError: false,
                  loadedAvatarPath: null,
                  path: avatarPath,
                  retryAttempt:
                    currentState.path === avatarPath
                      ? currentState.retryAttempt + 1
                      : 1,
                }));
                retryTimeoutRef.current = null;
              }, AVATAR_RETRY_DELAY_MS);
              return;
            }

            setAvatarRenderState({
              hasPermanentImageError: true,
              loadedAvatarPath: null,
              path: avatarPath,
              retryAttempt,
            });
          }}
          onLoad={() => {
            if (diagnosticsEnabled) {
              console.info('[avatar-render]', {
                stage: 'identity-avatar:image-loaded',
                surface: diagnosticsSurface ?? 'unknown',
                userId: identity?.userId ?? null,
                label,
                avatarUrl: effectiveAvatarPath,
                retryAttempt,
              });
            }
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
              retryTimeoutRef.current = null;
            }
            setAvatarRenderState({
              hasPermanentImageError: false,
              loadedAvatarPath: effectiveAvatarPath,
              path: avatarPath,
              retryAttempt,
            });
          }}
          src={effectiveAvatarPath ?? undefined}
        />
      ) : null}
    </span>
  );
}

export function IdentityAvatarStack({
  identities,
  labels,
  maxVisible = 2,
}: IdentityAvatarStackProps) {
  const visibleItems = identities.slice(0, maxVisible);
  const visibleLabels = labels.slice(0, maxVisible);

  return (
    <div aria-hidden="true" className="identity-avatar-stack">
      {visibleItems.map((identity, index) => (
        <IdentityAvatar
          key={`${identity?.userId ?? visibleLabels[index] ?? index}`}
          className="identity-avatar-stack-item"
          identity={identity}
          label={visibleLabels[index] ?? `Person ${index + 1}`}
          size="sm"
        />
      ))}
    </div>
  );
}

export function GroupIdentityAvatar({
  label,
  size = 'md',
  className,
}: GroupIdentityAvatarProps) {
  const toneClass = getStableTone(`group:${label}`);
  const initials = getIdentityInitials(label);

  return (
    <span
      aria-hidden="true"
      className={normalizeClassName([
        'identity-avatar',
        'identity-avatar-group',
        `identity-avatar-${size}`,
        toneClass,
        className,
      ])}
    >
      <span className="identity-avatar-initials">{initials}</span>
      <span className="identity-avatar-group-badge">G</span>
    </span>
  );
}
