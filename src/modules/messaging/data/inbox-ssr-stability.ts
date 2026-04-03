export type InboxSsrView = 'main' | 'archived';

export async function loadInboxConversationsForSsr<T>(input: {
  view: InboxSsrView;
  loadStable: () => Promise<T>;
  loadPrecise: () => Promise<T>;
}) {
  if (input.view === 'archived') {
    return input.loadPrecise();
  }

  return input.loadStable();
}

export async function loadArchivedConversationsForSsr<T>(input: {
  view: InboxSsrView;
  loadArchived: () => Promise<T>;
  emptyValue: T;
}) {
  if (input.view !== 'archived') {
    return input.emptyValue;
  }

  try {
    return await input.loadArchived();
  } catch {
    return input.emptyValue;
  }
}

