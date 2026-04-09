import 'server-only';

type WarmNavServerState = {
  counters: Map<string, number>;
};

declare global {
  var __chatWarmNavServerState: WarmNavServerState | undefined;
}

function isWarmNavServerDiagnosticsEnabled() {
  return process.env.CHAT_DEBUG_WARM_NAV === '1';
}

function getWarmNavServerState() {
  if (!globalThis.__chatWarmNavServerState) {
    globalThis.__chatWarmNavServerState = {
      counters: new Map<string, number>(),
    };
  }

  return globalThis.__chatWarmNavServerState;
}

function nextCounterValue(counterKey: string) {
  const state = getWarmNavServerState();
  const nextValue = (state.counters.get(counterKey) ?? 0) + 1;
  state.counters.set(counterKey, nextValue);
  return nextValue;
}

function getErrorDiagnostics(error: unknown) {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
    };
  }

  return {
    errorMessage: String(error),
    errorName: null,
  };
}

function logWarmNavServerDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!isWarmNavServerDiagnosticsEnabled()) {
    return;
  }

  if (details) {
    console.info('[chat-warm-nav:ssr]', stage, {
      ...details,
      loggedAt: new Date().toISOString(),
    });
    return;
  }

  console.info('[chat-warm-nav:ssr]', stage, {
    loggedAt: new Date().toISOString(),
  });
}

export function recordWarmNavServerRender(input: {
  details?: Record<string, unknown>;
  routeKey: string;
  surface: 'chat' | 'inbox';
}) {
  if (!isWarmNavServerDiagnosticsEnabled()) {
    return;
  }

  const renderCountForKey = nextCounterValue(
    `render:${input.surface}:${input.routeKey}`,
  );

  logWarmNavServerDiagnostics(`${input.surface}:render`, {
    ...input.details,
    renderCountForKey,
    routeKey: input.routeKey,
  });
}

export async function measureWarmNavServerLoad<T>(input: {
  details?: Record<string, unknown>;
  load: string;
  resolver: () => Promise<T> | T;
  routeKey: string;
  surface: 'chat' | 'inbox';
}) {
  if (!isWarmNavServerDiagnosticsEnabled()) {
    return input.resolver();
  }

  const loadCountForKey = nextCounterValue(
    `load:${input.surface}:${input.load}:${input.routeKey}`,
  );
  const startedAt = Date.now();
  const baseDetails = {
    ...input.details,
    load: input.load,
    loadCountForKey,
    routeKey: input.routeKey,
  };

  logWarmNavServerDiagnostics(`${input.surface}:${input.load}:start`, baseDetails);

  try {
    const result = await input.resolver();
    logWarmNavServerDiagnostics(`${input.surface}:${input.load}:done`, {
      ...baseDetails,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    logWarmNavServerDiagnostics(`${input.surface}:${input.load}:error`, {
      ...baseDetails,
      durationMs: Date.now() - startedAt,
      ...getErrorDiagnostics(error),
    });
    throw error;
  }
}
