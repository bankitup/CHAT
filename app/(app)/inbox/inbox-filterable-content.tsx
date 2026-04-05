'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import {
  getInboxPreviewText,
  getSearchableConversationPreview,
} from '@/modules/messaging/e2ee/inbox-policy';
import {
  getInboxConversationSummarySnapshot,
  getInboxSummaryRevisionSnapshot,
  subscribeToInboxSummaryRevision,
  type InboxConversationLiveSummary,
} from '@/modules/messaging/realtime/inbox-summary-store';
import { InboxConversationLiveRow } from './inbox-conversation-live-row';
import { NewChatSheet } from './new-chat-sheet';

type InboxFilter = 'all' | 'dm' | 'groups';
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

type InboxPresentationLabels = {
  attachment: string;
  deletedMessage: string;
  encryptedMessage: string;
  group: string;
  newEncryptedMessage: string;
  noActivityYet: string;
  unreadAria: string;
  voiceMessage: string;
  yesterday: string;
};

type InboxFilterableContentProps = {
  activeSpaceId: string;
  availableUserEntries: AvailableUserEntry[];
  createOpen: boolean;
  currentUserId: string;
  initialFilter: InboxFilter;
  initialView: InboxView;
  language: AppLanguage;
  mainConversationItems: ConversationListItem[];
  mainSummaries: InboxConversationLiveSummary[];
  queryValue: string;
  restoreAction: ((formData: FormData) => void | Promise<void>) | null;
  archivedConversationItems: ConversationListItem[];
  archivedSummaries: InboxConversationLiveSummary[];
};

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

