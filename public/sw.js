self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {
    title: 'BWC Products',
    body: 'You have a new update.',
    url: '/inbox',
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
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: {
        url: payload.url,
      },
      icon: '/icon?size=192',
      badge: '/icon?size=192',
    }),
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
