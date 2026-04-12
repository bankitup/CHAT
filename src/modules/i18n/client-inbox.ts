import { getRussianCountWord, type AppLanguage } from './client-shared';

type InboxChatLabels = {
  attachment: string;
  audio: string;
  deletedMessage: string;
  directChat: string;
  encryptedMessage: string;
  file: string;
  newEncryptedMessage: string;
  newMessage: string;
  photo: string;
  unknownUser: string;
  voiceMessage: string;
};

type InboxCreateLabels = {
  close: string;
  closeAria: string;
  createDm: string;
  createGroup: string;
  direct: string;
  existingDmOnly: string;
  group: string;
  groupNamePlaceholder: string;
  groupSelectionCount: (count: number) => string;
  groupSelectionEmpty: string;
  groupSubtitle: string;
  groupTitle: string;
  loadingCandidates: string;
  loadingCandidatesFailed: string;
  messageSelection: (label: string) => string;
  modeAria: string;
  noMatches: string;
  noUsers: string;
  noUsersAdmin: string;
  peopleSubtitle: string;
  peopleTitle: string;
  searchAria: string;
  searchPlaceholder: string;
  selected: string;
  subtitle: string;
  title: string;
};

export type InboxClientTranslations = {
  chat: InboxChatLabels;
  inbox: {
    archivedNote: string;
    clear: string;
    create: InboxCreateLabels;
    createAria: string;
    emptyArchivedBody: string;
    emptyArchivedSearchTitle: string;
    emptyArchivedTitle: string;
    emptyMainBody: string;
    emptyMainTitle: string;
    emptySearchBody: string;
    emptySearchTitle: string;
    filters: {
      all: string;
      archived: string;
      dm: string;
      groups: string;
      inbox: string;
    };
    filtersAria: string;
    messengerFreshAdminBody: string;
    messengerFreshBody: string;
    messengerFreshMemberBody: string;
    messengerFreshTitle: string;
    metaGroup: string;
    noActivityYet: string;
    pullToRefresh: string;
    refreshing: string;
    releaseToRefresh: string;
    restore: string;
    searchAria: string;
    searchDmAria: string;
    searchDmPlaceholder: string;
    searchEncryptedNote: string;
    searchPlaceholder: string;
    searchResultChat: (count: number) => string;
    searchResultPerson: (count: number) => string;
    searchSummaryNone: string;
    settingsAria: string;
    unreadAria: string;
    yesterday: string;
  };
  settings: {
    chooseAnotherSpace: string;
    currentSpaceLabel: string;
  };
  shell: {
    retry: string;
  };
  spaces: {
    manageMembersAction: string;
  };
};

