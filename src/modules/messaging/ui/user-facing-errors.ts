import type { AppLanguage } from '@/modules/i18n';

type ErrorSurface = 'activity' | 'chat' | 'chat-settings' | 'inbox' | 'settings';

const technicalMessagePatterns = [
  /active space scoping requires/i,
  /duplicate key value/i,
  /violates unique constraint/i,
  /public\.conversations\./i,
  /column .* does not exist/i,
  /row-level security/i,
  /schema cache/i,
  /recipient_/i,
  /device_rows/i,
  /device-selection:none/i,
  /dm_e2ee/i,
  /envelopes:/i,
  /decrypt:/i,
  /signed prekey/i,
  /jwt/i,
  /postgres/i,
  /supabase/i,
  /permission denied/i,
  /null value in column/i,
  /invalid input syntax/i,
  /failed to fetch/i,
  /networkerror/i,
];

const friendlyOverrides = [
  {
    pattern: /encrypted direct messages are not enabled/i,
    en: 'Secure messaging is still getting ready for this account. Please try again in a moment.',
    ru: 'Защищенные сообщения для этого аккаунта еще подготавливаются. Попробуйте снова через минуту.',
  },
  {
    pattern: /direct-message text must use the encrypted client path/i,
    en: 'Please try sending that message again.',
    ru: 'Попробуйте отправить сообщение еще раз.',
  },
  {
    pattern:
      /recipient readiness|no device rows found|recipient_bundle_query_stage|device-selection:none/i,
    en: 'Secure messaging is still getting ready for this chat. Please try again in a moment.',
    ru: 'Защищенный чат еще подготавливается. Попробуйте снова через минуту.',
  },
  {
    pattern: /bucket not found/i,
    en: 'Avatar uploads are temporarily unavailable. Please try again later.',
    ru: 'Загрузка аватаров временно недоступна. Попробуйте позже.',
  },
  {
    pattern: /conversations_dm_key_unique|duplicate key value|violates unique constraint/i,
    en: 'That chat already exists. Please open it again.',
    ru: 'Этот чат уже существует. Откройте его еще раз.',
  },
];

function getLocalizedFallback(language: AppLanguage, surface: ErrorSurface) {
  const isRussian = language === 'ru';

  switch (surface) {
    case 'chat':
      return isRussian
        ? 'Не удалось открыть чат. Попробуйте еще раз.'
        : 'Unable to open this chat right now. Please try again.';
    case 'chat-settings':
      return isRussian
        ? 'Не удалось обновить настройки чата. Попробуйте еще раз.'
        : 'Unable to update chat settings right now. Please try again.';
    case 'inbox':
      return isRussian
        ? 'Не удалось загрузить чаты. Попробуйте еще раз.'
        : 'Unable to load your chats right now. Please try again.';
    case 'activity':
      return isRussian
        ? 'Не удалось загрузить активность. Попробуйте еще раз.'
        : 'Unable to load activity right now. Please try again.';
    case 'settings':
      return isRussian
        ? 'Не удалось обновить настройки. Попробуйте еще раз.'
        : 'Unable to update settings right now. Please try again.';
  }
}

function isTechnicalMessage(rawMessage: string) {
  if (technicalMessagePatterns.some((pattern) => pattern.test(rawMessage))) {
    return true;
  }

  if (rawMessage.length > 180) {
    return true;
  }

  return /[a-z0-9_]+:[a-z0-9_-]+/i.test(rawMessage);
}

export function getUserFacingErrorFallback(
  language: AppLanguage,
  surface: ErrorSurface,
) {
  return getLocalizedFallback(language, surface);
}

export function sanitizeUserFacingErrorMessage(input: {
  fallback: string;
  language: AppLanguage;
  rawMessage: string | null | undefined;
}) {
  const rawMessage = input.rawMessage?.trim();

  if (!rawMessage) {
    return input.fallback;
  }

  const friendlyOverride = friendlyOverrides.find(({ pattern }) =>
    pattern.test(rawMessage),
  );

  if (friendlyOverride) {
    return input.language === 'ru' ? friendlyOverride.ru : friendlyOverride.en;
  }

  if (isTechnicalMessage(rawMessage)) {
    return input.fallback;
  }

  return rawMessage;
}

export function logControlledUiError(input: {
  fallback: string;
  rawMessage: string | null | undefined;
  surface: string;
  extra?: Record<string, unknown>;
}) {
  const rawMessage = input.rawMessage?.trim() || null;

  if (!rawMessage) {
    return;
  }

  console.error('[controlled-ui-error]', input.surface, {
    fallback: input.fallback,
    rawMessage,
    ...input.extra,
  });
}
