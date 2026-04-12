import type { AppLanguage } from './index';

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

type ChatClientLabels = {
  activeNow: string;
  attachment: string;
  attachmentOptions: string;
  attachmentSizeError: (maxSizeLabel: string) => string;
  audio: string;
  camera: string;
  cancel: string;
  photoLibrary: string;
  clearAttachment: string;
  closePhotoPreview: string;
  delete: string;
  deleteConfirm: string;
  deletedMessage: string;
  delivered: string;
  directChat: string;
  earlier: string;
  earlierMessage: string;
  edited: string;
  emptyMessage: string;
  encryptedEditUnavailable: string;
  encryptedHistoryPolicyBlockedNote: string;
  encryptedHistoryUnavailableNote: string;
  encryptedMessage: string;
  encryptedMessageSetupUnavailable: string;
  encryptedMessageUnavailable: string;
  encryptedReplyInfo: string;
  encryptionNeedsRefresh: string;
  encryptionRolloutUnavailable: string;
  encryptionSessionChanged: string;
  encryptionSetupUnavailable: string;
  encryptionUnavailableHere: string;
  file: string;
  jumpToLatest: string;
  justNow: string;
  loadingOlderMessages: string;
  messageDeleted: string;
  messageQueued: string;
  messageReactions: string;
  microphone: string;
  newEncryptedMessage: string;
  newMessage: string;
  noMessagesYet: string;
  olderEncryptedMessage: string;
  olderMessagesAutoLoad: string;
  openPhotoPreviewAria: (title: string) => string;
  photo: string;
  refreshEncryptedSetup: string;
  reloadConversation: string;
  remove: string;
  reply: string;
  replyToEncryptedMessage: string;
  replyingTo: string;
  resetEncryptedSetupDev: string;
  retryEncryptedAction: string;
  retrySend: string;
  save: string;
  seen: string;
  sendFailed: string;
  sending: string;
  sendMessage: string;
  sent: string;
  someone: string;
  thisMessageWasDeleted: string;
  today: string;
  typingDouble: (left: string, right: string) => string;
  typingSeveral: string;
  typingSingle: (label: string) => string;
  unableToSendEncryptedMessage: string;
  unavailableRightNow: string;
  unknownUser: string;
  voiceMessage: string;
  voiceMessageFailed: string;
  voiceMessageLoading: string;
  voiceMessagePause: string;
  voiceMessagePending: string;
  voiceMessagePendingHint: string;
  voiceMessagePlay: string;
  voiceMessageProcessing: string;
  voiceMessageRetryHint: string;
  voiceMessageUnavailable: string;
  voiceMessageUnsupported: string;
  voiceMessageUploading: string;
  voiceRecorderDraftReady: string;
  voiceRecorderFailed: string;
  voiceRecorderPermissionDenied: string;
  voiceRecorderPermissionHint: string;
  voiceRecorderPreparing: string;
  voiceRecorderPreparingHint: string;
  voiceRecorderRecording: string;
  voiceRecorderRecordingHint: string;
  voiceRecorderRecoveredDraftHint: string;
  voiceRecorderRetry: string;
  voiceRecorderRetryHint: string;
  voiceRecorderStop: string;
  voiceRecorderUnavailable: string;
  voiceRecorderUnavailableHint: string;
  unreadMessages: string;
  yesterday: string;
  recipientEncryptionUnavailable: string;
};

