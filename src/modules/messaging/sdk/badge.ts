type BadgeCapableNavigator = Navigator & {
  clearAppBadge?: () => Promise<void>;
  setAppBadge?: (contents?: number) => Promise<void>;
};

function getBadgeNavigator() {
  if (typeof navigator === 'undefined') {
    return null;
  }

  return navigator as BadgeCapableNavigator;
}

export function supportsAppBadge() {
  const badgeNavigator = getBadgeNavigator();

  return Boolean(
    badgeNavigator &&
      (typeof badgeNavigator.setAppBadge === 'function' ||
        typeof badgeNavigator.clearAppBadge === 'function'),
  );
}

export async function applyUnreadAppBadge(unreadCount: number) {
  const badgeNavigator = getBadgeNavigator();

  if (!badgeNavigator) {
    return false;
  }

  try {
    if (unreadCount > 0 && typeof badgeNavigator.setAppBadge === 'function') {
      await badgeNavigator.setAppBadge(unreadCount);
      return true;
    }

    if (unreadCount <= 0 && typeof badgeNavigator.clearAppBadge === 'function') {
      await badgeNavigator.clearAppBadge();
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
