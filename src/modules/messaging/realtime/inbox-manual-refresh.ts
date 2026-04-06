'use client';

type InboxManualRefreshListener = () => void | Promise<void>;

const inboxManualRefreshListeners = new Set<InboxManualRefreshListener>();

export function subscribeToInboxManualRefresh(
  listener: InboxManualRefreshListener,
) {
  inboxManualRefreshListeners.add(listener);

  return () => {
    inboxManualRefreshListeners.delete(listener);
  };
}

export async function requestInboxManualRefresh() {
  if (inboxManualRefreshListeners.size === 0) {
    return {
      handled: false,
    } as const;
  }

  await Promise.all(
    Array.from(inboxManualRefreshListeners).map((listener) =>
      Promise.resolve(listener()),
    ),
  );

  return {
    handled: true,
  } as const;
}