export type ChatClientTranslations = {
  chat: ChatClientLabels;
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
  chat: Pick<
    ChatClientLabels,
    | 'attachment'
    | 'audio'
    | 'deletedMessage'
    | 'directChat'
    | 'encryptedMessage'
    | 'file'
    | 'newEncryptedMessage'
    | 'newMessage'
    | 'photo'
    | 'unknownUser'
    | 'voiceMessage'
  >;
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

const CLIENT_LOCALES: Record<AppLanguage, string> = {
  en: 'en-US',
  ru: 'ru-RU',
};

function getRussianCountWord(
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

const CHAT_CLIENT_TRANSLATIONS: Record<AppLanguage, ChatClientTranslations> = {
  en: {
    chat: {
      activeNow: 'Active now',
      attachment: 'Attachment',
      attachmentOptions: 'Attachment options',
      attachmentSizeError: (maxSizeLabel) =>
        `Choose a file up to ${maxSizeLabel.toLowerCase()}.`,
      audio: 'Audio',
      camera: 'Camera',
      cancel: 'Cancel',
      clearAttachment: 'Clear',
      closePhotoPreview: 'Close photo preview',
      delete: 'Delete',
      deleteConfirm: 'Delete this message for everyone in this chat?',
      deletedMessage: 'Deleted message',
      delivered: 'Delivered',
      directChat: 'Direct chat',
      earlier: 'Earlier',
      earlierMessage: 'Earlier message',
      edited: 'Edited',
      emptyMessage: 'Empty message',
      encryptedEditUnavailable:
        'Editing encrypted direct messages is not available yet.',
      encryptedHistoryPolicyBlockedNote:
        'Sent before your current access to this chat.',
      encryptedHistoryUnavailableNote:
        'Not available on this device. New messages in this chat still work.',
      encryptedMessage: 'Encrypted message',
      encryptedMessageSetupUnavailable:
        'This encrypted message is not available on this device right now.',
      encryptedMessageUnavailable:
        'Encrypted message is not available on this device.',
      encryptedReplyInfo:
        'Replies keep the message reference, not the encrypted text.',
      encryptionNeedsRefresh:
        'Encrypted DM setup on this device needs to refresh. Try again.',
      encryptionRolloutUnavailable:
        'Encrypted direct messages are not enabled for this account yet.',
      encryptionSessionChanged: 'Encrypted DM setup changed. Try sending again.',
      encryptionSetupUnavailable: 'Encrypted DM setup is not ready yet.',
      encryptionUnavailableHere:
        'Encrypted DM sending is not available in this browser.',
      file: 'File',
      jumpToLatest: 'Jump to latest messages',
      justNow: 'Just now',
      loadingOlderMessages: 'Loading older messages...',
      messageDeleted: 'Message deleted',
      messageQueued: 'Queued on this device',
      messageReactions: 'Message reactions',
      microphone: 'Voice message',
      newEncryptedMessage: 'New encrypted message',
      newMessage: 'New message',
      noMessagesYet: 'No messages yet',
      olderEncryptedMessage: 'Older encrypted message',
      olderMessagesAutoLoad: 'Older messages will load automatically.',
      openPhotoPreviewAria: (title) => `Open photo preview for ${title}`,
      photo: 'Photo',
      photoLibrary: 'Photos',
      recipientEncryptionUnavailable:
        'This person is not ready for encrypted direct messages yet.',
      refreshEncryptedSetup: 'Refresh encrypted setup',
      reloadConversation: 'Reload chat',
      remove: 'Remove',
      reply: 'Reply',
      replyToEncryptedMessage: 'Reply to encrypted message',
      replyingTo: 'Replying to',
      resetEncryptedSetupDev: 'Reset encrypted setup (dev)',
      retryEncryptedAction: 'Retry',
      retrySend: 'Retry',
      save: 'Save',
      seen: 'Seen',
      sendFailed: 'Failed to send',
      sending: 'Sending…',
      sendMessage: 'Send message',
      sent: 'Sent',
      someone: 'Someone',
      thisMessageWasDeleted: 'This message was deleted.',
      today: 'Today',
      typingDouble: (left, right) => `${left} and ${right} are typing`,
      typingSeveral: 'Several people are typing',
      typingSingle: (label) => `${label} is typing`,
      unableToSendEncryptedMessage: 'Unable to send encrypted message.',
      unavailableRightNow: 'Unavailable right now',
      unknownUser: 'Unknown user',
      unreadMessages: 'Unread messages',
      voiceMessage: 'Voice message',
      voiceMessageFailed: 'Voice message is not available right now.',
      voiceMessageLoading: 'Loading voice message',
      voiceMessagePause: 'Pause voice message',
      voiceMessagePending: 'Voice message pending',
      voiceMessagePendingHint:
        'Keep this chat open while the audio finishes syncing.',
      voiceMessagePlay: 'Play voice message',
      voiceMessageProcessing: 'Preparing voice message',
      voiceMessageRetryHint: 'Tap again if the audio still does not load.',
      voiceMessageUnavailable: 'Voice message is unavailable on this device.',
      voiceMessageUnsupported: 'Voice format is not supported here.',
      voiceMessageUploading: 'Uploading voice message',
      voiceRecorderDraftReady: 'Ready to send',
      voiceRecorderFailed: 'Could not finish the recording.',
      voiceRecorderPermissionDenied: 'Microphone access is blocked.',
      voiceRecorderPermissionHint: 'Allow microphone access, then try again.',
      voiceRecorderPreparing: 'Preparing…',
      voiceRecorderPreparingHint: 'Waiting for microphone access.',
      voiceRecorderRecording: 'Recording',
      voiceRecorderRecordingHint: 'Tap Stop when you are ready to review it.',
      voiceRecorderRecoveredDraftHint:
        'Recovered after refresh. Send it now or discard it.',
      voiceRecorderRetry: 'Try again',
      voiceRecorderRetryHint:
        'Try again. If it keeps failing, start a fresh recording.',
      voiceRecorderStop: 'Stop',
      voiceRecorderUnavailable: 'Voice recording is not available here.',
      voiceRecorderUnavailableHint: 'Use text or a file on this device instead.',
      yesterday: 'Yesterday',
    },
  },
  ru: {
    chat: {
      activeNow: 'Сейчас в чате',
      attachment: 'Файл',
      attachmentOptions: 'Вложения',
      attachmentSizeError: (maxSizeLabel) =>
        `Выберите файл до ${maxSizeLabel.toLowerCase()}.`,
      audio: 'Аудио',
      camera: 'Камера',
      cancel: 'Отмена',
      clearAttachment: 'Убрать',
      closePhotoPreview: 'Закрыть фото',
      delete: 'Удалить',
      deleteConfirm: 'Удалить это сообщение для всех в чате?',
      deletedMessage: 'Удалённое сообщение',
      delivered: 'Доставлено',
      directChat: 'Личный чат',
      earlier: 'Раньше',
      earlierMessage: 'Раннее сообщение',
      edited: 'Изменено',
      emptyMessage: 'Пустое сообщение',
      encryptedEditUnavailable:
        'Редактирование зашифрованных личных сообщений пока недоступно.',
      encryptedHistoryPolicyBlockedNote:
        'Отправлено до вашего текущего доступа к этому чату.',
      encryptedHistoryUnavailableNote:
        'Недоступно на этом устройстве. Новые сообщения в этом чате будут работать.',
      encryptedMessage: 'Зашифрованное сообщение',
      encryptedMessageSetupUnavailable:
        'Это зашифрованное сообщение сейчас недоступно на этом устройстве.',
      encryptedMessageUnavailable:
        'Зашифрованное сообщение недоступно на этом устройстве.',
      encryptedReplyInfo:
        'Ответ сохраняет ссылку на сообщение, но не раскрывает зашифрованный текст.',
      encryptionNeedsRefresh:
        'Настройку шифрования на этом устройстве нужно обновить. Попробуйте ещё раз.',
      encryptionRolloutUnavailable:
        'Зашифрованные личные сообщения для этого аккаунта пока не включены.',
      encryptionSessionChanged:
        'Настройка шифрования для этого личного чата изменилась. Попробуйте отправить сообщение ещё раз.',
      encryptionSetupUnavailable:
        'Настройка шифрования для личных сообщений пока недоступна.',
      encryptionUnavailableHere:
        'Отправка зашифрованных личных сообщений недоступна в этом браузере.',
      file: 'Файл',
      jumpToLatest: 'Перейти к последним сообщениям',
      justNow: 'Только что',
      loadingOlderMessages: 'Загружаем более ранние сообщения...',
      messageDeleted: 'Сообщение удалено',
      messageQueued: 'В очереди на этом устройстве',
      messageReactions: 'Реакции на сообщение',
      microphone: 'Голосовое сообщение',
      newEncryptedMessage: 'Новое зашифрованное сообщение',
      newMessage: 'Новое сообщение',
      noMessagesYet: 'Пока нет сообщений',
      olderEncryptedMessage: 'Раннее зашифрованное сообщение',
      olderMessagesAutoLoad: 'Более ранние сообщения загрузятся автоматически.',
      openPhotoPreviewAria: (title) => `Открыть фото ${title}`,
      photo: 'Фото',
      photoLibrary: 'Фото',
      recipientEncryptionUnavailable:
        'У этого человека пока нет готовой настройки для зашифрованных личных сообщений.',
      refreshEncryptedSetup: 'Обновить настройку шифрования',
      reloadConversation: 'Обновить чат',
      remove: 'Удалить',
      reply: 'Ответить',
      replyToEncryptedMessage: 'Ответ на зашифрованное сообщение',
      replyingTo: 'Ответ на',
      resetEncryptedSetupDev: 'Сбросить шифрование (dev)',
      retryEncryptedAction: 'Повторить',
      retrySend: 'Повторить',
      save: 'Сохранить',
      seen: 'Просмотрено',
      sendFailed: 'Не отправилось',
      sending: 'Отправляется…',
      sendMessage: 'Отправить сообщение',
      sent: 'Отправлено',
      someone: 'Кто-то',
      thisMessageWasDeleted: 'Это сообщение было удалено.',
      today: 'Сегодня',
      typingDouble: (left, right) => `${left} и ${right} печатают`,
      typingSeveral: 'Пишут несколько человек',
      typingSingle: (label) => `${label} печатает`,
      unableToSendEncryptedMessage:
        'Не удалось отправить зашифрованное сообщение.',
      unavailableRightNow: 'Сейчас недоступно',
      unknownUser: 'Неизвестный пользователь',
      unreadMessages: 'Непрочитанные сообщения',
      voiceMessage: 'Голосовое сообщение',
      voiceMessageFailed: 'Голосовое сообщение сейчас недоступно.',
      voiceMessageLoading: 'Голосовое сообщение загружается',
      voiceMessagePause: 'Поставить голосовое сообщение на паузу',
      voiceMessagePending: 'Голосовое сообщение ожидает',
      voiceMessagePendingHint:
        'Не закрывайте этот чат, пока аудио заканчивает синхронизироваться.',
      voiceMessagePlay: 'Воспроизвести голосовое сообщение',
      voiceMessageProcessing: 'Голосовое сообщение подготавливается',
      voiceMessageRetryHint:
        'Нажмите ещё раз, если аудио всё ещё не загружается.',
      voiceMessageUnavailable:
        'Голосовое сообщение недоступно на этом устройстве.',
      voiceMessageUnsupported:
        'Формат голосового сообщения здесь не поддерживается.',
      voiceMessageUploading: 'Голосовое сообщение загружается',
      voiceRecorderDraftReady: 'Готово к отправке',
      voiceRecorderFailed: 'Не удалось завершить запись.',
      voiceRecorderPermissionDenied: 'Нет доступа к микрофону.',
      voiceRecorderPermissionHint:
        'Разрешите доступ к микрофону и попробуйте ещё раз.',
      voiceRecorderPreparing: 'Подготовка…',
      voiceRecorderPreparingHint: 'Ждём доступ к микрофону.',
      voiceRecorderRecording: 'Идёт запись',
      voiceRecorderRecordingHint:
        'Нажмите «Стоп», когда будете готовы прослушать запись.',
      voiceRecorderRecoveredDraftHint:
        'Черновик восстановлен после обновления. Его можно отправить или отменить.',
      voiceRecorderRetry: 'Повторить',
      voiceRecorderRetryHint:
        'Попробуйте ещё раз. Если сбой повторится, начните новую запись.',
      voiceRecorderStop: 'Стоп',
      voiceRecorderUnavailable: 'Запись голоса здесь недоступна.',
      voiceRecorderUnavailableHint:
        'На этом устройстве вместо этого используйте текст или файл.',
      yesterday: 'Вчера',
    },
  },
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

export function getZoomSwitcherClientTranslations(
  language: AppLanguage,
): ZoomClientTranslations {
  return ZOOM_CLIENT_TRANSLATIONS[language];
}

export function getShellClientTranslations(
  language: AppLanguage,
): ShellClientTranslations {
  return SHELL_CLIENT_TRANSLATIONS[language];
}

export function getChatClientTranslations(
  language: AppLanguage,
): ChatClientTranslations {
  return CHAT_CLIENT_TRANSLATIONS[language];
}

export function getInboxClientTranslations(
  language: AppLanguage,
): InboxClientTranslations {
  return INBOX_CLIENT_TRANSLATIONS[language];
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
