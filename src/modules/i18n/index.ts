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
  shell: {
    label: string;
    home: string;
    chats: string;
    activity: string;
    openHome: string;
    openChats: string;
    openActivity: string;
  };
  spaces: {
    title: string;
    subtitle: string;
    openSpace: string;
    currentActivityNote: string;
    emptyTitle: string;
    emptyBody: string;
    unavailableTitle: string;
    unavailableBody: string;
  };
  settings: {
    backToChats: string;
    heroEyebrow: string;
    heroNote: string;
    profileTitle: string;
    profileSubtitle: string;
    profilePhoto: string;
    profilePhotoCurrent: string;
    profilePhotoEmpty: string;
    displayName: string;
    displayNamePlaceholder: string;
    profilePhotoNote: string;
    removePhoto: string;
    editProfile: string;
    cancelEdit: string;
    tapPhotoToChange: string;
    avatarTooLarge: string;
    avatarInvalidType: string;
    avatarUploading: string;
    avatarUploadFailed: string;
    avatarStorageUnavailable: string;
    profileUpdateFailed: string;
    avatarEditorHint: string;
    avatarEditorZoom: string;
    avatarEditorApply: string;
    avatarEditorDraftReady: string;
    avatarEditorPreparing: string;
    avatarEditorLoadFailed: string;
    avatarEditorApplyBeforeSave: string;
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
  activity: {
    title: string;
    subtitle: string;
    overviewTitle: string;
    overviewBody: string;
    unreadChats: string;
    unreadDms: string;
    archivedChats: string;
    openChats: string;
    openArchived: string;
    unreadSectionTitle: string;
    unreadSectionBody: string;
    recentTitle: string;
    recentBody: string;
    recentEmptyTitle: string;
    recentEmptyBody: string;
    alertsTitle: string;
    alertsBody: string;
    digestTitle: string;
    digestBody: string;
    quietTitle: string;
    quietBody: string;
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
      dmTitle: string;
      subtitleNew: (count: number) => string;
      subtitleDmNew: (count: number) => string;
      subtitleCaughtUp: string;
      subtitleDmCaughtUp: string;
      subtitleStart: string;
      subtitleDmStart: string;
      subtitleArchivedCount: (count: number) => string;
      subtitleArchivedEmpty: string;
      settingsAria: string;
      createAria: string;
      searchAria: string;
      searchDmAria: string;
      filtersAria: string;
      searchPlaceholder: string;
      searchDmPlaceholder: string;
      searchEncryptedNote: string;
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
    chatIdentity: string;
    chatIdentityNote: string;
    name: string;
    ownerOnly: string;
    groupNamePlaceholder: string;
    groupNameRequired: string;
    saveName: string;
    saveChanges: string;
    changePhoto: string;
    removePhoto: string;
    avatarTooLarge: string;
    avatarInvalidType: string;
    avatarUploading: string;
    avatarUploadFailed: string;
    avatarStorageUnavailable: string;
    chatAvatarDraftReady: string;
    chatAvatarRemovedDraft: string;
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
    changesSaved: string;
    inbox: string;
    inboxNote: string;
    hideFromInbox: string;
    deleteChat: string;
    deleteChatNote: string;
    deleteChatCurrentUserOnlyNote: string;
    deleteChatButton: string;
    deleteChatConfirmTitle: string;
    deleteChatConfirmBody: string;
    deleteChatConfirmHint: string;
    deleteChatConfirmPlaceholder: string;
    deleteChatConfirmButton: string;
    messageStatsTitle: string;
    messageStatsNote: string;
    totalMessagesStat: string;
    messageSplitStat: string;
    messageLeadSummary: (label: string, count: number) => string;
    messageLeadTie: string;
    noMessagesYet: string;
    unreadMessages: string;
    today: string;
    yesterday: string;
    earlier: string;
    unknown: string;
    unknownUser: string;
    unknownSender: string;
    someone: string;
    you: string;
    emptyMessage: string;
    image: string;
    audio: string;
    voiceMessage: string;
    encryptedMessage: string;
    newEncryptedMessage: string;
    replyToEncryptedMessage: string;
    encryptedMessageUnavailable: string;
    attachment: string;
    file: string;
    unavailableRightNow: string;
    justNow: string;
    sending: string;
    sendFailed: string;
    edited: string;
    sent: string;
    delivered: string;
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
    microphone: string;
    voiceMessagesSoon: string;
    mentionSuggestions: string;
    clearAttachment: string;
    attachmentSizeError: (maxSizeLabel: string) => string;
    activeNow: string;
    typingSingle: (label: string) => string;
    typingDouble: (left: string, right: string) => string;
    typingSeveral: string;
    sendMessage: string;
    encryptionRolloutUnavailable: string;
    encryptionSetupUnavailable: string;
    encryptionUnavailableHere: string;
    recipientEncryptionUnavailable: string;
    encryptionNeedsRefresh: string;
    encryptionSessionChanged: string;
    unableToSendEncryptedMessage: string;
    encryptedMessageSetupUnavailable: string;
    encryptedReplyInfo: string;
    encryptedEditUnavailable: string;
    retryEncryptedAction: string;
    retrySend: string;
    refreshEncryptedSetup: string;
    resetEncryptedSetupDev: string;
    reloadConversation: string;
    encryptedAttachmentsUnsupported: string;
    loadingOlderMessages: string;
    olderMessagesAutoLoad: string;
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
    shell: {
      label: 'Primary navigation',
      home: 'Home',
      chats: 'Chats',
      activity: 'Activity',
      openHome: 'Open home',
      openChats: 'Open chats',
      openActivity: 'Open activity',
    },
    spaces: {
      title: 'Choose a space',
      subtitle: 'Pick the project or team context you want to open first.',
      openSpace: 'Open space',
      currentActivityNote: 'Current messaging activity is available here for now.',
      emptyTitle: 'No spaces yet',
      emptyBody: 'Ask the operator to add you to a space first.',
      unavailableTitle: 'Spaces are temporarily unavailable',
      unavailableBody: 'Please try again in a moment while space access is being refreshed.',
    },
    settings: {
      backToChats: 'Back to chats',
      heroEyebrow: 'You',
      heroNote: 'Photo, name, language, and account.',
      profileTitle: 'Profile',
      profileSubtitle: 'Photo and name',
      profilePhoto: 'Profile photo',
      profilePhotoCurrent: 'Current photo is active.',
      profilePhotoEmpty: 'No profile photo yet. Initials are shown instead.',
      displayName: 'Display name',
      displayNamePlaceholder: 'Your name',
      profilePhotoNote: 'JPG, PNG, WEBP, or GIF, up to 5 MB.',
      removePhoto: 'Remove photo',
      editProfile: 'Edit profile',
      cancelEdit: 'Cancel',
      tapPhotoToChange: 'Tap photo to change',
      avatarTooLarge: 'Avatar images can be up to 5 MB.',
      avatarInvalidType: 'Avatar must be a JPG, PNG, WEBP, or GIF image.',
      avatarUploading: 'Uploading photo...',
      avatarUploadFailed: 'Unable to upload avatar right now.',
      avatarStorageUnavailable: 'Avatar uploads are not available right now.',
      profileUpdateFailed: 'Unable to update your profile right now.',
      avatarEditorHint: 'Move and zoom your photo, then use it as a draft.',
      avatarEditorZoom: 'Zoom',
      avatarEditorApply: 'Use photo',
      avatarEditorDraftReady: 'Photo draft ready. Save to apply it.',
      avatarEditorPreparing: 'Preparing photo...',
      avatarEditorLoadFailed: 'Unable to open that photo right now.',
      avatarEditorApplyBeforeSave: 'Use photo first to confirm the crop.',
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
    activity: {
      title: 'Activity',
      subtitle: 'Notifications, unread chats, and recent updates in one place.',
      overviewTitle: 'Overview',
      overviewBody: 'A quick read on what needs attention right now.',
      unreadChats: 'Unread chats',
      unreadDms: 'Unread DMs',
      archivedChats: 'Archived chats',
      openChats: 'Open chats',
      openArchived: 'Archived',
      unreadSectionTitle: 'Unread now',
      unreadSectionBody: 'Conversations that still need your attention.',
      recentTitle: 'Recent activity',
      recentBody: 'Latest message updates across your chats.',
      recentEmptyTitle: 'No recent messages yet',
      recentEmptyBody: 'New message activity will appear here once chats pick up.',
      alertsTitle: 'Alerts',
      alertsBody: 'Notification readiness and device-level messaging alerts.',
      digestTitle: 'Summaries later',
      digestBody: 'This space is reserved for smart recaps and digests when they are ready.',
      quietTitle: 'All quiet',
      quietBody: 'Nothing unread right now.',
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
      dmTitle: 'DMs',
      subtitleNew: (count) => `${count} new`,
      subtitleDmNew: (count) => `${count} new direct ${count === 1 ? 'chat' : 'chats'}`,
      subtitleCaughtUp: 'All caught up',
      subtitleDmCaughtUp: 'No unread direct messages',
      subtitleStart: 'Start a chat',
      subtitleDmStart: 'Start a direct chat',
      subtitleArchivedCount: (count) => `${count} hidden from your inbox`,
      subtitleArchivedEmpty: 'Hidden chats stay here',
      settingsAria: 'Open settings',
      createAria: 'Start a chat',
      searchAria: 'Search chats',
      searchDmAria: 'Search direct messages',
      filtersAria: 'Chat filters',
      searchPlaceholder: 'Search chats or people',
      searchDmPlaceholder: 'Search direct messages',
      searchEncryptedNote:
        'Encrypted direct-message text is not searchable here yet.',
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
      chatIdentity: 'Chat identity',
      chatIdentityNote: 'Name and photo for this group.',
      name: 'Name',
      ownerOnly: 'Owner only.',
      groupNamePlaceholder: 'Enter a group name',
      groupNameRequired: 'Group title cannot be empty.',
      saveName: 'Save name',
      saveChanges: 'Save changes',
      changePhoto: 'Change photo',
      removePhoto: 'Remove photo',
      avatarTooLarge: 'Avatar images can be up to 5 MB.',
      avatarInvalidType: 'Avatar must be a JPG, PNG, WEBP, or GIF image.',
      avatarUploading: 'Saving…',
      avatarUploadFailed: 'Unable to update chat photo right now.',
      avatarStorageUnavailable: 'Chat photo uploads are not available right now.',
      chatAvatarDraftReady: 'Photo will update when you save.',
      chatAvatarRemovedDraft: 'Photo will be removed when you save.',
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
      changesSaved: 'Saved',
      inbox: 'Inbox',
      inboxNote: 'Hide this chat from your inbox only.',
      hideFromInbox: 'Hide from inbox',
      deleteChat: 'Delete chat',
      deleteChatNote: 'Delete this direct chat and its current message history.',
      deleteChatButton: 'Delete chat',
      deleteChatCurrentUserOnlyNote:
        'Remove this direct chat from your side only. The other person keeps their copy.',
      deleteChatConfirmTitle: 'Delete chat from your side',
      deleteChatConfirmBody:
        'This removes the direct chat from your inbox for your account only.',
      deleteChatConfirmHint: 'Type "Удалить" to confirm.',
      deleteChatConfirmPlaceholder: 'Удалить',
      deleteChatConfirmButton: 'Delete from my side',
      messageStatsTitle: 'Messages',
      messageStatsNote: 'How messages are split in this chat.',
      totalMessagesStat: 'Total sent',
      messageSplitStat: 'Split',
      messageLeadSummary: (label, count) => `${label} sent ${count} more message${count === 1 ? '' : 's'}.`,
      messageLeadTie: 'Both participants sent the same number of messages.',
      noMessagesYet: 'No messages yet',
      unreadMessages: 'Unread messages',
      today: 'Today',
      yesterday: 'Yesterday',
      earlier: 'Earlier',
      unknown: 'Unknown',
      unknownUser: 'Unknown user',
      unknownSender: 'Unknown sender',
      someone: 'Someone',
      you: 'You',
      emptyMessage: 'Empty message',
      image: 'Image',
      audio: 'Audio',
      voiceMessage: 'Voice message',
      encryptedMessage: 'Encrypted message',
      newEncryptedMessage: 'New encrypted message',
      replyToEncryptedMessage: 'Reply to encrypted message',
      encryptedMessageUnavailable: 'Encrypted message is not available on this device yet.',
      attachment: 'Attachment',
      file: 'File',
      unavailableRightNow: 'Unavailable right now',
      justNow: 'Just now',
      sending: 'Sending…',
      sendFailed: 'Failed to send',
      edited: 'Edited',
      sent: 'Sent',
      delivered: 'Delivered',
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
      microphone: 'Voice message',
      voiceMessagesSoon: 'Voice messages are coming soon.',
      mentionSuggestions: 'Mention suggestions',
      clearAttachment: 'Clear',
      attachmentSizeError: (maxSizeLabel) =>
        `Choose a file up to ${maxSizeLabel.toLowerCase()}.`,
      activeNow: 'Active now',
      typingSingle: (label) => `${label} is typing`,
      typingDouble: (left, right) => `${left} and ${right} are typing`,
      typingSeveral: 'Several people are typing',
      sendMessage: 'Send message',
      encryptionRolloutUnavailable:
        'Encrypted direct messages are not enabled for this account yet.',
      encryptionSetupUnavailable: 'Encrypted DM setup is not ready yet.',
      encryptionUnavailableHere: 'Encrypted DM sending is not available in this browser.',
      recipientEncryptionUnavailable:
        'This person is not ready for encrypted direct messages yet.',
      encryptionNeedsRefresh:
        'Encrypted DM setup on this device needs to refresh. Try again.',
      encryptionSessionChanged:
        'Encrypted DM setup changed. Try sending again.',
      unableToSendEncryptedMessage: 'Unable to send encrypted message.',
      encryptedMessageSetupUnavailable:
        'This encrypted message is not available on this device right now.',
      encryptedReplyInfo:
        'Replies keep the message reference, not the encrypted text.',
      encryptedEditUnavailable:
        'Editing encrypted direct messages is not available yet.',
      retryEncryptedAction: 'Retry',
      retrySend: 'Retry',
      refreshEncryptedSetup: 'Refresh encrypted setup',
      resetEncryptedSetupDev: 'Reset encrypted setup (dev)',
      reloadConversation: 'Reload chat',
      encryptedAttachmentsUnsupported:
        'Encrypted text with attachments is not supported yet in direct messages.',
      loadingOlderMessages: 'Loading older messages...',
      olderMessagesAutoLoad: 'Older messages will load automatically.',
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
    shell: {
      label: 'Основная навигация',
      home: 'Главная',
      chats: 'Чаты',
      activity: 'Активность',
      openHome: 'Открыть главную',
      openChats: 'Открыть чаты',
      openActivity: 'Открыть активность',
    },
    spaces: {
      title: 'Выберите пространство',
      subtitle: 'Сначала откройте нужный проектный или командный контекст.',
      openSpace: 'Открыть пространство',
      currentActivityNote: 'Текущая переписка пока доступна здесь.',
      emptyTitle: 'Пока нет пространств',
      emptyBody: 'Попросите оператора добавить вас в пространство.',
      unavailableTitle: 'Пространства временно недоступны',
      unavailableBody: 'Попробуйте снова чуть позже, пока доступ к пространствам обновляется.',
    },
    settings: {
      backToChats: 'Назад к чатам',
      heroEyebrow: 'Вы',
      heroNote: 'Фото, имя, язык и аккаунт.',
      profileTitle: 'Профиль',
      profileSubtitle: 'Фото и имя',
      profilePhoto: 'Фото профиля',
      profilePhotoCurrent: 'Текущее фото активно.',
      profilePhotoEmpty: 'Фото профиля ещё нет. Вместо него показываются инициалы.',
      displayName: 'Отображаемое имя',
      displayNamePlaceholder: 'Ваше имя',
      profilePhotoNote: 'JPG, PNG, WEBP или GIF, до 5 МБ.',
      removePhoto: 'Удалить фото',
      editProfile: 'Изменить профиль',
      cancelEdit: 'Отмена',
      tapPhotoToChange: 'Нажмите на фото, чтобы изменить',
      avatarTooLarge: 'Изображение профиля может быть до 5 МБ.',
      avatarInvalidType: 'Аватар должен быть в формате JPG, PNG, WEBP или GIF.',
      avatarUploading: 'Загружаем фото...',
      avatarUploadFailed: 'Сейчас не удалось загрузить аватар.',
      avatarStorageUnavailable: 'Загрузка аватаров сейчас недоступна.',
      profileUpdateFailed: 'Сейчас не удалось обновить профиль.',
      avatarEditorHint: 'Подвиньте и приблизьте фото, затем примените черновик.',
      avatarEditorZoom: 'Масштаб',
      avatarEditorApply: 'Использовать фото',
      avatarEditorDraftReady: 'Черновик фото готов. Сохраните, чтобы применить.',
      avatarEditorPreparing: 'Подготавливаем фото...',
      avatarEditorLoadFailed: 'Сейчас не удалось открыть это фото.',
      avatarEditorApplyBeforeSave: 'Сначала подтвердите кадрирование кнопкой фото.',
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
    activity: {
      title: 'Активность',
      subtitle: 'Уведомления, непрочитанные чаты и недавние обновления в одном месте.',
      overviewTitle: 'Обзор',
      overviewBody: 'Быстрый срез того, что сейчас требует внимания.',
      unreadChats: 'Непрочитанные чаты',
      unreadDms: 'Непрочитанные личные',
      archivedChats: 'Архивные чаты',
      openChats: 'Открыть чаты',
      openArchived: 'Архив',
      unreadSectionTitle: 'Нужно прочитать',
      unreadSectionBody: 'Чаты, которые все еще ждут вашего внимания.',
      recentTitle: 'Недавно',
      recentBody: 'Последние обновления сообщений в ваших чатах.',
      recentEmptyTitle: 'Пока нет недавних сообщений',
      recentEmptyBody: 'Новая активность появится здесь, когда чаты оживут.',
      alertsTitle: 'Оповещения',
      alertsBody: 'Готовность уведомлений и сигналы сообщений на этом устройстве.',
      digestTitle: 'Сводки позже',
      digestBody: 'Это место зарезервировано под умные сводки и дайджесты, когда они будут готовы.',
      quietTitle: 'Пока тихо',
      quietBody: 'Сейчас нет непрочитанного.',
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
      dmTitle: 'Личные',
      subtitleNew: (count) => `${count} новых`,
      subtitleDmNew: (count) => `${count} новых ${getRussianCountWord(count, ['личный чат', 'личных чата', 'личных чатов'])}`,
      subtitleCaughtUp: 'Новых сообщений нет',
      subtitleDmCaughtUp: 'Непрочитанных личных нет',
      subtitleStart: 'Начните чат',
      subtitleDmStart: 'Начните личный чат',
      subtitleArchivedCount: (count) => `${count} скрыто из входящих`,
      subtitleArchivedEmpty: 'Скрытые чаты будут здесь',
      settingsAria: 'Открыть настройки',
      createAria: 'Начать чат',
      searchAria: 'Искать чаты',
      searchDmAria: 'Искать личные чаты',
      filtersAria: 'Фильтры чатов',
      searchPlaceholder: 'Искать чаты или людей',
      searchDmPlaceholder: 'Искать личные чаты',
      searchEncryptedNote:
        'Текст в зашифрованных личных сообщениях здесь пока не ищется.',
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
      chatIdentity: 'Оформление чата',
      chatIdentityNote: 'Название и фото для этой группы.',
      name: 'Название',
      ownerOnly: 'Только владелец.',
      groupNamePlaceholder: 'Введите название группы',
      groupNameRequired: 'Название группы не может быть пустым.',
      saveName: 'Сохранить',
      saveChanges: 'Сохранить изменения',
      changePhoto: 'Сменить фото',
      removePhoto: 'Удалить фото',
      avatarTooLarge: 'Изображение аватара может быть до 5 МБ.',
      avatarInvalidType: 'Аватар должен быть в формате JPG, PNG, WEBP или GIF.',
      avatarUploading: 'Сохранение…',
      avatarUploadFailed: 'Сейчас не удалось обновить фото чата.',
      avatarStorageUnavailable: 'Загрузка фото чата сейчас недоступна.',
      chatAvatarDraftReady: 'Фото обновится после сохранения.',
      chatAvatarRemovedDraft: 'Фото будет удалено после сохранения.',
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
      changesSaved: 'Сохранено',
      inbox: 'Входящие',
      inboxNote: 'Скрыть этот чат только из списка.',
      hideFromInbox: 'Скрыть из чатов',
      deleteChat: 'Удалить чат',
      deleteChatNote: 'Удалить этот личный чат и его текущую историю сообщений.',
      deleteChatButton: 'Удалить чат',
      deleteChatCurrentUserOnlyNote:
        'Убрать этот личный чат только с вашей стороны. У другого участника чат останется.',
      deleteChatConfirmTitle: 'Удалить чат с вашей стороны',
      deleteChatConfirmBody:
        'Чат исчезнет из ваших чатов только для вашего аккаунта.',
      deleteChatConfirmHint: 'Введите "Удалить", чтобы подтвердить.',
      deleteChatConfirmPlaceholder: 'Удалить',
      deleteChatConfirmButton: 'Удалить с моей стороны',
      messageStatsTitle: 'Сообщения',
      messageStatsNote: 'Как распределены сообщения в этом чате.',
      totalMessagesStat: 'Всего отправлено',
      messageSplitStat: 'Распределение',
      messageLeadSummary: (label, count) => `${label} отправил${label === 'Вы' ? 'и' : ''} на ${count} больше.`,
      messageLeadTie: 'Оба участника отправили одинаковое число сообщений.',
      noMessagesYet: 'Пока нет сообщений',
      unreadMessages: 'Непрочитанные сообщения',
      today: 'Сегодня',
      yesterday: 'Вчера',
      earlier: 'Раньше',
      unknown: 'Неизвестно',
      unknownUser: 'Неизвестный пользователь',
      unknownSender: 'Неизвестный отправитель',
      someone: 'Кто-то',
      you: 'Вы',
      emptyMessage: 'Пустое сообщение',
      image: 'Изображение',
      audio: 'Аудио',
      voiceMessage: 'Голосовое сообщение',
      encryptedMessage: 'Зашифрованное сообщение',
      newEncryptedMessage: 'Новое зашифрованное сообщение',
      replyToEncryptedMessage: 'Ответ на зашифрованное сообщение',
      encryptedMessageUnavailable:
        'Зашифрованное сообщение пока недоступно на этом устройстве.',
      attachment: 'Файл',
      file: 'Файл',
      unavailableRightNow: 'Сейчас недоступно',
      justNow: 'Только что',
      sending: 'Отправляется…',
      sendFailed: 'Не отправилось',
      edited: 'Изменено',
      sent: 'Отправлено',
      delivered: 'Доставлено',
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
      microphone: 'Голосовое сообщение',
      voiceMessagesSoon: 'Голосовые сообщения скоро появятся.',
      mentionSuggestions: 'Подсказки упоминаний',
      clearAttachment: 'Убрать',
      attachmentSizeError: (maxSizeLabel) =>
        `Выберите файл до ${maxSizeLabel.toLowerCase()}.`,
      activeNow: 'Сейчас в чате',
      typingSingle: (label) => `${label} печатает`,
      typingDouble: (left, right) => `${left} и ${right} печатают`,
      typingSeveral: 'Пишут несколько человек',
      sendMessage: 'Отправить сообщение',
      encryptionRolloutUnavailable:
        'Зашифрованные личные сообщения для этого аккаунта пока не включены.',
      encryptionSetupUnavailable:
        'Настройка шифрования для личных сообщений пока недоступна.',
      encryptionUnavailableHere:
        'Отправка зашифрованных личных сообщений недоступна в этом браузере.',
      recipientEncryptionUnavailable:
        'У этого человека пока нет готовой настройки для зашифрованных личных сообщений.',
      encryptionNeedsRefresh:
        'Настройку шифрования на этом устройстве нужно обновить. Попробуйте ещё раз.',
      encryptionSessionChanged:
        'Настройка шифрования для этого личного чата изменилась. Попробуйте отправить сообщение ещё раз.',
      unableToSendEncryptedMessage:
        'Не удалось отправить зашифрованное сообщение.',
      encryptedMessageSetupUnavailable:
        'Это зашифрованное сообщение сейчас недоступно на этом устройстве.',
      encryptedReplyInfo:
        'Ответ сохраняет ссылку на сообщение, но не раскрывает зашифрованный текст.',
      encryptedEditUnavailable:
        'Редактирование зашифрованных личных сообщений пока недоступно.',
      retryEncryptedAction: 'Повторить',
      retrySend: 'Повторить',
      refreshEncryptedSetup: 'Обновить настройку шифрования',
      resetEncryptedSetupDev: 'Сбросить шифрование (dev)',
      reloadConversation: 'Обновить чат',
      encryptedAttachmentsUnsupported:
        'Зашифрованный текст с вложениями в личных чатах пока не поддерживается.',
      loadingOlderMessages: 'Загружаем более ранние сообщения...',
      olderMessagesAutoLoad: 'Более ранние сообщения загрузятся автоматически.',
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
