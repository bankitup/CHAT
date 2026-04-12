'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { getInboxClientTranslations } from '@/modules/i18n/client';
import { InboxConversationSectionsStatic } from './inbox-conversation-sections-static';
import {
  buildFilterBucket,
  buildInboxHref,
  buildOrganizedConversationSectionsByFilter,
  buildVisibleSummariesByConversationId,
  normalizeSearchTerm,
  type InboxFilterableContentProps,
} from './inbox-filterable-content-model';
import { useDeferredInboxRuntimeReady } from './use-deferred-inbox-runtime-ready';
import { useInboxFilterableRouteState } from './use-inbox-filterable-route-state';
import { useInboxPullRefresh } from './use-inbox-pull-refresh';

const DeferredInboxConversationSectionsLive = dynamic(
  () =>
    import('./inbox-conversation-sections-live').then(
      (mod) => mod.InboxConversationSectionsLive,
    ),
  { ssr: false },
);

const DeferredInboxCreateSheetRuntime = dynamic(
  () =>
    import('./inbox-create-sheet-runtime').then(
      (mod) => mod.InboxCreateSheetRuntime,
    ),
  { ssr: false },
);

export function InboxFilterableContent({
  activeSpaceId,
  activeSpaceName,
  archivedConversationItems,
  archivedSummaries,
  availableDmUserCount,
  availableUserCount,
  canManageMembers,
  createOpen,
  createTargetsLoaded,
  currentUserId,
  initialCreateDmUserEntries,
  initialCreateMode,
  initialCreateUserEntries,
  initialFilter,
  initialView,
  isMessengerSpace,
  language,
  mainConversationItems,
  mainSummaries,
  preferences,
  queryValue,
  restoreAction,
  searchScopedAvailableUserCount,
}: InboxFilterableContentProps) {
  const t = useMemo(() => getInboxClientTranslations(language), [language]);
  const isDeferredInboxRuntimeReady = useDeferredInboxRuntimeReady({
    fallbackDelayMs: 140,
    idleTimeoutMs: 1200,
  });
  const {
    activeFilter,
    activeView,
    closeCreateSheet,
    createSheetMode,
    isCreateSheetOpen,
    openCreateSheet,
    setActiveFilter,
    setActiveView,
    setCreateSheetMode,
    visibleFilters,
  } = useInboxFilterableRouteState({
    activeSpaceId,
    createOpen,
    initialCreateMode,
    initialFilter,
    initialView,
    preferences,
    queryValue,
  });
  const isPullRefreshReady =
    isDeferredInboxRuntimeReady && !isCreateSheetOpen;
  const {
    handlePullRefreshEnd,
    handlePullRefreshMove,
    handlePullRefreshStart,
    isDragging,
    isPullRefreshing,
    pullRefreshOffset,
    pullRefreshThreshold,
    resetPullRefreshGesture,
  } = useInboxPullRefresh({
    enabled: isPullRefreshReady,
  });
  const searchTerm = normalizeSearchTerm(queryValue);

  const visibleConversationItems =
    activeView === 'archived' ? archivedConversationItems : mainConversationItems;
  const visibleConversationSummaries =
    activeView === 'archived' ? archivedSummaries : mainSummaries;
  const visibleSummariesByConversationId = useMemo(
    () => buildVisibleSummariesByConversationId(visibleConversationSummaries),
    [visibleConversationSummaries],
  );
  const rowLabels = useMemo(
    () => ({
      audio: t.chat.audio,
      attachment: t.chat.attachment,
      deletedMessage: t.chat.deletedMessage,
      encryptedMessage: t.chat.encryptedMessage,
      file: t.chat.file,
      group: t.inbox.metaGroup,
      image: t.chat.photo,
      newMessage: t.chat.newMessage,
      newEncryptedMessage: t.chat.newEncryptedMessage,
      noActivityYet: t.inbox.noActivityYet,
      unreadAria: t.inbox.unreadAria,
      voiceMessage: t.chat.voiceMessage,
      yesterday: t.inbox.yesterday,
    }),
    [t],
  );
  const activeBuckets = useMemo(
    () =>
      buildFilterBucket({
        items: visibleConversationItems,
        searchTerm,
        t,
      }),
    [searchTerm, t, visibleConversationItems],
  );
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
  const activeConversationSourceCount = visibleConversationItems.length;
  const archivedConversationCount =
    activeView === 'archived'
      ? visibleConversationItems.length
      : archivedConversationItems.length;
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
  const mainInboxHref = buildInboxHref({
    filter: activeFilter,
    query: queryValue,
    spaceId: activeSpaceId,
  });
  const clearSearchHref = buildInboxHref({
    filter: activeFilter,
    spaceId: activeSpaceId,
    view: activeView,
  });
  const messengerFreshBody =
    !createTargetsLoaded || availableUserCount > 0
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
      searchScopedAvailableUserCount > 0
        ? t.inbox.searchResultPerson(searchScopedAvailableUserCount)
        : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' · ') : t.inbox.searchSummaryNone;
  }, [
    filteredConversationItems.length,
    searchScopedAvailableUserCount,
    searchTerm,
    t,
  ]);
  const pullRefreshProgress = Math.min(
    1,
    pullRefreshOffset / pullRefreshThreshold,
  );
  const pullRefreshLabel = isPullRefreshing
    ? t.inbox.refreshing
    : pullRefreshOffset >= pullRefreshThreshold
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
          isDragging ? 'inbox-pull-surface-dragging' : null,
        ]
          .filter(Boolean)
          .join(' ')}
        onTouchCancel={isPullRefreshReady ? resetPullRefreshGesture : undefined}
        onTouchEnd={
          isPullRefreshReady
            ? () => {
                void handlePullRefreshEnd();
              }
            : undefined
        }
        onTouchMove={isPullRefreshReady ? handlePullRefreshMove : undefined}
        onTouchStart={isPullRefreshReady ? handlePullRefreshStart : undefined}
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
              aria-label={searchAria}
              className={
                isPrimaryChatsView
                  ? 'inbox-search-form inbox-search-form-minimal inbox-search-form-topbar inbox-search-form-dm'
                  : 'inbox-search-form inbox-search-form-minimal inbox-search-form-topbar'
              }
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
                {isPrimaryChatsView ? null : (
                  <span aria-hidden="true" className="inbox-search-icon">
                    ⌕
                  </span>
                )}
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
                aria-haspopup="dialog"
                aria-label={t.inbox.createAria}
                className="inbox-compose-trigger inbox-topbar-action-button"
                onClick={() => openCreateSheet('dm')}
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
              aria-label={t.inbox.filtersAria}
              className={
                isPrimaryChatsView
                  ? 'inbox-filter-row inbox-filter-row-dm'
                  : 'inbox-filter-row'
              }
              role="tablist"
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
              {archivedConversationCount > 0 || activeView === 'archived' ? (
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
                  <Link className="inbox-search-clear" href={clearSearchHref}>
                    {t.inbox.clear}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {activeView === 'archived' ? (
          <section className="card stack inbox-archived-note">
            <div className="stack inbox-archived-note-main">
              <span className="inbox-empty-eyebrow">{t.inbox.filters.archived}</span>
              <p className="muted inbox-archived-note-copy">
                {t.inbox.archivedNote}
              </p>
            </div>
            <Link className="pill inbox-archived-note-action" href={mainInboxHref}>
              {t.inbox.filters.inbox}
            </Link>
          </section>
        ) : null}

        {messengerFreshSpaceEmpty ? (
          <section className="card stack empty-card inbox-empty-state inbox-empty-state-messenger">
            <div className="stack inbox-empty-copy">
              <span className="inbox-empty-eyebrow">{t.inbox.filters.inbox}</span>
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
              {!createTargetsLoaded || availableDmUserCount > 0 ? (
                <button
                  className="button"
                  onClick={() => openCreateSheet('dm')}
                  type="button"
                >
                  {t.inbox.create.createDm}
                </button>
              ) : null}
              {!createTargetsLoaded || availableUserCount > 0 ? (
                <button
                  className="button button-secondary"
                  onClick={() => openCreateSheet('group')}
                  type="button"
                >
                  {t.inbox.create.createGroup}
                </button>
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
            <div className="stack inbox-empty-copy">
              <span className="inbox-empty-eyebrow">
                {activeView === 'archived'
                  ? t.inbox.filters.archived
                  : t.inbox.filters.inbox}
              </span>
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
            </div>
            <div className="inbox-empty-actions">
              {activeView === 'archived' ? (
                <Link className="button button-secondary" href={mainInboxHref}>
                  {t.inbox.filters.inbox}
                </Link>
              ) : (
                <>
                  <button
                    className="button"
                    onClick={() => openCreateSheet('dm')}
                    type="button"
                  >
                    {t.inbox.create.createDm}
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => openCreateSheet('group')}
                    type="button"
                  >
                    {t.inbox.create.createGroup}
                  </button>
                </>
              )}
            </div>
          </section>
        ) : filteredConversationItems.length === 0 ? (
          <section className="card stack empty-card inbox-empty-state">
            <div className="stack inbox-empty-copy">
              <span className="inbox-empty-eyebrow">
                {activeView === 'archived'
                  ? t.inbox.filters.archived
                  : t.inbox.filters.inbox}
              </span>
              <h2 className="card-title">
                {activeView === 'archived'
                  ? t.inbox.emptyArchivedSearchTitle
                  : t.inbox.emptySearchTitle}
              </h2>
              <p className="muted">{t.inbox.emptySearchBody}</p>
            </div>
            <div className="inbox-empty-actions">
              <Link className="pill" href={clearSearchHref}>
                {t.inbox.clear}
              </Link>
            </div>
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
            {isDeferredInboxRuntimeReady ? (
              <DeferredInboxConversationSectionsLive
                activeSpaceId={activeSpaceId}
                currentUserId={currentUserId}
                isArchivedView={activeView === 'archived'}
                isPrimaryChatsView={isPrimaryChatsView}
                language={language}
                labels={rowLabels}
                previewMode={preferences.previewMode}
                restoreAction={restoreAction}
                restoreLabel={t.inbox.restore}
                sections={organizedConversationSections}
                visibleSummariesByConversationId={visibleSummariesByConversationId}
              />
            ) : (
              <InboxConversationSectionsStatic
                activeSpaceId={activeSpaceId}
                currentUserId={currentUserId}
                isArchivedView={activeView === 'archived'}
                isPrimaryChatsView={isPrimaryChatsView}
                language={language}
                labels={rowLabels}
                restoreAction={restoreAction}
                restoreLabel={t.inbox.restore}
                sections={organizedConversationSections}
                shouldPrefetch
                visibleSummariesByConversationId={visibleSummariesByConversationId}
              />
            )}
          </section>
        )}
      </div>

      {isCreateSheetOpen ? (
        <DeferredInboxCreateSheetRuntime
          activeSpaceId={activeSpaceId}
          createTargetsLoaded={createTargetsLoaded}
          initialAvailableDmUserEntries={initialCreateDmUserEntries}
          initialAvailableUserEntries={initialCreateUserEntries}
          isOpen={isCreateSheetOpen}
          language={language}
          manageMembersHref={manageMembersHref}
          mode={createSheetMode}
          onClose={closeCreateSheet}
          onModeChange={setCreateSheetMode}
          searchTerm={searchTerm}
        />
      ) : null}
    </div>
  );
}
