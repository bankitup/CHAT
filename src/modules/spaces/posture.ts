import {
  normalizeSpaceProfile,
  normalizeSpaceTheme,
  type ResolvedSpaceProfile,
  type ResolvedSpaceTheme,
  type SpaceProfile,
  type SpaceTheme,
} from './model';

/**
 * Shared space-profile compatibility helpers.
 *
 * These helpers normalize persisted profile/theme state and the legacy shared
 * `TEST` space fallback. Product-facing shell defaults live outside the
 * `spaces` foundation.
 */
export const LEGACY_KEEP_COZY_TEST_SPACE_NAME = 'TEST';
export const DEFAULT_NEW_SPACE_PROFILE: SpaceProfile = 'messenger_full';
export const DEFAULT_SPACE_THEME: SpaceTheme = 'dark';

function normalizeStoredSpaceProfile(profile: string | null | undefined) {
  return normalizeSpaceProfile(profile);
}

function normalizeStoredSpaceTheme(theme: string | null | undefined) {
  return normalizeSpaceTheme(theme);
}

export function isLegacyKeepCozyTestSpaceName(
  value: string | null | undefined,
) {
  return value?.trim().toUpperCase() === LEGACY_KEEP_COZY_TEST_SPACE_NAME;
}

/**
 * Shared space profile resolver.
 *
 * Current compatibility rule:
 *
 * - persisted `public.spaces.profile` wins when present
 * - the legacy shared `TEST` space still resolves to `keepcozy_ops`
 * - every other space falls back to `messenger_full`
 *
 * This keeps product posture explicit while isolating it from membership and
 * access resolution code.
 */
export function resolveSpaceProfileForSpace(input: {
  spaceId: string;
  spaceName: string | null;
  storedProfile?: string | null;
}): ResolvedSpaceProfile {
  const storedProfile = normalizeStoredSpaceProfile(input.storedProfile);

  if (storedProfile) {
    return {
      profile: storedProfile,
      source: 'space_profile_column',
    };
  }

  if (isLegacyKeepCozyTestSpaceName(input.spaceName)) {
    return {
      profile: 'keepcozy_ops',
      source: 'space_name_test_default',
    };
  }

  return {
    profile: DEFAULT_NEW_SPACE_PROFILE,
    source: 'fallback_messenger_default',
  };
}

export function resolveSpaceThemeForSpace(input: {
  storedTheme?: string | null;
}): ResolvedSpaceTheme {
  const storedTheme = normalizeStoredSpaceTheme(input.storedTheme);

  if (storedTheme) {
    return {
      source: 'space_theme_column',
      theme: storedTheme,
    };
  }

  return {
    source: 'default_dark',
    theme: DEFAULT_SPACE_THEME,
  };
}
