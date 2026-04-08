import type { PushSubscriptionRecordInput } from '@/modules/messaging/push/contract';

export type NotificationReadinessStatus =
  | 'unsupported'
  | 'unconfigured'
  | 'available'
  | 'enabled'
  | 'blocked';

export type NotificationReadiness = {
  status: NotificationReadinessStatus;
  permission: NotificationPermission | 'unsupported';
  serviceWorkerReady: boolean;
  pushSupported: boolean;
  subscriptionActive: boolean;
  vapidConfigured: boolean;
};

function supportsNotificationReadiness() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  );
}

function supportsPushSubscriptions() {
  return supportsNotificationReadiness() && 'PushManager' in window;
}

function getPushVapidPublicKey() {
  const key = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  return key?.length ? key : null;
}

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const normalized = `${value}${padding}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) {
    return null;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function getNotificationServiceWorkerRegistration() {
  if (!supportsNotificationReadiness()) {
    return null;
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration('/');

  if (existingRegistration) {
    return existingRegistration;
  }

  await navigator.serviceWorker.register('/sw.js');

  return navigator.serviceWorker.ready;
}

async function getCurrentPushSubscription() {
  if (!supportsPushSubscriptions()) {
    return null;
  }

  const registration = await getNotificationServiceWorkerRegistration();

  if (!registration) {
    return null;
  }

  return registration.pushManager.getSubscription();
}

function serializePushSubscription(
  subscription: PushSubscription,
): PushSubscriptionRecordInput {
  const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
  const auth = arrayBufferToBase64Url(subscription.getKey('auth'));

  if (!p256dh || !auth) {
    throw new Error('This browser returned an incomplete push subscription.');
  }

  const navigatorWithPlatform = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };

  return {
    endpoint: subscription.endpoint,
    expirationTime:
      typeof subscription.expirationTime === 'number'
        ? subscription.expirationTime
        : null,
    keys: {
      p256dh,
      auth,
    },
    userAgent: navigator.userAgent || null,
    platform:
      navigatorWithPlatform.userAgentData?.platform ??
      navigator.platform ??
      null,
    language: navigator.language || null,
  };
}

async function syncPushSubscriptionWithServer(subscription: PushSubscription) {
  const response = await fetch('/api/messaging/push-subscriptions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(serializePushSubscription(subscription)),
  });

  if (!response.ok) {
    throw new Error('Unable to persist this push subscription.');
  }
}

export async function getNotificationReadiness() {
  if (!supportsNotificationReadiness()) {
    return {
      status: 'unsupported',
      permission: 'unsupported',
      serviceWorkerReady: false,
      pushSupported: false,
      subscriptionActive: false,
      vapidConfigured: false,
    } satisfies NotificationReadiness;
  }

  const permission = Notification.permission;
  const pushSupported = supportsPushSubscriptions();
  const vapidConfigured = Boolean(getPushVapidPublicKey());
  const existingRegistration = await navigator.serviceWorker.getRegistration('/');
  const serviceWorkerReady = Boolean(existingRegistration);
  const subscription =
    permission === 'granted' && pushSupported
      ? await getCurrentPushSubscription()
      : null;
  const subscriptionActive = Boolean(subscription);

  if (!pushSupported) {
    return {
      status: 'unsupported',
      permission,
      serviceWorkerReady,
      pushSupported,
      subscriptionActive,
      vapidConfigured,
    } satisfies NotificationReadiness;
  }

  if (permission === 'granted' && subscriptionActive) {
    return {
      status: 'enabled',
      permission,
      serviceWorkerReady,
      pushSupported,
      subscriptionActive,
      vapidConfigured,
    } satisfies NotificationReadiness;
  }

  if (!vapidConfigured) {
    return {
      status: 'unconfigured',
      permission,
      serviceWorkerReady,
      pushSupported,
      subscriptionActive,
      vapidConfigured,
    } satisfies NotificationReadiness;
  }

  if (permission === 'denied') {
    return {
      status: 'blocked',
      permission,
      serviceWorkerReady,
      pushSupported,
      subscriptionActive,
      vapidConfigured,
    } satisfies NotificationReadiness;
  }

  return {
    status: 'available',
    permission,
    serviceWorkerReady,
    pushSupported,
    subscriptionActive,
    vapidConfigured,
  } satisfies NotificationReadiness;
}

export async function enableNotificationReadiness() {
  if (!supportsPushSubscriptions()) {
    return {
      status: 'unsupported',
      permission: supportsNotificationReadiness()
        ? Notification.permission
        : 'unsupported',
      serviceWorkerReady: false,
      pushSupported: false,
      subscriptionActive: false,
      vapidConfigured: Boolean(getPushVapidPublicKey()),
    } satisfies NotificationReadiness;
  }

  const vapidPublicKey = getPushVapidPublicKey();

  if (!vapidPublicKey) {
    return getNotificationReadiness();
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    return getNotificationReadiness();
  }

  const registration = await getNotificationServiceWorkerRegistration();

  if (!registration) {
    return getNotificationReadiness();
  }

  const existingSubscription = await registration.pushManager.getSubscription();
  let subscription = existingSubscription;

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
    });
  }

  try {
    await syncPushSubscriptionWithServer(subscription);
  } catch (error) {
    if (!existingSubscription) {
      await subscription.unsubscribe().catch(() => undefined);
    }

    throw error;
  }

  return {
    status: 'enabled',
    permission,
    serviceWorkerReady: true,
    pushSupported: true,
    subscriptionActive: true,
    vapidConfigured: true,
  } satisfies NotificationReadiness;
}
