'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  resolveInboxInitialFilter,
  type InboxSectionPreferences,
} from '@/modules/messaging/inbox/preferences';
import {
  buildInboxHref,
  type InboxFilter,
  type InboxView,
} from './inbox-filterable-content-model';
import type { NewChatMode } from './new-chat-sheet';

type UseInboxFilterableRouteStateInput = {
  activeSpaceId: string;
  createOpen: boolean;
  initialCreateMode: NewChatMode;
  initialFilter: InboxFilter;
  initialView: InboxView;
  preferences: InboxSectionPreferences;
  queryValue: string;
};

export function useInboxFilterableRouteState({
  activeSpaceId,
  createOpen,
  initialCreateMode,
  initialFilter,
  initialView,
  preferences,
  queryValue,
}: UseInboxFilterableRouteStateInput) {
  const [activeFilter, setActiveFilter] = useState<InboxFilter>(initialFilter);
  const [activeView, setActiveView] = useState<InboxView>(initialView);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(createOpen);
  const [createSheetMode, setCreateSheetMode] =
    useState<NewChatMode>(initialCreateMode);

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

  useEffect(() => {
    const resolvedFilter = resolveInboxInitialFilter(activeFilter, preferences);

    if (resolvedFilter !== activeFilter) {
      setActiveFilter(resolvedFilter);
    }
  }, [activeFilter, preferences]);

  const openCreateSheet = useCallback((mode: NewChatMode) => {
    setCreateSheetMode(mode);
    setIsCreateSheetOpen(true);
  }, []);

  const closeCreateSheet = useCallback(() => {
    setIsCreateSheetOpen(false);
  }, []);

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

  return {
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
  };
}
