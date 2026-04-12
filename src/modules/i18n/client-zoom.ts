import type { AppLanguage } from './client-shared';

type ZoomSwitcherLabels = {
  body: string;
  cancel: string;
  confirm: string;
  currentBadge: string;
  larger: string;
  largerHint: string;
  largest: string;
  largestHint: string;
  previewBadge: string;
  previewNotice: string;
  saveFailed: string;
  standard: string;
  standardHint: string;
  title: string;
  trigger: string;
};

export type ZoomClientTranslations = {
  zoomSwitcher: ZoomSwitcherLabels;
};

const ZOOM_CLIENT_TRANSLATIONS: Record<AppLanguage, ZoomClientTranslations> = {
  en: {
    zoomSwitcher: {
      body: 'Preview a larger interface before saving it for this device. The preview updates the shell immediately, including controls and tap targets.',
      cancel: 'Cancel',
      confirm: 'Use this size',
      currentBadge: 'Current',
      larger: 'Larger',
      largerHint: 'Bigger text, controls, and spacing.',
      largest: 'Largest',
      largestHint: 'Maximum comfort for reading and tapping.',
      previewBadge: 'Preview',
      previewNotice:
        'Preview applies immediately. Confirm to keep this size across the app on this device.',
      saveFailed: 'Unable to save the display size right now.',
      standard: 'Standard',
      standardHint: 'Balanced layout and default density.',
      title: 'App zoom',
      trigger: 'Size',
    },
  },
  ru: {
    zoomSwitcher: {
      body: 'Сначала посмотрите увеличенный интерфейс, а потом сохраните его для этого устройства. Превью сразу обновляет оболочку, кнопки и области касания.',
      cancel: 'Отмена',
      confirm: 'Сохранить размер',
      currentBadge: 'Сейчас',
      larger: 'Крупнее',
      largerHint: 'Крупнее текст, кнопки и отступы.',
      largest: 'Самый крупный',
      largestHint: 'Максимально комфортно для чтения и касаний.',
      previewBadge: 'Превью',
      previewNotice:
        'Превью применяется сразу. Подтвердите, чтобы сохранить этот размер для всего приложения на этом устройстве.',
      saveFailed: 'Сейчас не удалось сохранить размер интерфейса.',
      standard: 'Стандартный',
      standardHint: 'Сбалансированная плотность и обычный размер.',
      title: 'Размер интерфейса',
      trigger: 'Размер',
    },
  },
};

export function getZoomSwitcherClientTranslations(
  language: AppLanguage,
): ZoomClientTranslations {
  return ZOOM_CLIENT_TRANSLATIONS[language];
}

export type { AppLanguage };
