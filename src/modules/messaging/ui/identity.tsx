'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
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
  avatarPath?: string | null;
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

function getAvatarSourceKey(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    const queryIndex = value.indexOf('?');
    return queryIndex >= 0 ? value.slice(0, queryIndex) : value;
  }
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

function areIdentityAvatarPropsEqual(
  previous: IdentityAvatarProps,
  next: IdentityAvatarProps,
) {
  return (
    previous.label === next.label &&
    previous.size === next.size &&
    previous.className === next.className &&
    previous.diagnosticsSurface === next.diagnosticsSurface &&
    previous.identity?.userId === next.identity?.userId &&
    previous.identity?.displayName === next.identity?.displayName &&
    previous.identity?.avatarPath === next.identity?.avatarPath
  );
}

function IdentityAvatarBase({
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
  const avatarSourceKey = getAvatarSourceKey(avatarPath);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avatarRenderState, setAvatarRenderState] = useState(() => ({
    hasPermanentImageError: false,
    loadedAvatarPath: null as string | null,
    path: avatarPath,
    sourceKey: avatarSourceKey,
    retryAttempt: 0,
  }));
  const stateMatchesCurrentSourceKey =
    avatarRenderState.sourceKey === avatarSourceKey;
  const retryAttempt =
    stateMatchesCurrentSourceKey ? avatarRenderState.retryAttempt : 0;
  const hasPermanentImageError =
    stateMatchesCurrentSourceKey
      ? avatarRenderState.hasPermanentImageError
      : false;
  const stableAvatarPath =
    stateMatchesCurrentSourceKey &&
    avatarRenderState.loadedAvatarPath &&
    avatarSourceKey
      ? avatarRenderState.loadedAvatarPath
      : avatarPath;
  const effectiveAvatarPath = useMemo(
    () =>
      stableAvatarPath
        ? withAvatarRetryParam(stableAvatarPath, retryAttempt)
        : null,
    [retryAttempt, stableAvatarPath],
  );
  const isImageLoaded = Boolean(
    effectiveAvatarPath &&
      avatarRenderState.sourceKey === avatarSourceKey &&
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
      avatarSourceKey,
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
    avatarSourceKey,
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
              path: stableAvatarPath,
              sourceKey: avatarSourceKey,
            }));

            if (retryAttempt < AVATAR_RETRY_MAX_ATTEMPTS) {
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
              }

              retryTimeoutRef.current = setTimeout(() => {
                setAvatarRenderState((currentState) => ({
                  hasPermanentImageError: false,
                  loadedAvatarPath: null,
                  path: stableAvatarPath,
                  sourceKey: avatarSourceKey,
                  retryAttempt: stateMatchesCurrentSourceKey
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
              path: stableAvatarPath,
              sourceKey: avatarSourceKey,
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
              path: stableAvatarPath,
              sourceKey: avatarSourceKey,
              retryAttempt,
            });
          }}
          src={effectiveAvatarPath ?? undefined}
        />
      ) : null}
    </span>
  );
}

export const IdentityAvatar = memo(
  IdentityAvatarBase,
  areIdentityAvatarPropsEqual,
);

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

function GroupIdentityAvatarBase({
  label,
  avatarPath,
  size = 'md',
  className,
}: GroupIdentityAvatarProps) {
  if (avatarPath) {
    return (
      <IdentityAvatar
        className={className}
        identity={{
          userId: `group:${label}`,
          displayName: label,
          avatarPath,
        }}
        label={label}
        size={size}
      />
    );
  }

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

export const GroupIdentityAvatar = memo(
  GroupIdentityAvatarBase,
  (previous, next) =>
    previous.label === next.label &&
    previous.avatarPath === next.avatarPath &&
    previous.size === next.size &&
    previous.className === next.className,
);
