import type { AppLanguage } from './client-shared';

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
      voiceRecorderUnavailableHint:
        'Use text or a file on this device instead.',
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

export function getChatClientTranslations(
  language: AppLanguage,
): ChatClientTranslations {
  return CHAT_CLIENT_TRANSLATIONS[language];
}

export type { AppLanguage };
