export const INBOX_SECTION_PREFERENCES_COOKIE = 'chat_inbox_preferences_v1';

export const INBOX_PRIMARY_FILTERS = ['all', 'dm', 'groups'] as const;

export type InboxPrimaryFilter = (typeof INBOX_PRIMARY_FILTERS)[number];
export type InboxListDensity = 'comfortable' | 'compact';
export type InboxPreviewDisplayMode = 'show' | 'mask' | 'reveal_after_open';

export type InboxSectionPreferences = {
  defaultFilter: InboxPrimaryFilter;
  density: InboxListDensity;
  previewMode: InboxPreviewDisplayMode;
  showGroupsSeparately: boolean;
  showPersonalChatsFirst: boolean;
  visibleFilters: InboxPrimaryFilter[];
};

type InboxSectionPreferencesInput = Partial<
  Omit<InboxSectionPreferences, 'defaultFilter' | 'density' | 'visibleFilters'>
> & {
  defaultFilter?: string | null;
  density?: string | null;
  previewMode?: string | null;
  visibleFilters?: Array<string | null | undefined> | null;
};

export const DEFAULT_INBOX_SECTION_PREFERENCES: InboxSectionPreferences = {
  defaultFilter: 'all',
  density: 'comfortable',
  previewMode: 'show',
  showGroupsSeparately: false,
  showPersonalChatsFirst: false,
  visibleFilters: ['all', 'dm', 'groups'],
};

function isInboxPrimaryFilter(value: string): value is InboxPrimaryFilter {
  return (INBOX_PRIMARY_FILTERS as readonly string[]).includes(value);
}

export function normalizeInboxVisibleFilters(
  value: Array<string | null | undefined> | null | undefined,
) {
  const normalized = Array.from(
    new Set(
      (value ?? [])
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(isInboxPrimaryFilter),
    ),
  );

  if (normalized.length === 0) {
    return [...DEFAULT_INBOX_SECTION_PREFERENCES.visibleFilters];
  }

  return normalized;
}

export function normalizeInboxDefaultFilter(
  value: string | null | undefined,
  visibleFilters: InboxPrimaryFilter[],
) {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (isInboxPrimaryFilter(trimmed) && visibleFilters.includes(trimmed)) {
    return trimmed;
  }

  return visibleFilters[0] ?? DEFAULT_INBOX_SECTION_PREFERENCES.defaultFilter;
}

export function normalizeInboxListDensity(
  value: string | null | undefined,
): InboxListDensity {
  return value === 'compact' ? 'compact' : 'comfortable';
}

export function normalizeInboxPreviewDisplayMode(
  value: string | null | undefined,
): InboxPreviewDisplayMode {
  if (value === 'mask') {
    return 'mask';
  }

  if (value === 'reveal_after_open') {
    return 'reveal_after_open';
  }

  return 'show';
}

export function normalizeInboxSectionPreferences(
  input?: InboxSectionPreferencesInput | null,
): InboxSectionPreferences {
  const visibleFilters = normalizeInboxVisibleFilters(input?.visibleFilters);

  return {
    defaultFilter: normalizeInboxDefaultFilter(input?.defaultFilter, visibleFilters),
    density: normalizeInboxListDensity(input?.density),
    previewMode: normalizeInboxPreviewDisplayMode(input?.previewMode),
    showGroupsSeparately: input?.showGroupsSeparately === true,
    showPersonalChatsFirst: input?.showPersonalChatsFirst === true,
    visibleFilters,
  };
}

export function parseInboxSectionPreferencesCookie(
  value: string | null | undefined,
) {
  if (!value?.trim()) {
    return DEFAULT_INBOX_SECTION_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(value) as Partial<InboxSectionPreferences> | null;
    return normalizeInboxSectionPreferences(parsed);
  } catch {
    return DEFAULT_INBOX_SECTION_PREFERENCES;
  }
}

export function serializeInboxSectionPreferences(
  value: InboxSectionPreferences,
) {
  return JSON.stringify(normalizeInboxSectionPreferences(value));
}

export function resolveInboxInitialFilter(
  requestedFilter: string | null | undefined,
  preferences: InboxSectionPreferences,
) {
  return normalizeInboxDefaultFilter(requestedFilter, preferences.visibleFilters);
}