const INBOX_CLIENT_TRANSLATIONS: Record<AppLanguage, InboxClientTranslations> = {
  en: {
    chat: {
      attachment: 'Attachment',
      audio: 'Audio',
      deletedMessage: 'Deleted message',
      directChat: 'Direct chat',
      encryptedMessage: 'Encrypted message',
      file: 'File',
      newEncryptedMessage: 'New encrypted message',
      newMessage: 'New message',
      photo: 'Photo',
      unknownUser: 'Unknown user',
      voiceMessage: 'Voice message',
    },
    inbox: {
      archivedNote:
        'Archived chats are only hidden from your inbox. They still keep their messages and can return anytime.',
      clear: 'Clear',
      create: {
        close: 'Close',
        closeAria: 'Close create chat',
        createDm: 'Create DM',
        createGroup: 'Create group',
        direct: 'Direct message',
        existingDmOnly: 'Everyone here already has a direct chat with you.',
        group: 'Group chat',
        groupNamePlaceholder: 'Weekend planning',
        groupSelectionCount: (count) => `${count} selected`,
        groupSelectionEmpty: 'Select at least one person.',
        groupSubtitle: 'Name it and choose who should be in it.',
        groupTitle: 'Group chat',
        loadingCandidates: 'Loading people...',
        loadingCandidatesFailed:
          'Unable to load people right now. Please try again.',
        messageSelection: (label) => `Message ${label}.`,
        modeAria: 'New chat mode',
        noMatches: 'No matching people yet.',
        noUsers: 'No other registered users are available yet.',
        noUsersAdmin:
          'No other members are available in this space yet. Add people to this space first, then come back to start chats.',
        peopleSubtitle: 'Pick one person to start chatting.',
        peopleTitle: 'People',
        searchAria: 'Search people',
        searchPlaceholder: 'Search people',
        selected: 'Selected',
        subtitle: 'Choose a direct message or start a group.',
        title: 'New chat',
      },
      createAria: 'Start a chat',
      emptyArchivedBody: 'Chats you hide from your inbox will appear here.',
      emptyArchivedSearchTitle: 'No matching archived chats',
      emptyArchivedTitle: 'No archived chats',
      emptyMainBody: 'Start one from the + button.',
      emptyMainTitle: 'No chats here',
      emptySearchBody: 'Try another search or filter.',
      emptySearchTitle: 'No matching chats',
      filters: {
        all: 'All',
        archived: 'Archived',
        dm: 'DM',
        groups: 'Groups',
        inbox: 'Inbox',
      },
      filtersAria: 'Chat filters',
      messengerFreshAdminBody:
        'Add members to this space first, then start the first direct message or group here. Nothing is copied in automatically from TEST or any other workspace.',
      messengerFreshBody:
        'Start the first direct message or group here. This space begins with no copied history from TEST or any other workspace.',
      messengerFreshMemberBody:
        'This space has no other visible members yet. Ask a space admin to add people here before starting the first chat.',
      messengerFreshTitle: 'This messenger space starts clean',
      metaGroup: 'Group',
      noActivityYet: 'No activity yet',
      pullToRefresh: 'Pull to refresh chats',
      refreshing: 'Refreshing chats...',
      releaseToRefresh: 'Release to refresh',
      restore: 'Show in inbox',
      searchAria: 'Search chats',
      searchDmAria: 'Search direct messages',
      searchDmPlaceholder: 'Search direct messages',
      searchEncryptedNote:
        'Encrypted direct-message text is not searchable here yet.',
      searchPlaceholder: 'Search chats or people',
      searchResultChat: (count) =>
        `${count} ${count === 1 ? 'chat' : 'chats'}`,
      searchResultPerson: (count) =>
        `${count} ${count === 1 ? 'person' : 'people'}`,
      searchSummaryNone: 'No chats or people',
      settingsAria: 'Open settings',
      unreadAria: 'Unread messages',
      yesterday: 'Yesterday',
    },
    settings: {
      chooseAnotherSpace: 'Choose another space',
      currentSpaceLabel: 'Current space',
    },
    shell: {
      retry: 'Try again',
    },
    spaces: {
      manageMembersAction: 'Manage members',
    },
  },
  ru: {
    chat: {
      attachment: 'Файл',
      audio: 'Аудио',
      deletedMessage: 'Удалённое сообщение',
      directChat: 'Личный чат',
      encryptedMessage: 'Зашифрованное сообщение',
      file: 'Файл',
      newEncryptedMessage: 'Новое зашифрованное сообщение',
      newMessage: 'Новое сообщение',
      photo: 'Фото',
      unknownUser: 'Неизвестный пользователь',
      voiceMessage: 'Голосовое сообщение',
    },
    inbox: {
      archivedNote:
        'Архивные чаты только скрыты из списка. Сообщения остаются, и их можно вернуть в любой момент.',
      clear: 'Очистить',
      create: {
        close: 'Закрыть',
        closeAria: 'Закрыть создание чата',
        createDm: 'Создать личный чат',
        createGroup: 'Создать группу',
        direct: 'Личный чат',
        existingDmOnly:
          'Со всеми доступными людьми у вас уже есть личные чаты.',
        group: 'Групповой чат',
        groupNamePlaceholder: 'Планы на выходные',
        groupSelectionCount: (count) => `Выбрано: ${count}`,
        groupSelectionEmpty: 'Выберите хотя бы одного человека.',
        groupSubtitle: 'Дайте название и выберите участников.',
        groupTitle: 'Групповой чат',
        loadingCandidates: 'Загружаем людей...',
        loadingCandidatesFailed:
          'Сейчас не удаётся загрузить людей. Попробуйте ещё раз.',
        messageSelection: (label) => `Написать ${label}.`,
        modeAria: 'Режим нового чата',
        noMatches: 'Подходящих людей нет.',
        noUsers: 'Других зарегистрированных пользователей пока нет.',
        noUsersAdmin:
          'В этом пространстве пока нет других доступных участников. Сначала добавьте людей в это пространство, а затем вернитесь сюда, чтобы начать чаты.',
        peopleSubtitle: 'Выберите одного человека, чтобы начать чат.',
        peopleTitle: 'Люди',
        searchAria: 'Поиск людей',
        searchPlaceholder: 'Поиск людей',
        selected: 'Выбрано',
        subtitle: 'Выберите личный чат или создайте группу.',
        title: 'Новый чат',
      },
      createAria: 'Начать чат',
      emptyArchivedBody: 'Сюда попадут чаты, которые вы скрыли из списка.',
      emptyArchivedSearchTitle: 'Подходящих архивных чатов нет',
      emptyArchivedTitle: 'Архивных чатов нет',
      emptyMainBody: 'Начните новый через кнопку +.',
      emptyMainTitle: 'Здесь пока нет чатов',
      emptySearchBody: 'Попробуйте другой поиск или фильтр.',
      emptySearchTitle: 'Подходящих чатов нет',
      filters: {
        all: 'Все',
        archived: 'Архив',
        dm: 'Личные',
        groups: 'Группы',
        inbox: 'Чаты',
      },
      filtersAria: 'Фильтры чатов',
      messengerFreshAdminBody:
        'Сначала добавьте участников в это пространство, а затем начните здесь первый личный чат или группу. Ничего не копируется автоматически из TEST или любого другого пространства.',
      messengerFreshBody:
        'Начните здесь первый личный чат или группу. История из TEST или любого другого пространства сюда не копируется.',
      messengerFreshMemberBody:
        'В этом пространстве пока нет других видимых участников. Попросите администратора пространства добавить людей, прежде чем начинать первый чат.',
      messengerFreshTitle: 'Это пространство мессенджера начинается с нуля',
      metaGroup: 'Группа',
      noActivityYet: 'Пока без активности',
      pullToRefresh: 'Потяните вниз, чтобы обновить чаты',
      refreshing: 'Обновляем чаты...',
      releaseToRefresh: 'Отпустите, чтобы обновить',
      restore: 'Вернуть в чаты',
      searchAria: 'Искать чаты',
      searchDmAria: 'Искать личные чаты',
      searchDmPlaceholder: 'Искать личные чаты',
      searchEncryptedNote:
        'Текст в зашифрованных личных сообщениях здесь пока не ищется.',
      searchPlaceholder: 'Искать чаты или людей',
      searchResultChat: (count) =>
        `${count} ${getRussianCountWord(count, ['чат', 'чата', 'чатов'])}`,
      searchResultPerson: (count) =>
        `${count} ${getRussianCountWord(count, ['человек', 'человека', 'человек'])}`,
      searchSummaryNone: 'Нет чатов или людей',
      settingsAria: 'Открыть настройки',
      unreadAria: 'Непрочитанные сообщения',
      yesterday: 'Вчера',
    },
    settings: {
      chooseAnotherSpace: 'Выбрать другое пространство',
      currentSpaceLabel: 'Текущее пространство',
    },
    shell: {
      retry: 'Попробовать снова',
    },
    spaces: {
      manageMembersAction: 'Управлять участниками',
    },
  },
};

export function getInboxClientTranslations(
  language: AppLanguage,
): InboxClientTranslations {
  return INBOX_CLIENT_TRANSLATIONS[language];
}

export type { AppLanguage };
