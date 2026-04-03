export const LANGUAGE_COOKIE_NAME = 'chat_lang';
export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type LanguageDictionary = {
  locale: string;
  languageSwitcher: {
    en: string;
    ru: string;
    label: string;
  };
  publicHome: {
    title: string;
    subtitle: string;
    openChats: string;
    openSettings: string;
    logIn: string;
    watermark: string;
    authActionsAria: string;
    guestActionsAria: string;
  };
  login: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    submit: string;
    managedAccess: string;
    backToHome: string;
    signupRedirectMessage: string;
  };
  settings: {
    backToChats: string;
    heroEyebrow: string;
    heroNote: string;
    profileTitle: string;
    profileSubtitle: string;
    profilePhoto: string;
    displayName: string;
    displayNamePlaceholder: string;
    profilePhotoNote: string;
    saveChanges: string;
    profileFallback: string;
    languageTitle: string;
    languageSubtitle: string;
    languageEnglish: string;
    languageRussian: string;
    languageSaveEnglish: string;
    languageSaveRussian: string;
    logoutTitle: string;
    logoutSubtitle: string;
    logoutButton: string;
    profileUpdated: string;
    languageUpdated: string;
  };
  notifications: {
    title: string;
    subtitle: string;
    checkingBody: string;
    checkingBadge: string;
    unsupportedBody: string;
    unsupportedBadge: string;
    blockedBody: string;
    blockedBadge: string;
    enabledBody: string;
    enabledBadge: string;
    availableBody: string;
    availableBadge: string;
    unavailable: string;
    available: string;
    on: string;
    off: string;
    checking: string;
    status: string;
    permission: string;
    turnOn: string;
    turningOn: string;
    browserSettingsNote: string;
    comingSoonNote: string;
    availableNote: string;
  };
  inbox: {
    title: string;
    subtitleNew: (count: number) => string;
    subtitleCaughtUp: string;
    subtitleStart: string;
    subtitleArchivedCount: (count: number) => string;
    subtitleArchivedEmpty: string;
    settingsAria: string;
    createAria: string;
    searchAria: string;
    filtersAria: string;
    searchPlaceholder: string;
    filters: {
      all: string;
      dm: string;
      groups: string;
      archived: string;
      inbox: string;
    };
    searchSummaryNone: string;
    searchResultChat: (count: number) => string;
    searchResultPerson: (count: number) => string;
    clear: string;
    archivedNote: string;
    emptyMainTitle: string;
    emptyMainBody: string;
    emptyArchivedTitle: string;
    emptyArchivedBody: string;
    emptySearchTitle: string;
    emptyArchivedSearchTitle: string;
    emptySearchBody: string;
    unreadAria: string;
    restore: string;
    metaGroup: string;
    metaArchived: string;
    noActivityYet: string;
    newRecency: string;
    yesterday: string;
    dmPreviewExisting: (label: string) => string;
    dmPreviewNew: (label: string) => string;
    dmPreviewFallback: string;
    groupPreviewExisting: string;
    groupPreviewNew: string;
    create: {
      title: string;
      subtitle: string;
      closeAria: string;
      close: string;
      modeAria: string;
      direct: string;
      group: string;
      peopleTitle: string;
      peopleSubtitle: string;
      noUsers: string;
      noMatches: string;
      selected: string;
      choose: string;
      add: string;
      messageSelection: (label: string) => string;
      createDm: string;
      groupTitle: string;
      groupSubtitle: string;
      groupNamePlaceholder: string;
      groupSelectionEmpty: string;
      groupSelectionCount: (count: number) => string;
      createGroup: string;
    };
  };
  chat: {
    backToChats: string;
    openInfoAria: (title: string) => string;
    directChat: string;
    person: string;
    group: string;
    infoTitle: string;
    infoEyebrow: string;
    done: string;
    closeInfo: string;
    startedAt: (value: string) => string;
    type: string;
    members: string;
    started: string;
    people: string;
    inThisChat: string;
    groupSection: string;
    nameAndPeople: string;
    name: string;
    ownerOnly: string;
    groupNamePlaceholder: string;
    saveName: string;
    addPeople: string;
    everyoneIsHere: string;
    leaveGroup: string;
    leaveGroupButton: string;
    notifications: string;
    notificationsNote: string;
    notificationsDefault: string;
    notificationsDefaultNote: string;
    notificationsMuted: string;
    notificationsMutedNote: string;
    inbox: string;
    inboxNote: string;
    hideFromInbox: string;
    noMessagesYet: string;
    unreadMessages: string;
    today: string;
    yesterday: string;
    earlier: string;
    unknown: string;
    unknownSender: string;
    someone: string;
    you: string;
    emptyMessage: string;
    image: string;
    audio: string;
    voiceMessage: string;
    attachment: string;
    file: string;
    unavailableRightNow: string;
    justNow: string;
    edited: string;
    sent: string;
    seen: string;
    openMessageActions: string;
    closeMessageActions: string;
    earlierMessage: string;
    deletedMessage: string;
    messageDeleted: string;
    thisMessageWasDeleted: string;
    replyingTo: string;
    cancel: string;
    messagePlaceholder: string;
    save: string;
    delete: string;
    deleteConfirm: string;
    chooseAction: string;
    replyMessage: string;
    reply: string;
    edit: string;
    remove: string;
    owner: string;
    admin: string;
    member: string;
    attachmentOptions: string;
    photoOrFile: string;
    camera: string;
    soon: string;
    clearAttachment: string;
    attachmentSizeError: (maxSizeLabel: string) => string;
    activeNow: string;
    typingSingle: (label: string) => string;
    typingDouble: (left: string, right: string) => string;
    typingSeveral: string;
    sendMessage: string;
    messageReactions: string;
  };
};

