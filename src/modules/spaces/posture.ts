import { withSpaceParam } from './url';
import {
  getDefaultShellRouteForSpaceProfile,
  normalizeSpaceProfile,
  normalizeSpaceTheme,
  type ResolvedSpaceProfile,
  type ResolvedSpaceTheme,
  type SpaceProfile,
  type SpaceTheme,
} from './model';

/**
 * Shared platform posture helpers for `spaces`.
 *
 * These helpers keep current runtime profile/theme compatibility in one place
 * without pushing Messenger or KeepCozy shell policy into membership and
 * access-loading code.
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
 * Platform-level space posture resolver.
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
      defaultShellRoute: getDefaultShellRouteForSpaceProfile(storedProfile),
    };
  }

  if (isLegacyKeepCozyTestSpaceName(input.spaceName)) {
    return {
      profile: 'keepcozy_ops',
      source: 'space_name_test_default',
      defaultShellRoute: getDefaultShellRouteForSpaceProfile('keepcozy_ops'),
    };
  }

  return {
    profile: DEFAULT_NEW_SPACE_PROFILE,
    source: 'fallback_messenger_default',
    defaultShellRoute: getDefaultShellRouteForSpaceProfile(
      DEFAULT_NEW_SPACE_PROFILE,
    ),
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

export function resolveSpaceProfileShellHref(input: {
  profile: SpaceProfile;
  spaceId: string;
}) {
  return withSpaceParam(
    getDefaultShellRouteForSpaceProfile(input.profile),
    input.spaceId,
  );
}
