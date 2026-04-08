'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type TouchEvent,
} from 'react';
import {
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import {
  getInboxDisplayPreviewText,
  getSearchableConversationPreview,
} from '@/modules/messaging/e2ee/inbox-policy';
import {
  getInboxConversationSummarySnapshot,
  getInboxSummaryRevisionSnapshot,
  subscribeToInboxSummaryRevision,
  type InboxConversationLiveSummary,
} from '@/modules/messaging/realtime/inbox-summary-store';
import { requestInboxManualRefresh } from '@/modules/messaging/realtime/inbox-manual-refresh';
import {
  resolveInboxInitialFilter,
  type InboxPreviewDisplayMode,
  type InboxPrimaryFilter,
  type InboxSectionPreferences,
} from '@/modules/messaging/inbox/preferences';
import { InboxConversationLiveRow } from './inbox-conversation-live-row';
import { NewChatSheet, type NewChatMode } from './new-chat-sheet';

type InboxFilter = InboxPrimaryFilter;
type InboxView = 'main' | 'archived';

type ConversationListItem = {
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

type AvailableUserEntry = {
  avatarPath?: string | null;
  displayName: string | null;
  label: string;
  userId: string;
};

type FilterBucket = {
  hasEncryptedDmSearchLimit: boolean;
  itemsByFilter: Record<InboxFilter, ConversationListItem[]>;
  totalByFilter: Record<InboxFilter, number>;
  unreadByFilter: Record<InboxFilter, number>;
};

type OrganizedConversationSection = {
  items: ConversationListItem[];
  key: 'all' | 'dm' | 'groups';
  label: string | null;
};

type InboxPresentationLabels = {
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

type DerivedConversationSummarySnapshot = Pick<
  InboxConversationLiveSummary,
  | 'conversationId'
  | 'createdAt'
  | 'hiddenAt'
  | 'lastMessageAt'
  | 'latestMessageAttachmentKind'
  | 'latestMessageBody'
  | 'latestMessageContentMode'
  | 'latestMessageDeletedAt'
  | 'latestMessageKind'
  | 'removed'
  | 'unreadCount'
>;

type DerivedConversationCacheEntry = {
  baseItem: ConversationListItem;
  derivedItem: ConversationListItem | null;
  summary: DerivedConversationSummarySnapshot;
};

const EMPTY_LIVE_SUMMARY: InboxConversationLiveSummary = {
  conversationId: '',
  createdAt: null,
  hiddenAt: null,
  lastMessageAt: null,
  lastReadAt: null,
  lastReadMessageSeq: null,
  latestMessageAttachmentKind: null,
  latestMessageBody: null,
  latestMessageContentMode: null,
  latestMessageDeletedAt: null,
  latestMessageId: null,
  latestMessageKind: null,
  latestMessageSenderId: null,
  latestMessageSeq: null,
  unreadCount: 0,
};

type InboxFilterableContentProps = {
  activeSpaceId: string;
  activeSpaceName: string | null;
  availableDmUserEntries: AvailableUserEntry[];
  availableUserEntries: AvailableUserEntry[];
  canManageMembers: boolean;
  createOpen: boolean;
  initialCreateMode: NewChatMode;
  isMessengerSpace: boolean;
  currentUserId: string;
  initialFilter: InboxFilter;
  initialView: InboxView;
  language: AppLanguage;
  mainConversationItems: ConversationListItem[];
  mainSummaries: InboxConversationLiveSummary[];
  preferences: InboxSectionPreferences;
  queryValue: string;
  restoreAction: ((formData: FormData) => void | Promise<void>) | null;
  archivedConversationItems: ConversationListItem[];
  archivedSummaries: InboxConversationLiveSummary[];
};

const INBOX_PULL_REFRESH_MAX_OFFSET = 92;
const INBOX_PULL_REFRESH_HOLD_OFFSET = 58;
const INBOX_PULL_REFRESH_THRESHOLD = 72;

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

function buildInboxHref({
  create,
  createMode,
  filter,
  query,
  spaceId,
  view,
}: {
  create?: boolean;
  createMode?: NewChatMode;
  filter: InboxFilter;
  query?: string;
  spaceId?: string | null;
  view?: InboxView;
}) {
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

function buildFilterBucket(input: {
  items: ConversationListItem[];
  searchTerm: string;
  t: ReturnType<typeof getTranslations>;
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

function getDerivedConversationSummarySnapshot(
  conversationId: string,
  liveSummariesByConversationId: Map<string, InboxConversationLiveSummary>,
) {
  const liveSummary =
    liveSummariesByConversationId.get(conversationId) ?? EMPTY_LIVE_SUMMARY;

  return {
    conversationId,
    createdAt: liveSummary.createdAt,
    hiddenAt: liveSummary.hiddenAt,
    lastMessageAt: liveSummary.lastMessageAt,
    latestMessageAttachmentKind: liveSummary.latestMessageAttachmentKind,
    latestMessageBody: liveSummary.latestMessageBody,
    latestMessageContentMode: liveSummary.latestMessageContentMode,
    latestMessageDeletedAt: liveSummary.latestMessageDeletedAt,
    latestMessageKind: liveSummary.latestMessageKind,
    removed: liveSummary.removed,
    unreadCount: liveSummary.unreadCount,
  } satisfies DerivedConversationSummarySnapshot;
}

function areDerivedConversationSummariesEqual(
  left: DerivedConversationSummarySnapshot | null,
  right: DerivedConversationSummarySnapshot | null,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.conversationId === right.conversationId &&
    left.createdAt === right.createdAt &&
    left.hiddenAt === right.hiddenAt &&
    left.lastMessageAt === right.lastMessageAt &&
    left.latestMessageAttachmentKind === right.latestMessageAttachmentKind &&
    left.latestMessageBody === right.latestMessageBody &&
    left.latestMessageContentMode === right.latestMessageContentMode &&
    left.latestMessageDeletedAt === right.latestMessageDeletedAt &&
    left.latestMessageKind === right.latestMessageKind &&
    left.removed === right.removed &&
    left.unreadCount === right.unreadCount
  );
}

function deriveConversationItemFromLiveState(input: {
  item: ConversationListItem;
  labels: InboxPresentationLabels;
  previewMode: InboxPreviewDisplayMode;
  summary: DerivedConversationSummarySnapshot;
  visibility: InboxView;
}) {
  if (input.summary.removed) {
    return null;
  }

  const isHidden = Boolean(input.summary.hiddenAt);

  if (input.visibility === 'main' ? isHidden : !isHidden) {
    return null;
  }

  return {
    ...input.item,
    hasUnread: input.summary.unreadCount > 0,
    latestMessageContentMode: input.summary.latestMessageContentMode,
    preview: getInboxDisplayPreviewText(
      {
        lastMessageAt: input.summary.lastMessageAt,
        latestMessageAttachmentKind: input.summary.latestMessageAttachmentKind,
        latestMessageBody: input.summary.latestMessageBody,
        latestMessageContentMode: input.summary.latestMessageContentMode,
        latestMessageDeletedAt: input.summary.latestMessageDeletedAt,
        latestMessageKind: input.summary.latestMessageKind,
        unreadCount: input.summary.unreadCount,
      },
      {
        audio: input.labels.audio,
        attachment: input.labels.attachment,
        deletedMessage: input.labels.deletedMessage,
        encryptedMessage: input.labels.encryptedMessage,
        file: input.labels.file,
        image: input.labels.image,
        newMessage: input.labels.newMessage,
        newEncryptedMessage: input.labels.newEncryptedMessage,
        voiceMessage: input.labels.voiceMessage,
      },
      input.previewMode,
    ),
  } satisfies ConversationListItem;
}

function createDerivedConversationItemsMemoizer() {
  let previousItemsRef: ConversationListItem[] | null = null;
  let previousLabelsRef: InboxPresentationLabels | null = null;
  let previousResult: ConversationListItem[] = [];
  let previousCacheByConversationId = new Map<string, DerivedConversationCacheEntry>();

  return (input: {
    items: ConversationListItem[];
    labels: InboxPresentationLabels;
    liveSummariesByConversationId: Map<string, InboxConversationLiveSummary>;
    previewMode: InboxPreviewDisplayMode;
    visibility: InboxView;
  }) => {
    const nextCache = new Map<string, DerivedConversationCacheEntry>();
    const nextItems: ConversationListItem[] = [];
    let changed =
      previousItemsRef !== input.items || previousLabelsRef !== input.labels;

    for (const item of input.items) {
      const summary = getDerivedConversationSummarySnapshot(
        item.conversationId,
        input.liveSummariesByConversationId,
      );
      const previousEntry = previousCacheByConversationId.get(item.conversationId);
      const derivedItem =
        previousEntry &&
        previousEntry.baseItem === item &&
        areDerivedConversationSummariesEqual(previousEntry.summary, summary)
          ? previousEntry.derivedItem
          : deriveConversationItemFromLiveState({
        item,
        labels: input.labels,
        previewMode: input.previewMode,
        summary,
        visibility: input.visibility,
      });

      if (previousEntry?.derivedItem !== derivedItem) {
        changed = true;
      }

      nextCache.set(item.conversationId, {
        baseItem: item,
        derivedItem,
        summary,
      });

      if (derivedItem) {
        nextItems.push(derivedItem);
      }
    }

    if (!changed && nextItems.length === previousResult.length) {
      const isSameOrder = nextItems.every(
        (item, index) => item === previousResult[index],
      );

      if (isSameOrder) {
        previousCacheByConversationId = nextCache;
        return previousResult;
      }
    }

    previousItemsRef = input.items;
    previousLabelsRef = input.labels;
    previousCacheByConversationId = nextCache;
    previousResult = nextItems;
    return nextItems;
  };
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

function buildOrganizedConversationSectionsByFilter(input: {
  buckets: FilterBucket;
  preferences: Pick<
    InboxSectionPreferences,
    'showGroupsSeparately' | 'showPersonalChatsFirst'
  >;
  t: ReturnType<typeof getTranslations>;
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

export function InboxFilterableContent({
  activeSpaceId,
  activeSpaceName,
  archivedConversationItems,
  archivedSummaries,
  availableDmUserEntries,
  availableUserEntries,
  canManageMembers,
  createOpen,
  initialCreateMode,
  isMessengerSpace,
  currentUserId,
  initialFilter,
  initialView,
  language,
  mainConversationItems,
  mainSummaries,
  preferences,
  queryValue,
  restoreAction,
}: InboxFilterableContentProps) {
  const t = useMemo(() => getTranslations(language), [language]);
  const deriveMainConversationItemsMemoized = useMemo(
    () => createDerivedConversationItemsMemoizer(),
    [],
  );
  const deriveArchivedConversationItemsMemoized = useMemo(
    () => createDerivedConversationItemsMemoizer(),
    [],
  );
  const searchTerm = normalizeSearchTerm(queryValue);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>(initialFilter);
  const [activeView, setActiveView] = useState<InboxView>(initialView);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(createOpen);
  const [createSheetMode, setCreateSheetMode] =
    useState<NewChatMode>(initialCreateMode);
  const [pullRefreshOffset, setPullRefreshOffset] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const touchGestureRef = useRef<{
    pointerX: number;
    pointerY: number;
    dragging: boolean;
  } | null>(null);
  const visibleFilters = useMemo(
    () => preferences.visibleFilters,
    [preferences.visibleFilters],
  );
  const resolvedInitialFilter = useMemo(
    () => resolveInboxInitialFilter(initialFilter, preferences),
    [initialFilter, preferences],
  );

  useEffect(() => {
    setActiveFilter(resolvedInitialFilter);
  }, [resolvedInitialFilter]);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    setIsCreateSheetOpen(createOpen);
  }, [createOpen]);

  useEffect(() => {
    setCreateSheetMode(initialCreateMode);
  }, [initialCreateMode]);

  const getInboxScrollTop = () => {
    if (typeof window === 'undefined') {
      return 0;
    }

    return Math.max(
      window.scrollY,
      document.scrollingElement?.scrollTop ?? 0,
      document.documentElement?.scrollTop ?? 0,
      0,
    );
  };

  const resetPullRefreshGesture = () => {
    touchGestureRef.current = null;
    setPullRefreshOffset(0);
  };

  const handlePullRefreshStart = (event: TouchEvent<HTMLDivElement>) => {
    if (
      isCreateSheetOpen ||
      isPullRefreshing ||
      event.touches.length !== 1 ||
      getInboxScrollTop() > 0
    ) {
      touchGestureRef.current = null;
      return;
    }

    const touch = event.touches[0];
    touchGestureRef.current = {
      dragging: false,
      pointerX: touch.clientX,
      pointerY: touch.clientY,
    };
  };

  const handlePullRefreshMove = (event: TouchEvent<HTMLDivElement>) => {
    const gesture = touchGestureRef.current;

    if (!gesture || isCreateSheetOpen || isPullRefreshing || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - gesture.pointerX;
    const deltaY = touch.clientY - gesture.pointerY;

    if (deltaY <= 0) {
      if (!gesture.dragging) {
        touchGestureRef.current = null;
      }
      return;
    }

    if (Math.abs(deltaX) > deltaY * 0.8) {
      return;
    }

    if (getInboxScrollTop() > 0) {
      resetPullRefreshGesture();
      return;
    }

    const resistedOffset = Math.min(
      INBOX_PULL_REFRESH_MAX_OFFSET,
      Math.round(Math.pow(deltaY, 0.92) * 0.52),
    );

    gesture.dragging = true;
    event.preventDefault();
    setPullRefreshOffset(resistedOffset);
  };

  const handlePullRefreshEnd = async () => {
    const shouldRefresh =
      touchGestureRef.current?.dragging &&
      pullRefreshOffset >= INBOX_PULL_REFRESH_THRESHOLD;

    touchGestureRef.current = null;

    if (!shouldRefresh || isCreateSheetOpen || isPullRefreshing) {
      setPullRefreshOffset(0);
      return;
    }

    setIsPullRefreshing(true);
    setPullRefreshOffset(INBOX_PULL_REFRESH_HOLD_OFFSET);

    try {
      await requestInboxManualRefresh();
    } finally {
      setIsPullRefreshing(false);
      setPullRefreshOffset(0);
    }
  };

  useEffect(() => {
    const resolvedFilter = resolveInboxInitialFilter(activeFilter, preferences);

    if (resolvedFilter !== activeFilter) {
      setActiveFilter(resolvedFilter);
    }
  }, [activeFilter, preferences]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextHref = buildInboxHref({
      create: isCreateSheetOpen,
      createMode: isCreateSheetOpen ? createSheetMode : undefined,
      filter: activeFilter,
      query: queryValue,
      spaceId: activeSpaceId,
      view: activeView,
    });

    if (window.location.pathname + window.location.search === nextHref) {
      return;
    }

    window.history.replaceState(window.history.state, '', nextHref);
  }, [
    activeFilter,
    activeSpaceId,
    activeView,
    createSheetMode,
    isCreateSheetOpen,
    queryValue,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined' || !isCreateSheetOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isCreateSheetOpen]);

  useEffect(() => {
    if (!isCreateSheetOpen || typeof window === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCreateSheetOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateSheetOpen]);

  const availableDmUserEntriesFiltered = useMemo(
    () =>
      availableDmUserEntries.filter((availableUser) => {
        if (!searchTerm) {
          return true;
        }

        return availableUser.label.toLowerCase().includes(searchTerm);
      }),
    [availableDmUserEntries, searchTerm],
  );

  const availableUserEntriesFiltered = useMemo(
    () =>
      availableUserEntries.filter((availableUser) => {
        if (!searchTerm) {
          return true;
        }

        return availableUser.label.toLowerCase().includes(searchTerm);
      }),
    [availableUserEntries, searchTerm],
  );
  const allSummaries = useMemo(
    () => [...mainSummaries, ...archivedSummaries],
    [archivedSummaries, mainSummaries],
  );
  const summariesByConversationId = useMemo(
    () =>
      new Map(
        allSummaries.map((summary) => [summary.conversationId, summary] as const),
      ),
    [allSummaries],
  );
  const inboxSummaryRevision = useSyncExternalStore(
    subscribeToInboxSummaryRevision,
    getInboxSummaryRevisionSnapshot,
    getInboxSummaryRevisionSnapshot,
  );
  const rowLabels = useMemo(
    () => ({
      audio: t.chat.audio,
      attachment: t.chat.attachment,
      deletedMessage: t.chat.deletedMessage,
      encryptedMessage: t.chat.encryptedMessage,
      file: t.chat.file,
      group: t.inbox.metaGroup,
      image: t.chat.image,
      newMessage: t.chat.newMessage,
      newEncryptedMessage: t.chat.newEncryptedMessage,
      noActivityYet: t.inbox.noActivityYet,
      unreadAria: t.inbox.unreadAria,
      voiceMessage: t.chat.voiceMessage,
      yesterday: t.inbox.yesterday,
    }),
    [t],
  );
  const liveSummariesByConversationId = useMemo(() => {
    // Tie this snapshot map to store revision changes without forcing unrelated
    // filter-state switches to rebuild it.
    void inboxSummaryRevision;
    const nextMap = new Map<string, InboxConversationLiveSummary>();

    for (const [conversationId, fallbackSummary] of summariesByConversationId) {
      nextMap.set(
        conversationId,
        getInboxConversationSummarySnapshot(conversationId, fallbackSummary),
      );
    }

    return nextMap;
  }, [inboxSummaryRevision, summariesByConversationId]);
  const derivedMainConversationItems = useMemo(
    () =>
      deriveMainConversationItemsMemoized({
        items: mainConversationItems,
        labels: rowLabels,
        liveSummariesByConversationId,
        previewMode: preferences.previewMode,
        visibility: 'main',
      }),
    [
      deriveMainConversationItemsMemoized,
      liveSummariesByConversationId,
      mainConversationItems,
      preferences.previewMode,
      rowLabels,
    ],
  );
  const derivedArchivedConversationItems = useMemo(
    () =>
      deriveArchivedConversationItemsMemoized({
        items: archivedConversationItems,
        labels: rowLabels,
        liveSummariesByConversationId,
        previewMode: preferences.previewMode,
        visibility: 'archived',
      }),
    [
      archivedConversationItems,
      deriveArchivedConversationItemsMemoized,
      liveSummariesByConversationId,
      preferences.previewMode,
      rowLabels,
    ],
  );
  const mainBuckets = useMemo(
    () =>
      buildFilterBucket({
        items: derivedMainConversationItems,
        searchTerm,
        t,
      }),
    [derivedMainConversationItems, searchTerm, t],
  );
  const archivedBuckets = useMemo(
    () =>
      buildFilterBucket({
        items: derivedArchivedConversationItems,
        searchTerm,
        t,
      }),
    [derivedArchivedConversationItems, searchTerm, t],
  );
  const activeBuckets = activeView === 'archived' ? archivedBuckets : mainBuckets;
  const organizedConversationSectionsByFilter = useMemo(
    () =>
      buildOrganizedConversationSectionsByFilter({
        buckets: activeBuckets,
        preferences: {
          showGroupsSeparately: preferences.showGroupsSeparately,
          showPersonalChatsFirst: preferences.showPersonalChatsFirst,
        },
        t,
      }),
    [
      activeBuckets,
      preferences.showGroupsSeparately,
      preferences.showPersonalChatsFirst,
      t,
    ],
  );
  const filteredConversationItems = activeBuckets.itemsByFilter[activeFilter];
  const organizedConversationSections =
    organizedConversationSectionsByFilter[activeFilter];
  const activeConversationSourceCount =
    activeView === 'archived'
      ? derivedArchivedConversationItems.length
      : derivedMainConversationItems.length;
  const archivedConversationCount = derivedArchivedConversationItems.length;
  const messengerFreshSpaceEmpty =
    isMessengerSpace &&
    activeView === 'main' &&
    activeConversationSourceCount === 0 &&
    !searchTerm;
  const isPrimaryChatsView = activeView === 'main';
  const isDmFilter = activeFilter === 'dm';
  const manageMembersHref = canManageMembers
    ? `/spaces/members?space=${encodeURIComponent(activeSpaceId)}`
    : null;
  const openCreateDmHref = buildInboxHref({
    create: true,
    createMode: 'dm',
    filter: activeFilter,
    query: queryValue,
    spaceId: activeSpaceId,
    view: activeView,
  });
  const openCreateGroupHref = buildInboxHref({
    create: true,
    createMode: 'group',
    filter: activeFilter,
    query: queryValue,
    spaceId: activeSpaceId,
    view: activeView,
  });
  const messengerFreshBody =
    availableUserEntries.length > 0
      ? t.inbox.messengerFreshBody
      : canManageMembers
        ? t.inbox.messengerFreshAdminBody
        : t.inbox.messengerFreshMemberBody;
  const searchAria = isDmFilter ? t.inbox.searchDmAria : t.inbox.searchAria;
  const searchPlaceholder = isDmFilter
    ? t.inbox.searchDmPlaceholder
    : t.inbox.searchPlaceholder;
  const searchScopeSummary = useMemo(() => {
    if (!searchTerm) {
      return null;
    }

    const parts = [
      filteredConversationItems.length > 0
        ? t.inbox.searchResultChat(filteredConversationItems.length)
        : null,
      availableUserEntriesFiltered.length > 0
        ? t.inbox.searchResultPerson(availableUserEntriesFiltered.length)
        : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' · ') : t.inbox.searchSummaryNone;
  }, [
    availableUserEntriesFiltered.length,
    filteredConversationItems.length,
    searchTerm,
    t,
  ]);
  const pullRefreshProgress = Math.min(
    1,
    pullRefreshOffset / INBOX_PULL_REFRESH_THRESHOLD,
  );
  const pullRefreshLabel = isPullRefreshing
    ? t.inbox.refreshing
    : pullRefreshOffset >= INBOX_PULL_REFRESH_THRESHOLD
      ? t.inbox.releaseToRefresh
      : t.inbox.pullToRefresh;

  return (
    <div className="inbox-pull-root">
      <div className="inbox-pull-refresh-shell" aria-hidden="true">
        <div
          className={
            isPullRefreshing
              ? 'inbox-pull-refresh-indicator inbox-pull-refresh-indicator-active inbox-pull-refresh-indicator-refreshing'
              : pullRefreshOffset > 0
                ? 'inbox-pull-refresh-indicator inbox-pull-refresh-indicator-active'
                : 'inbox-pull-refresh-indicator'
          }
          style={{
            opacity: isPullRefreshing
              ? 1
              : Math.max(0, pullRefreshProgress * 1.1 - 0.08),
            transform: `translateY(${Math.max(-8, pullRefreshOffset * 0.42 - 18)}px) scale(${0.9 + pullRefreshProgress * 0.1})`,
          }}
        >
          <span className="inbox-pull-refresh-glyph" aria-hidden="true">
            {isPullRefreshing ? '↻' : '↓'}
          </span>
          <span className="inbox-pull-refresh-copy">{pullRefreshLabel}</span>
        </div>
      </div>

      <div
        className={[
          isPrimaryChatsView ? 'stack inbox-screen-dm' : 'stack',
          'inbox-pull-surface',
          pullRefreshOffset > 0 ? 'inbox-pull-surface-active' : null,
          touchGestureRef.current?.dragging ? 'inbox-pull-surface-dragging' : null,
        ]
          .filter(Boolean)
          .join(' ')}
        onTouchCancel={resetPullRefreshGesture}
        onTouchEnd={() => {
          void handlePullRefreshEnd();
        }}
        onTouchMove={handlePullRefreshMove}
        onTouchStart={handlePullRefreshStart}
        style={{
          transform:
            pullRefreshOffset > 0
              ? `translate3d(0, ${pullRefreshOffset}px, 0)`
              : undefined,
        }}
      >
      <section
        className={
          isPrimaryChatsView
            ? 'card inbox-home-shell inbox-home-shell-dm stack'
            : 'card inbox-home-shell stack'
        }
      >
        <div
          className={
            isPrimaryChatsView
              ? 'inbox-topbar inbox-topbar-compact inbox-topbar-compact-dm'
              : 'inbox-topbar inbox-topbar-compact'
          }
        >
          <form
            action="/inbox"
            className={
              isPrimaryChatsView
                ? 'inbox-search-form inbox-search-form-minimal inbox-search-form-topbar inbox-search-form-dm'
                : 'inbox-search-form inbox-search-form-minimal inbox-search-form-topbar'
            }
            aria-label={searchAria}
            role="search"
          >
            <label
              className={
                isPrimaryChatsView
                  ? 'field inbox-search-field inbox-search-shell inbox-search-shell-dm'
                  : 'field inbox-search-field inbox-search-shell'
              }
            >
              <span className="sr-only">{searchAria}</span>
              <span
                aria-hidden="true"
                className={
                  isPrimaryChatsView
                    ? 'inbox-search-icon inbox-search-icon-dm'
                    : 'inbox-search-icon'
                }
              >
                ⌕
              </span>
              <input
                className={
                  isPrimaryChatsView
                    ? 'input inbox-search-input inbox-search-input-dm'
                    : 'input inbox-search-input'
                }
                defaultValue={queryValue}
                enterKeyHint="search"
                name="q"
                placeholder={searchPlaceholder}
                type="search"
              />
            </label>
            {activeFilter !== 'all' ? (
              <input name="filter" type="hidden" value={activeFilter} />
            ) : null}
            <input name="space" type="hidden" value={activeSpaceId} />
            {activeView === 'archived' ? (
              <input name="view" type="hidden" value="archived" />
            ) : null}
          </form>

          <div className="inbox-topbar-actions">
            <Link
              aria-label={t.inbox.settingsAria}
              className="inbox-settings-trigger inbox-topbar-action-button"
              href={`/inbox/settings?space=${encodeURIComponent(activeSpaceId)}`}
            >
              <span aria-hidden="true" className="inbox-topbar-action-icon">
                ⚙
              </span>
            </Link>
            <button
              aria-label={t.inbox.createAria}
              className="inbox-compose-trigger inbox-topbar-action-button"
              onClick={() => {
                setCreateSheetMode('dm');
                setIsCreateSheetOpen(true);
              }}
              type="button"
            >
              <span aria-hidden="true" className="inbox-topbar-action-icon">
                +
              </span>
            </button>
          </div>
        </div>

        <div
          className={
            isPrimaryChatsView ? 'stack inbox-toolbar inbox-toolbar-dm' : 'stack inbox-toolbar'
          }
        >
          <div
            className={
              isPrimaryChatsView
                ? 'inbox-filter-row inbox-filter-row-dm'
                : 'inbox-filter-row'
            }
            role="tablist"
            aria-label={t.inbox.filtersAria}
          >
            {visibleFilters.includes('all') ? (
              <button
                aria-selected={activeFilter === 'all'}
                className={
                  activeFilter === 'all'
                    ? 'inbox-filter-pill inbox-filter-pill-active'
                    : 'inbox-filter-pill'
                }
                onClick={() => setActiveFilter('all')}
                role="tab"
                type="button"
              >
                {t.inbox.filters.all}
              </button>
            ) : null}
            {visibleFilters.includes('dm') ? (
              <button
                aria-selected={activeFilter === 'dm'}
                className={
                  activeFilter === 'dm'
                    ? 'inbox-filter-pill inbox-filter-pill-active'
                    : 'inbox-filter-pill'
                }
                onClick={() => setActiveFilter('dm')}
                role="tab"
                type="button"
              >
                {t.inbox.filters.dm}
              </button>
            ) : null}
            {visibleFilters.includes('groups') ? (
              <button
                aria-selected={activeFilter === 'groups'}
                className={
                  activeFilter === 'groups'
                    ? 'inbox-filter-pill inbox-filter-pill-active'
                    : 'inbox-filter-pill'
                }
                onClick={() => setActiveFilter('groups')}
                role="tab"
                type="button"
              >
                {t.inbox.filters.groups}
              </button>
            ) : null}
            {(archivedConversationCount > 0 || activeView === 'archived') ? (
              <button
                className={
                  activeView === 'archived'
                    ? 'inbox-filter-pill inbox-filter-pill-active'
                    : 'inbox-filter-pill'
                }
                onClick={() =>
                  setActiveView((currentView) =>
                    currentView === 'archived' ? 'main' : 'archived',
                  )
                }
                type="button"
              >
                {activeView === 'archived'
                  ? t.inbox.filters.inbox
                  : `${t.inbox.filters.archived}${archivedConversationCount > 0 ? ` (${archivedConversationCount})` : ''}`}
              </button>
            ) : null}
          </div>

          {searchTerm ? (
            <div
              className={
                isPrimaryChatsView
                  ? 'inbox-search-meta inbox-search-meta-dm'
                  : 'inbox-search-meta'
              }
            >
              <div
                className={
                  isPrimaryChatsView
                    ? 'stack inbox-search-copy inbox-search-copy-dm'
                    : 'stack inbox-search-copy'
                }
              >
                <p className="muted inbox-search-scope">{searchScopeSummary}</p>
                {activeBuckets.hasEncryptedDmSearchLimit ? (
                  <p className="muted inbox-search-note">
                    {t.inbox.searchEncryptedNote}
                  </p>
                ) : null}
              </div>
              <div className="inbox-search-meta-actions">
                <Link
                  className="inbox-search-clear"
                  href={buildInboxHref({
                    filter: activeFilter,
                    spaceId: activeSpaceId,
                    view: activeView,
                  })}
                >
                  {t.inbox.clear}
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {activeView === 'archived' ? (
        <section className="card stack inbox-archived-note">
          <p className="muted inbox-archived-note-copy">
            {t.inbox.archivedNote}
          </p>
        </section>
      ) : null}

      {messengerFreshSpaceEmpty ? (
        <section className="card stack empty-card inbox-empty-state inbox-empty-state-messenger">
          <div className="stack inbox-empty-copy">
            <h2 className="card-title">{t.inbox.messengerFreshTitle}</h2>
            <p className="muted">{messengerFreshBody}</p>
            {activeSpaceName ? (
              <div className="keepcozy-meta-row">
                <span className="keepcozy-meta-pill">
                  {t.settings.currentSpaceLabel}: {activeSpaceName}
                </span>
              </div>
            ) : null}
          </div>

          <div className="inbox-empty-actions">
            {availableDmUserEntries.length > 0 ? (
              <Link className="button" href={openCreateDmHref}>
                {t.inbox.create.createDm}
              </Link>
            ) : null}
            {availableUserEntries.length > 0 ? (
              <Link className="button button-secondary" href={openCreateGroupHref}>
                {t.inbox.create.createGroup}
              </Link>
            ) : null}
            {manageMembersHref ? (
              <Link className="pill" href={manageMembersHref}>
                {t.spaces.manageMembersAction}
              </Link>
            ) : null}
            <Link
              className="pill"
              href={`/spaces?space=${encodeURIComponent(activeSpaceId)}`}
            >
              {t.settings.chooseAnotherSpace}
            </Link>
          </div>
        </section>
      ) : activeConversationSourceCount === 0 ? (
        <section className="card stack empty-card inbox-empty-state">
          <h2 className="card-title">
            {activeView === 'archived'
              ? t.inbox.emptyArchivedTitle
              : t.inbox.emptyMainTitle}
          </h2>
          <p className="muted">
            {activeView === 'archived'
              ? t.inbox.emptyArchivedBody
              : t.inbox.emptyMainBody}
          </p>
        </section>
      ) : filteredConversationItems.length === 0 ? (
        <section className="card stack empty-card inbox-empty-state">
          <h2 className="card-title">
            {activeView === 'archived'
              ? t.inbox.emptyArchivedSearchTitle
              : t.inbox.emptySearchTitle}
          </h2>
          <p className="muted">{t.inbox.emptySearchBody}</p>
        </section>
      ) : (
        <section
          className={
            isPrimaryChatsView
              ? [
                  'stack',
                  'conversation-list',
                  'conversation-list-minimal',
                  'conversation-list-dm',
                  preferences.density === 'compact'
                    ? 'conversation-list-density-compact'
                    : 'conversation-list-density-comfortable',
                ]
                  .filter(Boolean)
                  .join(' ')
              : [
                  'stack',
                  'conversation-list',
                  'conversation-list-minimal',
                  preferences.density === 'compact'
                    ? 'conversation-list-density-compact'
                    : 'conversation-list-density-comfortable',
                ]
                  .filter(Boolean)
                  .join(' ')
          }
        >
          {organizedConversationSections.map((section) => (
            <div
              key={section.key}
              className={
                section.label ? 'stack conversation-list-section' : 'stack'
              }
            >
              {section.label ? (
                <p className="conversation-list-section-label">{section.label}</p>
              ) : null}
              {section.items.map((conversation) => (
                <InboxConversationLiveRow
                  key={conversation.conversationId}
                  activeSpaceId={activeSpaceId}
                  currentUserId={currentUserId}
                  initialSummary={
                    summariesByConversationId.get(conversation.conversationId) ?? {
                      conversationId: conversation.conversationId,
                      createdAt: null,
                      hiddenAt: null,
                      lastMessageAt: null,
                      lastReadAt: null,
                      lastReadMessageSeq: null,
                      latestMessageAttachmentKind: null,
                      latestMessageBody: null,
                      latestMessageContentMode: null,
                      latestMessageDeletedAt: null,
                      latestMessageId: null,
                      latestMessageKind: null,
                      latestMessageSenderId: null,
                      latestMessageSeq: null,
                      unreadCount: 0,
                    }
                  }
                  isArchivedView={activeView === 'archived'}
                  isPrimaryChatsView={isPrimaryChatsView}
                  item={conversation}
                  language={language}
                  labels={rowLabels}
                  previewMode={preferences.previewMode}
                  restoreAction={activeView === 'archived' ? restoreAction : null}
                  restoreLabel={activeView === 'archived' ? t.inbox.restore : undefined}
                />
              ))}
            </div>
          ))}
        </section>
      )}
      </div>

      {isCreateSheetOpen ? (
        <section className="inbox-create-overlay" aria-label="Create chat">
          <button
            aria-label="Close create chat"
            className="inbox-create-backdrop"
            onClick={() => setIsCreateSheetOpen(false)}
            type="button"
          />

          <NewChatSheet
            availableDmUsers={availableDmUserEntriesFiltered}
            availableGroupUsers={availableUserEntriesFiltered}
            hasAnyDmUsers={availableDmUserEntries.length > 0}
            hasAnyUsers={availableUserEntries.length > 0}
            initialMode={createSheetMode}
            language={language}
            manageMembersHref={manageMembersHref}
            onClose={() => setIsCreateSheetOpen(false)}
            onModeChange={setCreateSheetMode}
            spaceId={activeSpaceId}
          />
        </section>
      ) : null}
    </div>
  );
}