export const translations: Record<AppLanguage, LanguageDictionary> = {
  en: {
    locale: 'en-US',
    languageSwitcher: {
      en: 'EN',
      ru: 'RU',
      label: 'Language',
    },
    publicHome: {
      title: 'Start your conversation',
      subtitle:
        'A calm place for direct messages and groups, for people already set up to use it.',
      openChats: 'Open chats',
      openSettings: 'Open settings',
      logIn: 'Log in',
      watermark: 'Chat by Build With Care',
      authActionsAria: 'Primary actions',
      guestActionsAria: 'Get started',
    },
    login: {
      title: 'Log in',
      subtitle: 'Use the account details that were set up for you.',
      email: 'Email',
      password: 'Password',
      submit: 'Log in',
      managedAccess: 'Need access? Ask the operator to add your account.',
      backToHome: 'Back to home',
      signupRedirectMessage: 'Access is managed for you. Log in with an existing account.',
    },
    settings: {
      backToChats: 'Back to chats',
      heroEyebrow: 'You',
      heroNote: 'Photo, name, alerts, and account.',
      profileTitle: 'Profile',
      profileSubtitle: 'Photo and name',
      profilePhoto: 'Profile photo',
      displayName: 'Display name',
      displayNamePlaceholder: 'Your name',
      profilePhotoNote: 'JPG, PNG, WEBP, or GIF, up to 5 MB.',
      saveChanges: 'Save changes',
      profileFallback: 'Your profile',
      languageTitle: 'Language',
      languageSubtitle: 'Choose how the app reads on this device.',
      languageEnglish: 'English',
      languageRussian: 'Russian',
      languageSaveEnglish: 'Use English',
      languageSaveRussian: 'Use Russian',
      logoutTitle: 'Log out',
      logoutSubtitle: 'Sign out on this device',
      logoutButton: 'Log out',
      profileUpdated: 'Profile updated.',
      languageUpdated: 'Language updated.',
    },
    notifications: {
      title: 'Notifications',
      subtitle: 'Alerts for this device.',
      checkingBody: 'Checking this device.',
      checkingBadge: 'Checking',
      unsupportedBody: 'Not available here right now.',
      unsupportedBadge: 'Unsupported',
      blockedBody: 'Turned off in your browser settings.',
      blockedBadge: 'Off',
      enabledBody: 'On for this device.',
      enabledBadge: 'On',
      availableBody: 'Available for this device.',
      availableBadge: 'Available',
      unavailable: 'Unavailable',
      available: 'Available',
      on: 'On',
      off: 'Off',
      checking: 'Checking',
      status: 'Status',
      permission: 'Permission',
      turnOn: 'Turn on notifications',
      turningOn: 'Turning on…',
      browserSettingsNote: 'You can change this later in browser settings.',
      comingSoonNote: 'Message alerts are coming soon.',
      availableNote: 'You can turn this on now. Message alerts are coming soon.',
    },
    inbox: {
      title: 'Chats',
      subtitleNew: (count) => `${count} new`,
      subtitleCaughtUp: 'All caught up',
      subtitleStart: 'Start a chat',
      subtitleArchivedCount: (count) => `${count} hidden from your inbox`,
      subtitleArchivedEmpty: 'Hidden chats stay here',
      settingsAria: 'Open settings',
      createAria: 'Start a chat',
      searchAria: 'Search chats',
      filtersAria: 'Chat filters',
      searchPlaceholder: 'Search chats or people',
      filters: {
        all: 'All',
        dm: 'DM',
        groups: 'Groups',
        archived: 'Archived',
        inbox: 'Inbox',
      },
      searchSummaryNone: 'No chats or people',
      searchResultChat: (count) => `${count} ${count === 1 ? 'chat' : 'chats'}`,
      searchResultPerson: (count) => `${count} ${count === 1 ? 'person' : 'people'}`,
      clear: 'Clear',
      archivedNote:
        'Archived chats are only hidden from your inbox. They still keep their messages and can return anytime.',
      emptyMainTitle: 'No chats here',
      emptyMainBody: 'Start one from the + button.',
      emptyArchivedTitle: 'No archived chats',
      emptyArchivedBody: 'Chats you hide from your inbox will appear here.',
      emptySearchTitle: 'No matching chats',
      emptyArchivedSearchTitle: 'No matching archived chats',
      emptySearchBody: 'Try another search or filter.',
      unreadAria: 'Unread messages',
      restore: 'Show in inbox',
      metaGroup: 'Group',
      metaArchived: 'Archived',
      noActivityYet: 'No activity yet',
      newRecency: 'New',
      yesterday: 'Yesterday',
      dmPreviewExisting: (label) => `Chat with ${label}`,
      dmPreviewNew: (label) => `Say hi to ${label}`,
      dmPreviewFallback: 'Start a chat',
      groupPreviewExisting: 'Group chat',
      groupPreviewNew: 'Start the group',
      create: {
        title: 'New chat',
        subtitle: 'Choose a direct message or start a group.',
        closeAria: 'Close create chat',
        close: 'Close',
        modeAria: 'New chat mode',
        direct: 'Direct message',
        group: 'Group chat',
        peopleTitle: 'People',
        peopleSubtitle: 'Pick one person to start chatting.',
        noUsers: 'No other registered users are available yet.',
        noMatches: 'No matching people yet.',
        selected: 'Selected',
        choose: 'Choose',
        add: 'Add',
        messageSelection: (label) => `Message ${label}.`,
        createDm: 'Create DM',
        groupTitle: 'Group chat',
        groupSubtitle: 'Name it and choose who should be in it.',
        groupNamePlaceholder: 'Weekend planning',
        groupSelectionEmpty: 'Select at least one person.',
        groupSelectionCount: (count) => `${count} selected`,
        createGroup: 'Create group',
      },
    },
    chat: {
      backToChats: 'Back to chats',
      openInfoAria: (title) => `Open info for ${title}`,
      directChat: 'Direct chat',
      person: 'Person',
      group: 'Group',
      infoTitle: 'Info',
      infoEyebrow: 'Chat',
      done: 'Done',
      closeInfo: 'Close chat info',
      startedAt: (value) => `Started ${value}`,
      type: 'Type',
      members: 'Members',
      started: 'Started',
      people: 'People',
      inThisChat: 'In this chat',
      groupSection: 'Group',
      nameAndPeople: 'Name and people.',
      name: 'Name',
      ownerOnly: 'Owner only.',
      groupNamePlaceholder: 'Enter a group name',
      saveName: 'Save name',
      addPeople: 'Add people',
      everyoneIsHere: 'Everyone is already here.',
      leaveGroup: 'Leave group',
      leaveGroupButton: 'Leave group',
      notifications: 'Notifications',
      notificationsNote: 'How this chat notifies you.',
      notificationsDefault: 'Default',
      notificationsDefaultNote: 'Use your usual setting.',
      notificationsMuted: 'Muted',
      notificationsMutedNote: 'Keep this chat quieter.',
      inbox: 'Inbox',
      inboxNote: 'Hide this chat from your inbox only.',
      hideFromInbox: 'Hide from inbox',
      noMessagesYet: 'No messages yet',
      unreadMessages: 'Unread messages',
      today: 'Today',
      yesterday: 'Yesterday',
      earlier: 'Earlier',
      unknown: 'Unknown',
      unknownSender: 'Unknown sender',
      someone: 'Someone',
      you: 'You',
      emptyMessage: 'Empty message',
      image: 'Image',
      audio: 'Audio',
      voiceMessage: 'Voice message',
      attachment: 'Attachment',
      file: 'File',
      unavailableRightNow: 'Unavailable right now',
      justNow: 'Just now',
      edited: 'Edited',
      sent: 'Sent',
      seen: 'Seen',
      openMessageActions: 'Open message actions',
      closeMessageActions: 'Close message actions',
      earlierMessage: 'Earlier message',
      deletedMessage: 'Deleted message',
      messageDeleted: 'Message deleted',
      thisMessageWasDeleted: 'This message was deleted.',
      replyingTo: 'Replying to',
      cancel: 'Cancel',
      messagePlaceholder: 'Message',
      save: 'Save',
      delete: 'Delete',
      deleteConfirm: 'Delete this message for everyone in this chat?',
      chooseAction: 'Choose an action',
      replyMessage: 'Reply message',
      reply: 'Reply',
      edit: 'Edit',
      remove: 'Remove',
      owner: 'Owner',
      admin: 'Admin',
      member: 'Member',
      attachmentOptions: 'Attachment options',
      photoOrFile: 'Photo or file',
      camera: 'Camera',
      soon: 'Soon',
      clearAttachment: 'Clear',
      attachmentSizeError: (maxSizeLabel) =>
        `Choose a file up to ${maxSizeLabel.toLowerCase()}.`,
      activeNow: 'Active now',
      typingSingle: (label) => `${label} is typing`,
      typingDouble: (left, right) => `${left} and ${right} are typing`,
      typingSeveral: 'Several people are typing',
      sendMessage: 'Send message',
      messageReactions: 'Message reactions',
    },
  },
  ru: {
    locale: 'ru-RU',
    languageSwitcher: {
      en: 'EN',
      ru: 'RU',
      label: 'Язык',
    },
    publicHome: {
      title: 'Начните разговор',
      subtitle:
        'Спокойное пространство для личных и групповых чатов, для людей с уже созданным доступом.',
      openChats: 'Открыть чаты',
      openSettings: 'Открыть профиль',
      logIn: 'Войти',
      watermark: 'Chat by Build With Care',
      authActionsAria: 'Основные действия',
      guestActionsAria: 'Начало работы',
    },
    login: {
      title: 'Войти',
      subtitle: 'Используйте данные аккаунта, которые вам уже настроили.',
      email: 'Email',
      password: 'Пароль',
      submit: 'Войти',
      managedAccess: 'Нужен доступ? Попросите оператора добавить ваш аккаунт.',
      backToHome: 'Назад на главную',
      signupRedirectMessage:
        'Доступ выдается вручную. Войдите с существующим аккаунтом.',
    },
    settings: {
      backToChats: 'Назад к чатам',
      heroEyebrow: 'Вы',
      heroNote: 'Фото, имя, уведомления и аккаунт.',
      profileTitle: 'Профиль',
      profileSubtitle: 'Фото и имя',
      profilePhoto: 'Фото профиля',
      displayName: 'Отображаемое имя',
      displayNamePlaceholder: 'Ваше имя',
      profilePhotoNote: 'JPG, PNG, WEBP или GIF, до 5 МБ.',
      saveChanges: 'Сохранить',
      profileFallback: 'Ваш профиль',
      languageTitle: 'Язык',
      languageSubtitle: 'Выберите язык приложения на этом устройстве.',
      languageEnglish: 'English',
      languageRussian: 'Русский',
      languageSaveEnglish: 'Использовать English',
      languageSaveRussian: 'Использовать русский',
      logoutTitle: 'Выйти',
      logoutSubtitle: 'Выйти на этом устройстве',
      logoutButton: 'Выйти',
      profileUpdated: 'Профиль обновлён.',
      languageUpdated: 'Язык обновлён.',
    },
    notifications: {
      title: 'Уведомления',
      subtitle: 'Оповещения для этого устройства.',
      checkingBody: 'Проверяем это устройство.',
      checkingBadge: 'Проверка',
      unsupportedBody: 'Сейчас здесь недоступно.',
      unsupportedBadge: 'Недоступно',
      blockedBody: 'Отключено в настройках браузера.',
      blockedBadge: 'Выключено',
      enabledBody: 'Включено для этого устройства.',
      enabledBadge: 'Включено',
      availableBody: 'Доступно для этого устройства.',
      availableBadge: 'Доступно',
      unavailable: 'Недоступно',
      available: 'Доступно',
      on: 'Вкл',
      off: 'Выкл',
      checking: 'Проверка',
      status: 'Статус',
      permission: 'Разрешение',
      turnOn: 'Включить уведомления',
      turningOn: 'Включаем…',
      browserSettingsNote: 'Позже это можно изменить в настройках браузера.',
      comingSoonNote: 'Оповещения о сообщениях появятся позже.',
      availableNote: 'Можно включить уже сейчас. Оповещения о сообщениях появятся позже.',
    },
    inbox: {
      title: 'Чаты',
      subtitleNew: (count) => `${count} новых`,
      subtitleCaughtUp: 'Новых сообщений нет',
      subtitleStart: 'Начните чат',
      subtitleArchivedCount: (count) => `${count} скрыто из входящих`,
      subtitleArchivedEmpty: 'Скрытые чаты будут здесь',
      settingsAria: 'Открыть настройки',
      createAria: 'Начать чат',
      searchAria: 'Искать чаты',
      filtersAria: 'Фильтры чатов',
      searchPlaceholder: 'Искать чаты или людей',
      filters: {
        all: 'Все',
        dm: 'Личные',
        groups: 'Группы',
        archived: 'Архив',
        inbox: 'Чаты',
      },
      searchSummaryNone: 'Нет чатов или людей',
      searchResultChat: (count) => `${count} ${getRussianCountWord(count, ['чат', 'чата', 'чатов'])}`,
      searchResultPerson: (count) => `${count} ${getRussianCountWord(count, ['человек', 'человека', 'человек'])}`,
      clear: 'Очистить',
      archivedNote:
        'Архивные чаты только скрыты из списка. Сообщения остаются, и их можно вернуть в любой момент.',
      emptyMainTitle: 'Здесь пока нет чатов',
      emptyMainBody: 'Начните новый через кнопку +.',
      emptyArchivedTitle: 'Архивных чатов нет',
      emptyArchivedBody: 'Сюда попадут чаты, которые вы скрыли из списка.',
      emptySearchTitle: 'Подходящих чатов нет',
      emptyArchivedSearchTitle: 'Подходящих архивных чатов нет',
      emptySearchBody: 'Попробуйте другой поиск или фильтр.',
      unreadAria: 'Непрочитанные сообщения',
      restore: 'Вернуть в чаты',
      metaGroup: 'Группа',
      metaArchived: 'Архив',
      noActivityYet: 'Пока без активности',
      newRecency: 'Новое',
      yesterday: 'Вчера',
      dmPreviewExisting: (label) => `Чат с ${label}`,
      dmPreviewNew: (label) => `Напишите ${label}`,
      dmPreviewFallback: 'Начните чат',
      groupPreviewExisting: 'Групповой чат',
      groupPreviewNew: 'Начните группу',
      create: {
        title: 'Новый чат',
        subtitle: 'Выберите личный чат или создайте группу.',
        closeAria: 'Закрыть создание чата',
        close: 'Закрыть',
        modeAria: 'Режим нового чата',
        direct: 'Личный чат',
        group: 'Групповой чат',
        peopleTitle: 'Люди',
        peopleSubtitle: 'Выберите одного человека, чтобы начать чат.',
        noUsers: 'Других зарегистрированных пользователей пока нет.',
        noMatches: 'Подходящих людей нет.',
        selected: 'Выбрано',
        choose: 'Выбрать',
        add: 'Добавить',
        messageSelection: (label) => `Написать ${label}.`,
        createDm: 'Создать личный чат',
        groupTitle: 'Групповой чат',
        groupSubtitle: 'Дайте название и выберите участников.',
        groupNamePlaceholder: 'Планы на выходные',
        groupSelectionEmpty: 'Выберите хотя бы одного человека.',
        groupSelectionCount: (count) => `Выбрано: ${count}`,
        createGroup: 'Создать группу',
      },
    },
    chat: {
      backToChats: 'Назад к чатам',
      openInfoAria: (title) => `Открыть информацию о чате ${title}`,
      directChat: 'Личный чат',
      person: 'Человек',
      group: 'Группа',
      infoTitle: 'Информация',
      infoEyebrow: 'Чат',
      done: 'Готово',
      closeInfo: 'Закрыть информацию о чате',
      startedAt: (value) => `Начат ${value}`,
      type: 'Тип',
      members: 'Участники',
      started: 'Начат',
      people: 'Люди',
      inThisChat: 'В этом чате',
      groupSection: 'Группа',
      nameAndPeople: 'Название и участники.',
      name: 'Название',
      ownerOnly: 'Только владелец.',
      groupNamePlaceholder: 'Введите название группы',
      saveName: 'Сохранить',
      addPeople: 'Добавить людей',
      everyoneIsHere: 'Все уже здесь.',
      leaveGroup: 'Покинуть группу',
      leaveGroupButton: 'Покинуть группу',
      notifications: 'Уведомления',
      notificationsNote: 'Как этот чат уведомляет вас.',
      notificationsDefault: 'По умолчанию',
      notificationsDefaultNote: 'Использовать обычную настройку.',
      notificationsMuted: 'Без звука',
      notificationsMutedNote: 'Сделать этот чат тише.',
      inbox: 'Входящие',
      inboxNote: 'Скрыть этот чат только из списка.',
      hideFromInbox: 'Скрыть из чатов',
      noMessagesYet: 'Пока нет сообщений',
      unreadMessages: 'Непрочитанные сообщения',
      today: 'Сегодня',
      yesterday: 'Вчера',
      earlier: 'Раньше',
      unknown: 'Неизвестно',
      unknownSender: 'Неизвестный отправитель',
      someone: 'Кто-то',
      you: 'Вы',
      emptyMessage: 'Пустое сообщение',
      image: 'Изображение',
      audio: 'Аудио',
      voiceMessage: 'Голосовое сообщение',
      attachment: 'Файл',
      file: 'Файл',
      unavailableRightNow: 'Сейчас недоступно',
      justNow: 'Только что',
      edited: 'Изменено',
      sent: 'Отправлено',
      seen: 'Просмотрено',
      openMessageActions: 'Открыть действия с сообщением',
      closeMessageActions: 'Закрыть действия с сообщением',
      earlierMessage: 'Раннее сообщение',
      deletedMessage: 'Удалённое сообщение',
      messageDeleted: 'Сообщение удалено',
      thisMessageWasDeleted: 'Это сообщение было удалено.',
      replyingTo: 'Ответ на',
      cancel: 'Отмена',
      messagePlaceholder: 'Сообщение',
      save: 'Сохранить',
      delete: 'Удалить',
      deleteConfirm: 'Удалить это сообщение для всех в чате?',
      chooseAction: 'Выберите действие',
      replyMessage: 'Ответить',
      reply: 'Ответить',
      edit: 'Изменить',
      remove: 'Удалить',
      owner: 'Владелец',
      admin: 'Админ',
      member: 'Участник',
      attachmentOptions: 'Вложения',
      photoOrFile: 'Фото или файл',
      camera: 'Камера',
      soon: 'Скоро',
      clearAttachment: 'Убрать',
      attachmentSizeError: (maxSizeLabel) =>
        `Выберите файл до ${maxSizeLabel.toLowerCase()}.`,
      activeNow: 'Сейчас в чате',
      typingSingle: (label) => `${label} печатает`,
      typingDouble: (left, right) => `${left} и ${right} печатают`,
      typingSeveral: 'Пишут несколько человек',
      sendMessage: 'Отправить сообщение',
      messageReactions: 'Реакции на сообщение',
    },
  },
};

export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return value === 'ru' ? 'ru' : DEFAULT_LANGUAGE;
}

export function getTranslations(language: AppLanguage) {
  return translations[language];
}

export function getLocaleForLanguage(language: AppLanguage) {
  return translations[language].locale;
}

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

export function formatMemberCount(language: AppLanguage, count: number) {
  if (language === 'ru') {
    return `${count} ${getRussianCountWord(count, ['участник', 'участника', 'участников'])}`;
  }

  return `${count} member${count === 1 ? '' : 's'}`;
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
