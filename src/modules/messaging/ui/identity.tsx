'use client';

import { useState } from 'react';
export { getIdentityLabel } from './identity-label';

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
}: IdentityAvatarProps) {
  const toneClass = getStableTone(identity?.userId || label);
  const initials = getIdentityInitials(label);
  const avatarPath = isRenderableAvatarPath(identity?.avatarPath)
    ? (identity?.avatarPath ?? null)
    : null;
  const [failedAvatarPath, setFailedAvatarPath] = useState<string | null>(null);
  const [loadedAvatarPath, setLoadedAvatarPath] = useState<string | null>(null);
  const hasImageError = Boolean(avatarPath && failedAvatarPath === avatarPath);
  const isImageLoaded = Boolean(avatarPath && loadedAvatarPath === avatarPath);
  const shouldRenderImage = Boolean(avatarPath && !hasImageError);

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
            setFailedAvatarPath(avatarPath);
            setLoadedAvatarPath(null);
          }}
          onLoad={() => {
            setLoadedAvatarPath(avatarPath);
          }}
          src={avatarPath ?? undefined}
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
