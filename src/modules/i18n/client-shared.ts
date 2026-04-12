import type { AppLanguage } from './index';

const CLIENT_LOCALES: Record<AppLanguage, string> = {
  en: 'en-US',
  ru: 'ru-RU',
};

export function getRussianCountWord(
  count: number,
  forms: [one: string, few: string, many: string],
) {
  const absolute = Math.abs(count) % 100;
  const lastDigit = absolute % 10;

  if (absolute > 10 && absolute < 20) {
    return forms[2];
  }

  if (lastDigit > 1 && lastDigit < 5) {
    return forms[1];
  }

  if (lastDigit === 1) {
    return forms[0];
  }

  return forms[2];
}

export function getLocaleForLanguage(language: AppLanguage) {
  return CLIENT_LOCALES[language];
}

export function formatPersonFallbackLabel(
  language: AppLanguage,
  index: number,
  kind: 'person' | 'member' = 'person',
) {
  if (language === 'ru') {
    return kind === 'member' ? `Участник ${index}` : `Человек ${index}`;
  }

  return kind === 'member' ? `Member ${index}` : `Person ${index}`;
}

export type { AppLanguage };