function buildInboxHref({
  create,
  filter,
  query,
  spaceId,
  view,
}: {
  create?: boolean;
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

function deriveConversationItemsFromLiveState(input: {
  items: ConversationListItem[];
  labels: InboxPresentationLabels;
  liveSummariesByConversationId: Map<string, InboxConversationLiveSummary>;
  visibility: InboxView;
}) {
  const derivedItems: ConversationListItem[] = [];

  for (const item of input.items) {
    const fallbackSummary =
      input.liveSummariesByConversationId.get(item.conversationId) ?? {
        conversationId: item.conversationId,
        createdAt: null,
        hiddenAt: null,
        lastMessageAt: null,
        lastReadAt: null,
        lastReadMessageSeq: null,
        latestMessageBody: null,
        latestMessageContentMode: null,
        latestMessageDeletedAt: null,
        latestMessageId: null,
        latestMessageKind: null,
        latestMessageSenderId: null,
        latestMessageSeq: null,
        unreadCount: 0,
      };
    const liveSummary = fallbackSummary;

    if (liveSummary.removed) {
      continue;
    }

    const isHidden = Boolean(liveSummary.hiddenAt);

    if (input.visibility === 'main' ? isHidden : !isHidden) {
      continue;
    }

    derivedItems.push({
      ...item,
      hasUnread: liveSummary.unreadCount > 0,
      latestMessageContentMode: liveSummary.latestMessageContentMode,
      preview: getInboxPreviewText(
        {
          lastMessageAt: liveSummary.lastMessageAt,
          latestMessageBody: liveSummary.latestMessageBody,
          latestMessageContentMode: liveSummary.latestMessageContentMode,
          latestMessageDeletedAt: liveSummary.latestMessageDeletedAt,
          latestMessageKind: liveSummary.latestMessageKind,
          unreadCount: liveSummary.unreadCount,
        },
        {
          attachment: input.labels.attachment,
          deletedMessage: input.labels.deletedMessage,
          encryptedMessage: input.labels.encryptedMessage,
          newEncryptedMessage: input.labels.newEncryptedMessage,
          voiceMessage: input.labels.voiceMessage,
        },
      ),
    });
  }

  return derivedItems;
}

export function InboxFilterableContent({
  activeSpaceId,
  archivedConversationItems,
  archivedSummaries,
  availableUserEntries,
  createOpen,
  currentUserId,
  initialFilter,
  initialView,
  language,
  mainConversationItems,
  mainSummaries,
  queryValue,
  restoreAction,
}: InboxFilterableContentProps) {
  const t = useMemo(() => getTranslations(language), [language]);
  const searchTerm = normalizeSearchTerm(queryValue);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>(initialFilter);
  const [activeView, setActiveView] = useState<InboxView>(initialView);

  useEffect(() => {
    setActiveFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextHref = buildInboxHref({
      create: createOpen,
      filter: activeFilter,
      query: queryValue,
      spaceId: activeSpaceId,
      view: activeView,
    });

    if (window.location.pathname + window.location.search === nextHref) {
      return;
    }

    window.history.replaceState(window.history.state, '', nextHref);
  }, [activeFilter, activeSpaceId, activeView, createOpen, queryValue]);
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
      attachment: t.chat.attachment,
      deletedMessage: t.chat.deletedMessage,
      encryptedMessage: t.chat.encryptedMessage,
      group: t.inbox.metaGroup,
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
      deriveConversationItemsFromLiveState({
        items: mainConversationItems,
        labels: rowLabels,
        liveSummariesByConversationId,
        visibility: 'main',
      }),
    [liveSummariesByConversationId, mainConversationItems, rowLabels],
  );
  const derivedArchivedConversationItems = useMemo(
    () =>
      deriveConversationItemsFromLiveState({
        items: archivedConversationItems,
        labels: rowLabels,
        liveSummariesByConversationId,
        visibility: 'archived',
      }),
    [
      archivedConversationItems,
      liveSummariesByConversationId,
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
  const filteredConversationItems = activeBuckets.itemsByFilter[activeFilter];
  const activeConversationSourceCount =
    activeView === 'archived'
      ? derivedArchivedConversationItems.length
      : derivedMainConversationItems.length;
  const archivedConversationCount = derivedArchivedConversationItems.length;
  const isPrimaryChatsView = activeView === 'main';
  const isDmFilter = activeFilter === 'dm';
  const searchAria = isDmFilter ? t.inbox.searchDmAria : t.inbox.searchAria;
  const searchPlaceholder = isDmFilter
    ? t.inbox.searchDmPlaceholder
    : t.inbox.searchPlaceholder;
  const searchScopeSummary = searchTerm
    ? (() => {
        const parts = [
          filteredConversationItems.length > 0
            ? t.inbox.searchResultChat(filteredConversationItems.length)
            : null,
          availableUserEntriesFiltered.length > 0
            ? t.inbox.searchResultPerson(availableUserEntriesFiltered.length)
            : null,
        ].filter(Boolean);

        return parts.length > 0 ? parts.join(' · ') : t.inbox.searchSummaryNone;
      })()
    : null;

  return (
    <div className={isPrimaryChatsView ? 'stack inbox-screen-dm' : 'stack'}>
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
              href={`/settings?space=${encodeURIComponent(activeSpaceId)}`}
            >
              <span aria-hidden="true" className="inbox-topbar-action-icon">
                ⚙
              </span>
            </Link>
            <Link
              aria-label={t.inbox.createAria}
              className="inbox-compose-trigger inbox-topbar-action-button"
              href={buildInboxHref({
                create: true,
                filter: activeFilter,
                query: queryValue,
                spaceId: activeSpaceId,
                view: activeView,
              })}
            >
              <span aria-hidden="true" className="inbox-topbar-action-icon">
                +
              </span>
            </Link>
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

      {activeConversationSourceCount === 0 ? (
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
              ? 'stack conversation-list conversation-list-minimal conversation-list-dm'
              : 'stack conversation-list conversation-list-minimal'
          }
        >
          {filteredConversationItems.map((conversation) => (
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
              restoreAction={activeView === 'archived' ? restoreAction : null}
              restoreLabel={activeView === 'archived' ? t.inbox.restore : undefined}
            />
          ))}
        </section>
      )}

      {createOpen ? (
        <section className="inbox-create-overlay" aria-label="Create chat">
          <Link
            aria-label="Close create chat"
            className="inbox-create-backdrop"
            href={buildInboxHref({
              filter: activeFilter,
              query: queryValue,
              spaceId: activeSpaceId,
              view: activeView,
            })}
          />

          <NewChatSheet
            availableUsers={availableUserEntriesFiltered}
            hasAnyUsers={availableUserEntries.length > 0}
            closeHref={buildInboxHref({
              filter: activeFilter,
              query: queryValue,
              spaceId: activeSpaceId,
              view: activeView,
            })}
            spaceId={activeSpaceId}
            language={language}
          />
        </section>
      ) : null}
    </div>
  );
}
