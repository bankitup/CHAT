export type NotificationReadinessStatus =
  | 'unsupported'
  | 'available'
  | 'enabled'
  | 'blocked';

export type NotificationReadiness = {
  status: NotificationReadinessStatus;
  permission: NotificationPermission | 'unsupported';
  serviceWorkerReady: boolean;
};

function supportsNotificationReadiness() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  );
}

async function ensureNotificationServiceWorker() {
  if (!supportsNotificationReadiness()) {
    return false;
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration('/');

  if (existingRegistration) {
    return true;
  }

  const registration = await navigator.serviceWorker.register('/sw.js');

  return Boolean(registration);
}

export async function getNotificationReadiness() {
  if (!supportsNotificationReadiness()) {
    return {
      status: 'unsupported',
      permission: 'unsupported',
      serviceWorkerReady: false,
    } satisfies NotificationReadiness;
  }

  const permission = Notification.permission;
  const existingRegistration = await navigator.serviceWorker.getRegistration('/');
  const serviceWorkerReady = Boolean(existingRegistration);

  if (permission === 'granted') {
    const ready = serviceWorkerReady || (await ensureNotificationServiceWorker());

    return {
      status: 'enabled',
      permission,
      serviceWorkerReady: ready,
    } satisfies NotificationReadiness;
  }

  if (permission === 'denied') {
    return {
      status: 'blocked',
      permission,
      serviceWorkerReady,
    } satisfies NotificationReadiness;
  }

  return {
    status: 'available',
    permission,
    serviceWorkerReady,
  } satisfies NotificationReadiness;
}

export async function enableNotificationReadiness() {
  if (!supportsNotificationReadiness()) {
    return {
      status: 'unsupported',
      permission: 'unsupported',
      serviceWorkerReady: false,
    } satisfies NotificationReadiness;
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    return getNotificationReadiness();
  }

  const serviceWorkerReady = await ensureNotificationServiceWorker();

  return {
    status: 'enabled',
    permission,
    serviceWorkerReady,
  } satisfies NotificationReadiness;
}
