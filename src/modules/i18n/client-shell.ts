import type { AppLanguage } from './client-shared';

type ShellLabels = {
  activity: string;
  chats: string;
  home: string;
  issues: string;
  label: string;
  messengerActivity: string;
  openActivity: string;
  openChats: string;
  openHome: string;
  openIssues: string;
  openMessengerActivity: string;
  openRooms: string;
  openTasks: string;
  retry: string;
  rooms: string;
  tasks: string;
};

export type ShellClientTranslations = {
  shell: ShellLabels;
};

const SHELL_CLIENT_TRANSLATIONS: Record<AppLanguage, ShellClientTranslations> = {
  en: {
    shell: {
      activity: 'History',
      chats: 'Chats',
      home: 'Home',
      issues: 'Issues',
      label: 'Primary navigation',
      messengerActivity: 'Activity',
      openActivity: 'Open history',
      openChats: 'Open chats',
      openHome: 'Open home',
      openIssues: 'Open issues',
      openMessengerActivity: 'Open activity',
      openRooms: 'Open rooms',
      openTasks: 'Open tasks',
      retry: 'Try again',
      rooms: 'Rooms',
      tasks: 'Tasks',
    },
  },
  ru: {
    shell: {
      activity: 'История',
      chats: 'Чаты',
      home: 'Главная',
      issues: 'Проблемы',
      label: 'Основная навигация',
      messengerActivity: 'Активность',
      openActivity: 'Открыть историю',
      openChats: 'Открыть чаты',
      openHome: 'Открыть главную',
      openIssues: 'Открыть проблемы',
      openMessengerActivity: 'Открыть активность',
      openRooms: 'Открыть комнаты',
      openTasks: 'Открыть задачи',
      retry: 'Попробовать снова',
      rooms: 'Комнаты',
      tasks: 'Задачи',
    },
  },
};

export function getShellClientTranslations(
  language: AppLanguage,
): ShellClientTranslations {
  return SHELL_CLIENT_TRANSLATIONS[language];
}

export type { AppLanguage };
