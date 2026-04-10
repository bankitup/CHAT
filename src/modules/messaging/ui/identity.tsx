'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
export { getIdentityLabel } from './identity-label';

const AVATAR_RETRY_MAX_ATTEMPTS = 2;
const AVATAR_RETRY_DELAY_MS = 900;
const WARMED_AVATAR_SOURCE_KEYS = new Set<string>();

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

function isAvatarRenderStateCurrent(input: {
  avatarPath: string | null;
  avatarSourceKey: string | null;
  state: {
    path: string | null;
    sourceKey: string | null;
  };
}) {
  return (
    input.state.path === input.avatarPath &&
    input.state.sourceKey === input.avatarSourceKey
  );
}

function IdentityAvatarBase({
  identity,
  label,
  size = 'md',
  className,
  diagnosticsSurface,
}: IdentityAvatarProps) {
  const toneClass = useMemo(
    () => getStableTone(identity?.userId || label),
    [identity?.userId, label],
  );
  const initials = useMemo(() => getIdentityInitials(label), [label]);
  const avatarPath = isRenderableAvatarPath(identity?.avatarPath)
    ? (identity?.avatarPath ?? null)
    : null;
  const avatarSourceKey = getAvatarSourceKey(avatarPath);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAvatarPathRef = useRef<string | null>(avatarPath);
  const currentAvatarSourceKeyRef = useRef<string | null>(avatarSourceKey);
  const hasWarmAvatarSource = Boolean(
    avatarPath && avatarSourceKey && WARMED_AVATAR_SOURCE_KEYS.has(avatarSourceKey),
  );
  const [avatarRenderState, setAvatarRenderState] = useState(() => ({
    hasPermanentImageError: false,
    loadedAvatarPath: hasWarmAvatarSource ? avatarPath : null,
    path: avatarPath,
    sourceKey: avatarSourceKey,
    retryAttempt: 0,
  }));
  const stateMatchesCurrentAvatarPath = isAvatarRenderStateCurrent({
    avatarPath,
    avatarSourceKey,
    state: avatarRenderState,
  });
  const resolvedLoadedAvatarPath =
    stateMatchesCurrentAvatarPath && avatarRenderState.loadedAvatarPath
      ? avatarRenderState.loadedAvatarPath
      : hasWarmAvatarSource
        ? avatarPath
        : null;
  const retryAttempt =
    stateMatchesCurrentAvatarPath ? avatarRenderState.retryAttempt : 0;
  const hasPermanentImageError =
    stateMatchesCurrentAvatarPath
      ? avatarRenderState.hasPermanentImageError
      : false;
  const effectiveAvatarPath = useMemo(
    () =>
      avatarPath
        ? withAvatarRetryParam(avatarPath, retryAttempt)
        : null,
    [avatarPath, retryAttempt],
  );
  const isImageLoaded = Boolean(
    effectiveAvatarPath &&
      resolvedLoadedAvatarPath === effectiveAvatarPath,
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
    currentAvatarPathRef.current = avatarPath;
    currentAvatarSourceKeyRef.current = avatarSourceKey;
  }, [avatarPath, avatarSourceKey]);

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
          decoding="async"
          draggable={false}
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
              sourceKey: avatarSourceKey,
            }));

            if (retryAttempt < AVATAR_RETRY_MAX_ATTEMPTS) {
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
              }

              retryTimeoutRef.current = setTimeout(() => {
                const currentAvatarPath = currentAvatarPathRef.current;
                const currentAvatarSourceKey =
                  currentAvatarSourceKeyRef.current;

                setAvatarRenderState((currentState) => ({
                  hasPermanentImageError: false,
                  loadedAvatarPath: null,
                  path: currentAvatarPath,
                  sourceKey: currentAvatarSourceKey,
                  retryAttempt: isAvatarRenderStateCurrent({
                    avatarPath: currentAvatarPath,
                    avatarSourceKey: currentAvatarSourceKey,
                    state: currentState,
                  })
                    ? currentState.retryAttempt + 1
                    : 0,
                }));
                retryTimeoutRef.current = null;
              }, AVATAR_RETRY_DELAY_MS);
              return;
            }

            setAvatarRenderState({
              hasPermanentImageError: true,
              loadedAvatarPath: null,
              path: avatarPath,
              sourceKey: avatarSourceKey,
              retryAttempt,
            });
            if (avatarSourceKey) {
              WARMED_AVATAR_SOURCE_KEYS.delete(avatarSourceKey);
            }
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
            if (avatarSourceKey) {
              WARMED_AVATAR_SOURCE_KEYS.add(avatarSourceKey);
            }
            setAvatarRenderState({
              hasPermanentImageError: false,
              loadedAvatarPath: effectiveAvatarPath,
              path: avatarPath,
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
