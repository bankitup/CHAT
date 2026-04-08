declare module 'web-push' {
  export type WebPushSubscription = {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };

  export type WebPushRequestOptions = {
    TTL?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
  };

  export class WebPushError extends Error {
    statusCode?: number;
    body?: string;
    headers?: Record<string, string>;
    endpoint?: string;
  }

  const webpush: {
    WebPushError: typeof WebPushError;
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: WebPushSubscription,
      payload?: string | null,
      options?: WebPushRequestOptions,
    ): Promise<unknown>;
  };

  export default webpush;
}
