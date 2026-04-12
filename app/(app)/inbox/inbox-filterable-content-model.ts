import {
  getInboxClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client';
import { getSearchableConversationPreview } from '@/modules/messaging/e2ee/inbox-policy';
import type {
  InboxPrimaryFilter,
  InboxSectionPreferences,
} from '@/modules/messaging/inbox/preferences';
import type { InboxConversationLiveSummary } from '@/modules/messaging/realtime/inbox-summary-store';
import type { NewChatMode } from './new-chat-sheet';

export type InboxFilter = InboxPrimaryFilter;
export type InboxView = 'archived' | 'main';

export type ConversationListItem = {
  conversationId: string;
  groupAvatarPath: string | null;
  hasUnread: boolean;
  isGroupConversation: boolean;
  latestMessageContentMode: string | null;
  metaLabels: Array<{
    label: string;
    tone: 'default' | 'archived';
  }>;
  participants: Array<{
    avatarPath?: string | null;
    displayName: string | null;
    userId: string;
  }>;
  participantLabels: string[];
  preview: string | null;
  title: string;
};

export type AvailableUserEntry = {
  avatarPath?: string | null;
  displayName: string | null;
  label: string;
  statusEmoji?: string | null;
  statusText?: string | null;
  userId: string;
};

type FilterBucket = {
  hasEncryptedDmSearchLimit: boolean;
  itemsByFilter: Record<InboxFilter, ConversationListItem[]>;
  totalByFilter: Record<InboxFilter, number>;
  unreadByFilter: Record<InboxFilter, number>;
};

export type OrganizedConversationSection = {
  items: ConversationListItem[];
  key: 'all' | 'dm' | 'groups';
  label: string | null;
};

export type InboxRowLabels = {
  audio: string;
  attachment: string;
  deletedMessage: string;
  encryptedMessage: string;
  file: string;
  group: string;
  image: string;
  newMessage: string;
  newEncryptedMessage: string;
  noActivityYet: string;
  unreadAria: string;
  voiceMessage: string;
  yesterday: string;
};

export type InboxFilterableContentProps = {
  activeSpaceId: string;
  activeSpaceName: string | null;
  archivedConversationItems: ConversationListItem[];
  archivedSummaries: InboxConversationLiveSummary[];
  availableDmUserCount: number;
  availableUserCount: number;
  canManageMembers: boolean;
  createOpen: boolean;
  createTargetsLoaded: boolean;
  currentUserId: string;
  initialCreateDmUserEntries: AvailableUserEntry[];
  initialCreateMode: NewChatMode;
  initialCreateUserEntries: AvailableUserEntry[];
  initialFilter: InboxFilter;
  initialView: InboxView;
  isMessengerSpace: boolean;
  language: AppLanguage;
  mainConversationItems: ConversationListItem[];
  mainSummaries: InboxConversationLiveSummary[];
  preferences: InboxSectionPreferences;
  queryValue: string;
  restoreAction: ((formData: FormData) => void | Promise<void>) | null;
  searchScopedAvailableUserCount: number;
};

type BuildInboxHrefInput = {
  create?: boolean;
  createMode?: NewChatMode;
  filter: InboxFilter;
  query?: string;
  spaceId?: string | null;
  view?: InboxView;
};

type InboxClientTranslations = ReturnType<typeof getInboxClientTranslations>;

export function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

export function buildInboxHref({
  create,
  createMode,
  filter,
  query,
  spaceId,
  view,
}: BuildInboxHrefInput) {
  const params = new URLSearchParams();

  if (filter !== 'all') {
    params.set('filter', filter);
  }

  if (query?.trim()) {
    params.set('q', query.trim());
  }

  if (view === 'archived') {
    params.set('view', 'archived');
  }

  if (spaceId?.trim()) {
    params.set('space', spaceId.trim());
  }

  if (create) {
    params.set('create', 'open');

    if (createMode) {
      params.set('createMode', createMode);
    }
  }

  const href = params.toString();
  return href ? `/inbox?${href}` : '/inbox';
}

export function buildVisibleSummariesByConversationId(
  summaries: InboxConversationLiveSummary[],
) {
  return new Map(
    summaries.map((summary) => [summary.conversationId, summary] as const),
  );
}

export function buildFilterBucket(input: {
  items: ConversationListItem[];
  searchTerm: string;
  t: InboxClientTranslations;
}) {
  const itemsByFilter: Record<InboxFilter, ConversationListItem[]> = {
    all: [],
    dm: [],
    groups: [],
  };
  const totalByFilter: Record<InboxFilter, number> = {
    all: 0,
    dm: 0,
    groups: 0,
  };
  const unreadByFilter: Record<InboxFilter, number> = {
    all: 0,
    dm: 0,
    groups: 0,
  };
  let hasEncryptedDmSearchLimit = false;

  for (const item of input.items) {
    if (input.searchTerm) {
      const searchablePreview = getSearchableConversationPreview({
        latestMessageContentMode: item.latestMessageContentMode,
        preview: item.preview,
      });
      const haystack = [
        item.title,
        searchablePreview,
        ...item.participantLabels,
        item.isGroupConversation ? input.t.inbox.metaGroup : input.t.chat.directChat,
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(input.searchTerm)) {
        continue;
      }
    }

    itemsByFilter.all.push(item);
    totalByFilter.all += 1;

    if (item.hasUnread) {
      unreadByFilter.all += 1;
    }

    if (item.isGroupConversation) {
      itemsByFilter.groups.push(item);
      totalByFilter.groups += 1;

      if (item.hasUnread) {
        unreadByFilter.groups += 1;
      }
    } else {
      itemsByFilter.dm.push(item);
      totalByFilter.dm += 1;

      if (item.hasUnread) {
        unreadByFilter.dm += 1;
      }

      if (input.searchTerm && item.latestMessageContentMode === 'dm_e2ee_v1') {
        hasEncryptedDmSearchLimit = true;
      }
    }
  }

  return {
    hasEncryptedDmSearchLimit,
    itemsByFilter,
    totalByFilter,
    unreadByFilter,
  } satisfies FilterBucket;
}

function partitionConversationItemsByKind(items: ConversationListItem[]) {
  const directMessages: ConversationListItem[] = [];
  const groups: ConversationListItem[] = [];

  for (const item of items) {
    if (item.isGroupConversation) {
      groups.push(item);
      continue;
    }

    directMessages.push(item);
  }

  return {
    directMessages,
    groups,
  };
}

export function buildOrganizedConversationSectionsByFilter(input: {
  buckets: FilterBucket;
  preferences: Pick<
    InboxSectionPreferences,
    'showGroupsSeparately' | 'showPersonalChatsFirst'
  >;
  t: InboxClientTranslations;
}) {
  const sectionsByFilter: Record<InboxFilter, OrganizedConversationSection[]> = {
    all: [],
    dm: [],
    groups: [],
  };

  for (const filter of ['all', 'dm', 'groups'] as const) {
    const filteredConversationItems = input.buckets.itemsByFilter[filter];
    const shouldGroupByKind =
      input.preferences.showGroupsSeparately && filter === 'all';
    const partitionedItems = partitionConversationItemsByKind(
      filteredConversationItems,
    );

    if (!shouldGroupByKind) {
      const orderedItems =
        input.preferences.showPersonalChatsFirst && filter === 'all'
          ? [...partitionedItems.directMessages, ...partitionedItems.groups]
          : filteredConversationItems;

      sectionsByFilter[filter] = [
        {
          items: orderedItems,
          key: 'all',
          label: null,
        },
      ];
      continue;
    }

    const orderedSections: OrganizedConversationSection[] =
      input.preferences.showPersonalChatsFirst
        ? [
            {
              items: partitionedItems.directMessages,
              key: 'dm',
              label: input.t.inbox.filters.dm,
            },
            {
              items: partitionedItems.groups,
              key: 'groups',
              label: input.t.inbox.filters.groups,
            },
          ]
        : [
            {
              items: partitionedItems.groups,
              key: 'groups',
              label: input.t.inbox.filters.groups,
            },
            {
              items: partitionedItems.directMessages,
              key: 'dm',
              label: input.t.inbox.filters.dm,
            },
          ];

    sectionsByFilter[filter] = orderedSections.filter(
      (section) => section.items.length > 0,
    );
  }

  return sectionsByFilter;
}
