self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function setGenericAppBadge() {
  const registrationTarget =
    self.registration &&
    typeof self.registration.setAppBadge === 'function'
      ? self.registration
      : null;
  const navigatorTarget =
    self.navigator &&
    typeof self.navigator.setAppBadge === 'function'
      ? self.navigator
      : null;
  const badgeTarget = registrationTarget || navigatorTarget;

  if (!badgeTarget) {
    return;
  }

  try {
    await badgeTarget.setAppBadge();
  } catch {
    // Ignore unsupported or platform-specific badge failures.
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {
    title: 'BWC Products',
    body: 'You have a new update.',
    url: '/inbox',
    tag: null,
  };

  try {
    payload = {
      ...payload,
      ...event.data.json(),
    };
  } catch {
    payload = {
      ...payload,
      body: event.data.text() || payload.body,
    };
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        data: {
          url: payload.url,
          conversationId: payload.conversationId ?? null,
          messageId: payload.messageId ?? null,
          spaceId: payload.spaceId ?? null,
        },
        icon: '/icon?size=192',
        badge: '/icon?size=192',
        tag: typeof payload.tag === 'string' ? payload.tag : undefined,
        renotify: false,
      }),
      setGenericAppBadge(),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/inbox';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => 'focus' in client);

      if (existingClient) {
        existingClient.focus();
        if ('navigate' in existingClient) {
          existingClient.navigate(targetUrl);
        }
        return;
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
