'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

type WarmNavSurface = 'activity' | 'chat' | 'home' | 'inbox';

type WarmNavIntent = {
  href: string;
  id: number;
  pathname: string;
  routeKey: string;
  source: string;
  startedAtMs: number;
  surface: WarmNavSurface;
};

type WarmNavClientState = {
  lastIntent: WarmNavIntent | null;
  mountCounts: Record<string, number>;
  nextIntentId: number;
};

declare global {
  interface Window {
    __chatWarmNavState?: WarmNavClientState;
  }
}

function isWarmNavClientDiagnosticsEnabled() {
  return (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_WARM_NAV === '1'
  );
}

function getWarmNavSurface(pathname: string): WarmNavSurface | null {
  if (pathname.startsWith('/chat/')) {
    return 'chat';
  }

  if (pathname.startsWith('/inbox')) {
    return 'inbox';
  }

  if (pathname.startsWith('/activity')) {
    return 'activity';
  }

  if (pathname.startsWith('/home')) {
    return 'home';
  }

  return null;
}

function getWarmNavClientState() {
  if (!window.__chatWarmNavState) {
    window.__chatWarmNavState = {
      lastIntent: null,
      mountCounts: {},
      nextIntentId: 1,
    };
  }

  return window.__chatWarmNavState;
}

function roundMs(value: number) {
  return Math.round(value * 10) / 10;
}

function buildRouteKey(pathname: string, search: string) {
  return search ? `${pathname}${search}` : pathname;
}

function getIntentDiagnostics(pathname: string) {
  if (!isWarmNavClientDiagnosticsEnabled()) {
    return {};
  }

  const intent = getWarmNavClientState().lastIntent;

  if (!intent || intent.pathname !== pathname) {
    return {
      hasMatchingIntent: false,
      lastIntentHref: intent?.href ?? null,
      lastIntentPathname: intent?.pathname ?? null,
      lastIntentSurface: intent?.surface ?? null,
    };
  }

  return {
    hasMatchingIntent: true,
    intendedHref: intent.href,
    intentId: intent.id,
    intentSource: intent.source,
    intentSurface: intent.surface,
    sinceIntentMs: roundMs(performance.now() - intent.startedAtMs),
  };
}

export function logWarmNavClientEvent(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!isWarmNavClientDiagnosticsEnabled()) {
    return;
  }

  if (details) {
    console.info('[chat-warm-nav]', stage, {
      ...details,
      loggedAt: new Date().toISOString(),
    });
    return;
  }

  console.info('[chat-warm-nav]', stage, {
    loggedAt: new Date().toISOString(),
  });
}

export function recordWarmNavIntent(input: { href: string; source: string }) {
  if (!isWarmNavClientDiagnosticsEnabled()) {
    return;
  }

  const url = new URL(input.href, window.location.origin);
  const surface = getWarmNavSurface(url.pathname);

  if (!surface) {
    return;
  }

  const state = getWarmNavClientState();
  const routeKey = buildRouteKey(url.pathname, url.search);
  const nextIntent: WarmNavIntent = {
    href: routeKey,
    id: state.nextIntentId,
    pathname: url.pathname,
    routeKey,
    source: input.source,
    startedAtMs: performance.now(),
    surface,
  };

  state.lastIntent = nextIntent;
  state.nextIntentId += 1;

  logWarmNavClientEvent('intent', {
    href: nextIntent.href,
    intentId: nextIntent.id,
    pathname: nextIntent.pathname,
    routeKey: nextIntent.routeKey,
    source: nextIntent.source,
    surface: nextIntent.surface,
  });
}

function recordTrackedAnchorIntent(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return;
  }

  const link = target.closest('a[href]');

  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  if (link.target && link.target !== '_self') {
    return;
  }

  if (link.origin !== window.location.origin) {
    return;
  }

  recordWarmNavIntent({
    href: link.href,
    source: 'anchor:pointerdown',
  });
}

function nextMountCount(surface: string, routeKey: string) {
  const state = getWarmNavClientState();
  const counterKey = `${surface}:${routeKey}`;
  const nextValue = (state.mountCounts[counterKey] ?? 0) + 1;
  state.mountCounts[counterKey] = nextValue;
  return nextValue;
}

export function noteWarmNavRouterRefresh(
  surface: 'chat' | 'inbox',
  reason: string,
  details?: Record<string, unknown>,
) {
  if (!isWarmNavClientDiagnosticsEnabled()) {
    return;
  }

  logWarmNavClientEvent('router-refresh', {
    ...details,
    pathname: window.location.pathname,
    reason,
    routeKey: buildRouteKey(window.location.pathname, window.location.search),
    surface,
    ...getIntentDiagnostics(window.location.pathname),
  });
}

export function WarmNavRouteObserver() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routeKey = buildRouteKey(pathname, search ? `?${search}` : '');
  const hasSeenInitialRouteRef = useRef(false);

  useEffect(() => {
    if (!isWarmNavClientDiagnosticsEnabled()) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      recordTrackedAnchorIntent(event.target);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, []);

  useEffect(() => {
    if (!isWarmNavClientDiagnosticsEnabled()) {
      return;
    }

    logWarmNavClientEvent('route-observed', {
      isInitialRoute: !hasSeenInitialRouteRef.current,
      pathname,
      routeKey,
      ...getIntentDiagnostics(pathname),
    });
    hasSeenInitialRouteRef.current = true;

    const animationFrame = window.requestAnimationFrame(() => {
      logWarmNavClientEvent('shell-paint', {
        pathname,
        routeKey,
        ...getIntentDiagnostics(pathname),
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [pathname, routeKey]);

  return null;
}

export function WarmNavReadyProbe(input: {
  details?: Record<string, unknown>;
  routeKey: string;
  routePath: string;
  surface: 'chat' | 'inbox';
}) {
  useEffect(() => {
    if (!isWarmNavClientDiagnosticsEnabled()) {
      return;
    }

    const mountCountForKey = nextMountCount(input.surface, input.routeKey);

    logWarmNavClientEvent(`${input.surface}:mount`, {
      ...input.details,
      mountCountForKey,
      routeKey: input.routeKey,
      routePath: input.routePath,
      ...getIntentDiagnostics(input.routePath),
    });

    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        logWarmNavClientEvent(`${input.surface}:ready`, {
          ...input.details,
          mountCountForKey,
          routeKey: input.routeKey,
          routePath: input.routePath,
          ...getIntentDiagnostics(input.routePath),
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      logWarmNavClientEvent(`${input.surface}:unmount`, {
        ...input.details,
        mountCountForKey,
        routeKey: input.routeKey,
        routePath: input.routePath,
      });
    };
  }, [input.details, input.routeKey, input.routePath, input.surface]);

  return null;
}
