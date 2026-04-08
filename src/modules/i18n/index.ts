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
    contextLabel: string;
    loadingTitle: string;
    loadingBody: string;
    errorTitle: string;
    errorBody: string;
    errorProofPathBody: string;
    retry: string;
    home: string;
    rooms: string;
    issues: string;
    tasks: string;
    chats: string;
    spaces: string;
    settings: string;
    activity: string;
    messengerActivity: string;
    activeHomeLabel: string;
    currentSectionLabel: string;
    homeScopeBody: string;
    homeSectionBody: string;
    roomsSectionBody: string;
    issuesSectionBody: string;
    tasksSectionBody: string;
    activitySectionBody: string;
    openHome: string;
    openRooms: string;
    openIssues: string;
    openTasks: string;
    openChats: string;
    openSpaces: string;
    openSettings: string;
    openActivity: string;
    openMessengerActivity: string;
  };
  spaces: {
    title: string;
    subtitle: string;
    backToChats: string;
    backToSpaces: string;
    currentSpace: string;
    openSpace: string;
    currentActivityNote: string;
    emptyTitle: string;
    emptyBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    globalAdminEyebrow: string;
    createSpaceTitle: string;
    createSpaceBody: string;
    createSpaceAction: string;
    createSpaceRouteTitle: string;
    createSpaceRouteSubtitle: string;
    createSpaceRouteBody: string;
    fieldSpaceName: string;
    fieldSpaceProfile: string;
    fieldParticipantIdentifiers: string;
    fieldAdminIdentifiers: string;
    profileMessengerFull: string;
    profileKeepCozyOps: string;
    profileHint: string;
    participantIdentifiersHint: string;
    adminIdentifiersHint: string;
    includeYourselfHint: string;
    submitCreateSpace: string;
    nameRequired: string;
    testSpaceReservedName: string;
    adminIdentifiersRequired: string;
    createSpaceFailed: string;
    createSpaceSuccess: string;
    createSpaceSuccessNoAccess: string;
    createSpaceSuccessProfileDeferred: string;
    createSpaceSuccessNoAccessProfileDeferred: string;
    spaceAdminEyebrow: string;
    manageMembersTitle: string;
    manageMembersBody: string;
    manageMembersAction: string;
    manageMembersRouteTitle: string;
    manageMembersRouteSubtitle: string;
    manageMembersRouteBody: string;
    membersOrAdminsRequired: string;
    manageMembersFailed: string;
    manageMembersSuccess: string;
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
    statusTitle: string;
    statusSubtitle: string;
    statusEmpty: string;
    statusEmoji: string;
    statusText: string;
    statusEmojiPlaceholder: string;
    statusTextPlaceholder: string;
    statusSave: string;
    statusEdit: string;
    statusClear: string;
    statusUpdated: string;
    statusTextHint: string;
    statusEmojiTooLong: string;
    statusTextTooLong: string;
    statusUpdateFailed: string;
    spaceTitle: string;
    spaceSubtitle: string;
    currentSpaceLabel: string;
    noSpaceSelected: string;
    chooseAnotherSpace: string;
    logoutTitle: string;
    logoutSubtitle: string;
    logoutButton: string;
    profileUpdated: string;
    languageUpdated: string;
  };
  messengerHome: {
    eyebrow: string;
    subtitle: string;
    overviewTitle: string;
    overviewBody: string;
    activeChatsTitle: string;
    activeChatsBody: string;
    unreadChatsBody: string;
    archivedChatsBody: string;
    recentTitle: string;
    recentBody: string;
    profileTitle: string;
    profileBody: string;
    unreadBadgeLabel: string;
    groupBadgeLabel: string;
    openProfileAction: string;
    recentEmptyBody: string;
    emptyTitle: string;
    emptyBody: string;
  };
  messengerActivity: {
    subtitle: string;
    overviewTitle: string;
    overviewBody: string;
    unreadSectionTitle: string;
    unreadSectionBody: string;
    recentSectionTitle: string;
    recentSectionBody: string;
    quietTitle: string;
    quietBody: string;
    recentEmptyTitle: string;
    recentEmptyBody: string;
  };
  homeDashboard: {
    eyebrow: string;
    subtitle: string;
    previewPill: string;
    previewBody: string;
    currentHomeLabel: string;
    switchHome: string;
    loopTitle: string;
    loopBody: string;
    roomsTitle: string;
    roomsBody: string;
    issuesTitle: string;
    issuesBody: string;
    tasksTitle: string;
    tasksBody: string;
    historyTitle: string;
    historyBody: string;
    openRooms: string;
    openIssues: string;
    openTasks: string;
    openHistory: string;
    supportTitle: string;
    supportBody: string;
    secondaryChatsTitle: string;
    secondaryChatsBody: string;
    secondarySettingsTitle: string;
    secondarySettingsBody: string;
    testFlowTitle: string;
    testFlowBody: string;
    testFlowPendingBody: string;
    testFlowMismatchBody: string;
    openChats: string;
    openSettings: string;
  };
  rooms: {
    title: string;
    subtitle: string;
    backToHome: string;
    previewPill: string;
    previewBody: string;
    emptyTitle: string;
    emptyBody: string;
    emptyTestBody: string;
    selectedHomeLabel: string;
    issuesLabel: string;
    tasksLabel: string;
    historyLabel: string;
    viewIssues: string;
    viewTasks: string;
    detailTitle: string;
    detailBody: string;
    detailHistoryTitle: string;
  };
  issues: {
    title: string;
    subtitle: string;
    backToHome: string;
    create: string;
    submitCreate: string;
    submitUpdate: string;
    previewPill: string;
    previewBody: string;
    emptyTitle: string;
    emptyBody: string;
    emptyFilteredBody: string;
    emptyTestBody: string;
    selectedHomeLabel: string;
    filteredByRoom: string;
    allRooms: string;
    viewRoom: string;
    viewTasks: string;
    updatesTitle: string;
    updatesBody: string;
    tasksTitle: string;
    tasksBody: string;
    detailBody: string;
    createTitle: string;
    createSubtitle: string;
    draftTitle: string;
    draftBody: string;
    fieldHome: string;
    fieldRoom: string;
    roomOptionalNote: string;
    roomMissing: string;
    fieldTitle: string;
    fieldSummary: string;
    fieldNextStep: string;
    fieldFirstUpdate: string;
    firstUpdateHint: string;
    fieldUpdateLabel: string;
    labelOptionalHint: string;
    fieldUpdateBody: string;
    fieldStatus: string;
    currentStatusLabel: string;
    statusIntentHint: string;
    fieldAttachments: string;
    createNote: string;
    browseIssues: string;
    appendTitle: string;
    appendBody: string;
    titleRequired: string;
    firstUpdateRequired: string;
    updateBodyRequired: string;
    createSuccess: string;
    updateSuccess: string;
    updateSuccessStatus: string;
    updateSuccessResolved: string;
    createFailed: string;
    updateFailed: string;
    statusInvalid: string;
    statusKeepCurrent: string;
    statusOpen: string;
    statusPlanned: string;
    statusInReview: string;
    statusResolved: string;
    loggedLabel: string;
    updateLabelDefault: string;
    statusUpdatedLabel: string;
    resolvedLabel: string;
  };
  tasks: {
    title: string;
    subtitle: string;
    backToHome: string;
    create: string;
    submitCreate: string;
    submitUpdate: string;
    previewPill: string;
    previewBody: string;
    emptyTitle: string;
    emptyBody: string;
    emptyFilteredBody: string;
    emptyTestBody: string;
    selectedHomeLabel: string;
    filteredByIssue: string;
    allIssues: string;
    viewIssue: string;
    viewRoom: string;
    updatesTitle: string;
    updatesBody: string;
    detailBody: string;
    createTitle: string;
    createSubtitle: string;
    draftTitle: string;
    draftBody: string;
    fieldHome: string;
    fieldIssue: string;
    issueLinkNote: string;
    issueMissing: string;
    fieldSummary: string;
    fieldNextStep: string;
    fieldTask: string;
    fieldFirstUpdate: string;
    firstUpdateHint: string;
    fieldUpdateLabel: string;
    labelOptionalHint: string;
    fieldUpdateBody: string;
    fieldStatus: string;
    currentStatusLabel: string;
    statusIntentHint: string;
    fieldAttachments: string;
    createNote: string;
    browseTasks: string;
    appendTitle: string;
    appendBody: string;
    issueRequired: string;
    titleRequired: string;
    firstUpdateRequired: string;
    updateBodyRequired: string;
    createSuccess: string;
    updateSuccess: string;
    updateSuccessStatus: string;
    updateSuccessCompleted: string;
    createFailed: string;
    updateFailed: string;
    statusInvalid: string;
    statusKeepCurrent: string;
    statusPlanned: string;
    statusActive: string;
    statusWaiting: string;
    statusDone: string;
    statusCancelled: string;
    createdLabel: string;
    updateLabelDefault: string;
    statusUpdatedLabel: string;
    completedLabel: string;
    createIssueFirstBody: string;
  };
  activity: {
    title: string;
    subtitle: string;
    overviewTitle: string;
    overviewBody: string;
    operationsEmptyTitle: string;
    operationsEmptyBody: string;
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
    openTasks: string;
    openTask: string;
    openHome: string;
    operationsTitle: string;
    operationsBody: string;
    operationsIssues: string;
    operationsTasks: string;
    operationsResolutions: string;
    messagingTitle: string;
    messagingBody: string;
    recentMessagingTitle: string;
    recentMessagingBody: string;
    testFlowTitle: string;
    testFlowBody: string;
    testFlowPendingBody: string;
    testFlowMismatchBody: string;
  };
  inboxSettings: {
    title: string;
    subtitle: string;
    backToInbox: string;
    saved: string;
    saveChanges: string;
    saveFailed: string;
    filtersTitle: string;
    filtersNote: string;
    visibleFiltersTitle: string;
    defaultFilterTitle: string;
    defaultFilterNote: string;
    groupingTitle: string;
    groupingNote: string;
    showGroupsSeparately: string;
    showPersonalChatsFirst: string;
    previewsTitle: string;
    previewsNote: string;
    previewModeShow: string;
    previewModeShowNote: string;
    previewModeMask: string;
    previewModeMaskNote: string;
    previewModeRevealAfterOpen: string;
    previewModeRevealAfterOpenNote: string;
    viewTitle: string;
    viewNote: string;
    densityComfortable: string;
    densityCompact: string;
    previewModeShowSummary: string;
    previewModeMaskSummary: string;
    previewModeRevealAfterOpenSummary: string;
    densityComfortableSummary: string;
    densityCompactSummary: string;
    summaryShown: string;
    summaryDefault: string;
    summaryStandard: string;
    summaryNoExtraRules: string;
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
    pullToRefresh: string;
    releaseToRefresh: string;
    refreshing: string;
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
      searchAria: string;
      searchPlaceholder: string;
      noUsers: string;
      existingDmOnly: string;
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
    openAvatarPreviewAria: (title: string) => string;
    closeAvatarPreview: string;
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
    adminOnly: string;
    groupPrivacy: string;
    groupPrivacyNote: string;
    groupPrivacyOpen: string;
    groupPrivacyOpenNote: string;
    groupPrivacyClosed: string;
    groupPrivacyClosedNote: string;
    groupOpenMembersCanAdd: string;
    groupClosedAdminsOnly: string;
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
    avatarSchemaRequired: string;
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
    historySection: string;
    historyBaselineNote: string;
    historyBaselineActiveNote: string;
    historyBaselineAction: string;
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
    newMessage: string;
    image: string;
    audio: string;
    voiceMessage: string;
    voiceMessagePlay: string;
    voiceMessagePause: string;
    voiceMessageLoading: string;
    voiceMessageUploading: string;
    voiceMessageProcessing: string;
    voiceMessageFailed: string;
    voiceMessageUnavailable: string;
    encryptedMessage: string;
    olderEncryptedMessage: string;
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
    voiceRecorderPreparing: string;
    voiceRecorderRecording: string;
    voiceRecorderDraftReady: string;
    voiceRecorderStop: string;
    voiceRecorderRetry: string;
    voiceRecorderRecordAgain: string;
    voiceRecorderPermissionDenied: string;
    voiceRecorderUnavailable: string;
    voiceRecorderFailed: string;
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
    encryptedHistoryUnavailableNote: string;
    encryptedHistoryPolicyBlockedNote: string;
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
      title: 'Open your workspace',
      subtitle:
        'A calm place to enter the spaces you already have access to and keep work moving.',
      openChats: 'Open workspace',
      openSettings: 'Open settings',
      logIn: 'Log in',
      watermark: 'KeepCozy by Build With Care',
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
      contextLabel: 'KeepCozy shell context',
      loadingTitle: 'Opening this home',
      loadingBody: 'Preparing the current home, the main sections, and the next operational steps.',
      errorTitle: "Couldn't load this home view",
      errorBody:
        'Try again first. If this still fails, go back to Home or choose a different home context before reopening the current section.',
      errorProofPathBody:
        'If you are validating the canonical TEST-home proof path, choose TEST again from the home picker before retrying.',
      retry: 'Try again',
      home: 'Home',
      rooms: 'Rooms',
      issues: 'Issues',
      tasks: 'Tasks',
      chats: 'Chats',
      spaces: 'Spaces',
      settings: 'Settings',
      activity: 'History',
      messengerActivity: 'Activity',
      activeHomeLabel: 'Active home',
      currentSectionLabel: 'Current section',
      homeScopeBody: 'All top-level sections stay inside this home until you switch context.',
      homeSectionBody: 'Start here to open the full operational loop for this home.',
      roomsSectionBody: 'Use rooms to anchor the issue and task work happening inside this home.',
      issuesSectionBody: 'Track the structured problems that belong to this home and turn into tasks.',
      tasksSectionBody: 'Follow the work linked to this home’s issues and keep the next step visible.',
      activitySectionBody: 'Review the operational history and updates collected across this home.',
      openHome: 'Open home',
      openRooms: 'Open rooms',
      openIssues: 'Open issues',
      openTasks: 'Open tasks',
      openChats: 'Open chats',
      openSpaces: 'Open spaces',
      openSettings: 'Open settings',
      openActivity: 'Open history',
      openMessengerActivity: 'Open activity',
    },
    spaces: {
      title: 'Choose a space',
      subtitle: 'Pick the space you want to open first.',
      backToChats: 'Back to workspace',
      backToSpaces: 'Back to spaces',
      currentSpace: 'Current space',
      openSpace: 'Open space',
      currentActivityNote: 'Open the right workspace for this space from here.',
      emptyTitle: 'No spaces yet',
      emptyBody: 'Ask the operator to add you to a space first.',
      unavailableTitle: 'Spaces are temporarily unavailable',
      unavailableBody: 'Please try again in a moment while space access is being refreshed.',
      globalAdminEyebrow: 'Global admin',
      createSpaceTitle: 'Create a new space',
      createSpaceBody:
        'This action is reserved for super admins and provisions a new governed space with its first members and admins.',
      createSpaceAction: 'Create space',
      createSpaceRouteTitle: 'Create a space',
      createSpaceRouteSubtitle:
        'Create a new space, choose its primary mode, and seed the first governed members.',
      createSpaceRouteBody:
        'This flow is reserved for super admins. A new space starts clean: no inherited history and no copied TEST-space members unless you list them here.',
      fieldSpaceName: 'Space name',
      fieldSpaceProfile: 'Primary mode',
      fieldParticipantIdentifiers: 'Initial participants',
      fieldAdminIdentifiers: 'Initial space admins',
      profileMessengerFull: 'Messenger space',
      profileKeepCozyOps: 'KeepCozy ops space',
      profileHint:
        'Messenger spaces land chat-first. KeepCozy spaces land home-first when persisted profile storage is available.',
      participantIdentifiersHint:
        'Enter one email or user ID per line. Leave this blank to start with only the listed admins. Nothing is copied from TEST.',
      adminIdentifiersHint:
        'Enter one email or user ID per line. Admin identifiers are also added as members automatically, and the first one becomes the owner.',
      includeYourselfHint:
        'Add yourself to the participant or admin list if you need to enter the new space right away.',
      submitCreateSpace: 'Create governed space',
      nameRequired: 'Space name is required.',
      testSpaceReservedName:
        'TEST is reserved for the existing KeepCozy sandbox. Use a different name for a new messenger space.',
      adminIdentifiersRequired: 'At least one initial space admin is required.',
      createSpaceFailed: 'Unable to create the space right now.',
      createSpaceSuccess: 'Space created. Open it from the list below.',
      createSpaceSuccessNoAccess:
        'Space created. It will not appear in this list until you add yourself as a member.',
      createSpaceSuccessProfileDeferred:
        'Space created. Profile storage is not live here yet, so this space will use the default shell until the space-profile migration is applied.',
      createSpaceSuccessNoAccessProfileDeferred:
        'Space created. It will not appear in this list until you add yourself as a member, and its selected mode will stay on the default shell until the space-profile migration is applied.',
      spaceAdminEyebrow: 'Space admin',
      manageMembersTitle: 'Manage current space members',
      manageMembersBody:
        'Add testers to only this space by exact email or user ID, and promote selected people to space admin without exposing a broader people browser.',
      manageMembersAction: 'Manage members',
      manageMembersRouteTitle: 'Manage members',
      manageMembersRouteSubtitle:
        'Add testers to this space by explicit email or user ID only.',
      manageMembersRouteBody:
        'This page changes membership only for the current space. It does not browse or reveal people from other spaces.',
      membersOrAdminsRequired:
        'Add at least one member or admin to continue.',
      manageMembersFailed:
        'Unable to update space members right now.',
      manageMembersSuccess:
        'Space members updated for this space.',
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
      statusTitle: 'Status',
      statusSubtitle: 'A short note for your profile and future chat surfaces.',
      statusEmpty: 'No status set yet.',
      statusEmoji: 'Emoji',
      statusText: 'Status text',
      statusEmojiPlaceholder: '✨',
      statusTextPlaceholder: 'Heads down, in calls, available later...',
      statusSave: 'Save status',
      statusEdit: 'Edit status',
      statusClear: 'Clear status',
      statusUpdated: 'Status updated.',
      statusTextHint: 'Keep it short, up to 80 characters.',
      statusEmojiTooLong: 'Emoji status can be up to 16 characters.',
      statusTextTooLong: 'Status text can be up to 80 characters.',
      statusUpdateFailed: 'Unable to update your status right now.',
      spaceTitle: 'Space',
      spaceSubtitle: 'Your current activity opens in this space by default. Switch spaces only when you want to change context.',
      currentSpaceLabel: 'Current space',
      noSpaceSelected: 'No space selected yet',
      chooseAnotherSpace: 'Choose another space',
      logoutTitle: 'Log out',
      logoutSubtitle: 'Sign out on this device',
      logoutButton: 'Log out',
      profileUpdated: 'Profile updated.',
      languageUpdated: 'Language updated.',
    },
    messengerHome: {
      eyebrow: 'Messenger space',
      subtitle:
        'Use this space for conversations first, then check recent chat movement without leaving the current workspace.',
      overviewTitle: 'Chat-first workspace',
      overviewBody:
        'Open chats to start talking, review recent activity when you need context, and switch spaces only when you want a different workspace.',
      activeChatsTitle: 'Active chats',
      activeChatsBody: 'Current conversations that belong to this space.',
      unreadChatsBody: 'Chats in this space that still need attention.',
      archivedChatsBody: 'Hidden chats stay reachable without leaving the space.',
      recentTitle: 'Resume chats',
      recentBody:
        'Jump back into the conversations that are already moving in this space.',
      profileTitle: 'Profile and space',
      profileBody:
        'Keep profile details and space switching nearby without turning them into the main shell.',
      unreadBadgeLabel: 'Unread',
      groupBadgeLabel: 'Group',
      openProfileAction: 'Open profile',
      recentEmptyBody: 'Open chats to start the next conversation in this space.',
      emptyTitle: 'This messenger space starts clean',
      emptyBody:
        'Open Chats to start the first conversation here. No history or participants are copied in automatically from TEST or any other space.',
    },
    messengerActivity: {
      subtitle:
        'Follow unread conversations and recent message movement for this space.',
      overviewTitle: 'Message activity',
      overviewBody:
        'Use this view to catch up on unread chats, scan recent movement, and reopen archived conversations when they matter again.',
      unreadSectionTitle: 'Unread chats',
      unreadSectionBody:
        'The conversations that need attention first in this space.',
      recentSectionTitle: 'Recent chats',
      recentSectionBody:
        'The latest conversation movement across this space, newest first.',
      quietTitle: 'Nothing needs attention right now',
      quietBody:
        'Unread conversations will appear here when something in this space needs a reply.',
      recentEmptyTitle: 'No recent chat movement yet',
      recentEmptyBody:
        'Recent conversation activity will appear here after this space starts being used.',
    },
    homeDashboard: {
      eyebrow: 'Home dashboard',
      subtitle: 'Keep the first MVP loop grounded in one home, then move through rooms, issues, tasks, and history.',
      previewPill: 'MVP slice',
      previewBody:
        'This dashboard intentionally centers the first persisted KeepCozy runtime slice. Richer home-ops layers still stay secondary.',
      currentHomeLabel: 'Current home',
      switchHome: 'Choose another home',
      loopTitle: 'First proven loop',
      loopBody:
        'Use this home as the starting point for room-level issues, task follow-through, and update history.',
      roomsTitle: 'Rooms',
      roomsBody: 'Anchor operational work to a real room before it turns into vague activity.',
      issuesTitle: 'Issues',
      issuesBody: 'Capture the problem as a structured record, not just a conversation.',
      tasksTitle: 'Tasks',
      tasksBody: 'Break the issue into work that can move and leave a clean history behind.',
      historyTitle: 'History',
      historyBody: 'Keep updates and resolution visible without making chat the primary workflow.',
      openRooms: 'Open rooms',
      openIssues: 'Open issues',
      openTasks: 'Open tasks',
      openHistory: 'Open history',
      supportTitle: 'Supporting surfaces',
      supportBody: 'Profile and chat remain available, but they no longer define the product flow.',
      secondaryChatsTitle: 'Chats',
      secondaryChatsBody: 'Optional communication lane for coordination around the work.',
      secondarySettingsTitle: 'Profile',
      secondarySettingsBody: 'Language, account details, and home switching still live here.',
      testFlowTitle: 'Primary test flow',
      testFlowBody:
        'Use one representative kitchen issue to validate the full MVP path from home to room to issue to task to history.',
      testFlowPendingBody:
        'The TEST home is active, but the canonical persisted room, issue, task, and history path has not been seeded yet.',
      testFlowMismatchBody:
        'This branch uses the seeded TEST home as the canonical MVP proof path. Switch homes before validating the flow.',
      openChats: 'Open chats',
      openSettings: 'Open profile',
    },
    rooms: {
      title: 'Rooms',
      subtitle: 'Treat rooms as the place where issues and task history begin to make sense.',
      backToHome: 'Back to home',
      previewPill: 'MVP slice',
      previewBody:
        'These room cards now read from the first KeepCozy persistence slice and stay intentionally narrow around issues, tasks, and history.',
      emptyTitle: 'No rooms yet in this home',
      emptyBody:
        'Rooms will appear here once this home has room records. Start from Home or move into Issues if the work has already been logged.',
      emptyTestBody:
        'The TEST home is active, but the canonical Kitchen room has not been seeded yet. Recheck the persisted TEST-home setup before validating the proof path.',
      selectedHomeLabel: 'Selected home',
      issuesLabel: 'Issues',
      tasksLabel: 'Tasks',
      historyLabel: 'History note',
      viewIssues: 'View issues',
      viewTasks: 'View tasks',
      detailTitle: 'Room detail',
      detailBody: 'A room should gather related issues, tasks, and history without turning into a broad portfolio surface.',
      detailHistoryTitle: 'Why history matters here',
    },
    issues: {
      title: 'Issues',
      subtitle: 'Keep problems structured, scoped to a home and room, and ready to turn into task work.',
      backToHome: 'Back to home',
      create: 'Create issue',
      submitCreate: 'Save issue',
      submitUpdate: 'Add update',
      previewPill: 'MVP slice',
      previewBody:
        'This is a focused issue lane for the MVP, now backed by the first persisted issue records. Supplier richness, recommendations, and automation stay out of the way.',
      emptyTitle: 'No issues yet in this home',
      emptyBody:
        'Create the first issue when something in this home needs attention. Keep it structured so it can turn into task work and history.',
      emptyFilteredBody:
        'There are no issues in this filtered view yet. Clear the filter or create the first issue for this room.',
      emptyTestBody:
        'The TEST home is active, but the canonical faucet issue has not been seeded yet. Recheck the persisted TEST-home setup before validating the proof path.',
      selectedHomeLabel: 'Selected home',
      filteredByRoom: 'Filtered room',
      allRooms: 'All rooms',
      viewRoom: 'Open room',
      viewTasks: 'Open tasks',
      updatesTitle: 'Issue history',
      updatesBody: 'Issue updates should capture what changed, not disappear into general chat traffic.',
      tasksTitle: 'Tasks linked to this issue',
      tasksBody: 'Tasks are how the issue moves forward and eventually resolves.',
      detailBody: 'Issue detail should keep the problem, next step, and updates visible in one place.',
      createTitle: 'Create issue',
      createSubtitle: 'Keep capture narrow: home, room, issue summary, first update, then task follow-through.',
      draftTitle: 'First capture seam',
      draftBody:
        'This route now creates real issue and issue_history records while staying intentionally lightweight for the MVP.',
      fieldHome: 'Home context',
      fieldRoom: 'Room',
      roomOptionalNote: 'Optional. Leave this empty when the issue belongs to the home overall rather than one room.',
      roomMissing:
        'The selected room is no longer available in this home. Pick another room or keep the issue at the home level.',
      fieldTitle: 'Issue title',
      fieldSummary: 'Issue summary',
      fieldNextStep: 'Next step',
      fieldFirstUpdate: 'First update',
      firstUpdateHint:
        'Use the first update to capture what you saw, what changed, or what needs attention right now.',
      fieldUpdateLabel: 'Update label',
      labelOptionalHint:
        'Optional. Leave this empty to use the default issue history label.',
      fieldUpdateBody: 'Update note',
      fieldStatus: 'Status',
      currentStatusLabel: 'Current status',
      statusIntentHint:
        'Leave status unchanged to add a note only. Change it only when the issue actually moved.',
      fieldAttachments: 'Attachments',
      createNote:
        'Keep this screen practical: enough structure for issues and issue_updates, without growing into a full service workflow.',
      browseIssues: 'Back to issues',
      appendTitle: 'Add issue update',
      appendBody: 'Use one short update to capture what changed, and only change status when the issue really moved.',
      titleRequired: 'Add a short title before saving the issue.',
      firstUpdateRequired: 'Add the first issue update before saving.',
      updateBodyRequired: 'Add a short update before saving history.',
      createSuccess: 'Issue saved.',
      updateSuccess: 'Issue update saved.',
      updateSuccessStatus: 'Issue status updated.',
      updateSuccessResolved: 'Issue resolved and history saved.',
      createFailed: 'Unable to save this issue right now. Please try again.',
      updateFailed: 'Unable to save this issue update right now. Please try again.',
      statusInvalid: 'Choose a valid issue status or leave it unchanged.',
      statusKeepCurrent: 'Keep current status',
      statusOpen: 'Needs attention',
      statusPlanned: 'Planned',
      statusInReview: 'In review',
      statusResolved: 'Resolved',
      loggedLabel: 'Issue logged',
      updateLabelDefault: 'Update added',
      statusUpdatedLabel: 'Status updated',
      resolvedLabel: 'Issue resolved',
    },
    tasks: {
      title: 'Tasks',
      subtitle: 'Use tasks to move an issue forward with clear ownership, progress notes, and completion history.',
      backToHome: 'Back to home',
      create: 'Create task',
      submitCreate: 'Save task',
      submitUpdate: 'Add update',
      previewPill: 'MVP slice',
      previewBody:
        'The task lane stays intentionally narrow for the MVP and now reads from the first persisted task records: actionable work, linked issue context, and update history.',
      emptyTitle: 'No tasks yet in this home',
      emptyBody:
        'Tasks appear here once issue work turns into specific next steps. Start from Issues or open Home to keep the loop moving.',
      emptyFilteredBody:
        'There are no tasks in this filtered view yet. Clear the filter or create the first task from the right issue.',
      emptyTestBody:
        'The TEST home is active, but the canonical linked task has not been seeded yet. Recheck the persisted TEST-home setup before validating the proof path.',
      selectedHomeLabel: 'Selected home',
      filteredByIssue: 'Filtered issue',
      allIssues: 'All issues',
      viewIssue: 'Open issue',
      viewRoom: 'Open room',
      updatesTitle: 'Task history',
      updatesBody: 'Task updates should show progress, blockers, and completion without needing a heavier work-order model.',
      detailBody: 'Task detail should keep the next step obvious and the update trail easy to scan on mobile.',
      createTitle: 'Create task',
      createSubtitle: 'Keep task creation tied to one issue, one next step, and one update trail.',
      draftTitle: 'First task capture seam',
      draftBody:
        'This route now creates real task and task_history records while staying intentionally lightweight for the MVP.',
      fieldHome: 'Home context',
      fieldIssue: 'Parent issue',
      issueLinkNote:
        'Tasks stay linked through one issue in the MVP. Pick the issue first so the task history stays anchored to the right problem.',
      issueMissing:
        'The selected issue is no longer available in this home. Choose another issue before saving the task.',
      fieldSummary: 'Task summary',
      fieldNextStep: 'Next step',
      fieldTask: 'Task title',
      fieldFirstUpdate: 'First update',
      firstUpdateHint:
        'Use the first update to capture the next move, blocker, or handoff that makes this task real.',
      fieldUpdateLabel: 'Update label',
      labelOptionalHint:
        'Optional. Leave this empty to use the default task history label.',
      fieldUpdateBody: 'Update note',
      fieldStatus: 'Status',
      currentStatusLabel: 'Current status',
      statusIntentHint:
        'Leave status unchanged to add a progress note only. Change it only when the task actually moved.',
      fieldAttachments: 'Attachments',
      createNote:
        'The MVP task surface should stay smaller than procurement, supplier assignment, or deep automation flows.',
      browseTasks: 'Back to tasks',
      appendTitle: 'Add task update',
      appendBody: 'Use short task updates to capture progress, blockers, or completion without turning this into a heavier workflow engine.',
      issueRequired: 'Choose an issue before saving the task.',
      titleRequired: 'Add a short task title before saving.',
      firstUpdateRequired: 'Add the first task update before saving.',
      updateBodyRequired: 'Add a short task update before saving history.',
      createSuccess: 'Task saved.',
      updateSuccess: 'Task update saved.',
      updateSuccessStatus: 'Task status updated.',
      updateSuccessCompleted: 'Task completed and history saved.',
      createFailed: 'Unable to save this task right now. Please try again.',
      updateFailed: 'Unable to save this task update right now. Please try again.',
      statusInvalid: 'Choose a valid task status or leave it unchanged.',
      statusKeepCurrent: 'Keep current status',
      statusPlanned: 'Planned',
      statusActive: 'Active',
      statusWaiting: 'Waiting',
      statusDone: 'Done',
      statusCancelled: 'Cancelled',
      createdLabel: 'Task created',
      updateLabelDefault: 'Update added',
      statusUpdatedLabel: 'Status updated',
      completedLabel: 'Task completed',
      createIssueFirstBody:
        'Tasks stay linked through issues in the MVP. Create or open an issue first, then come back here.',
    },
    activity: {
      title: 'History',
      subtitle: 'A home-level place for updates, follow-through, and the secondary messaging lane.',
      overviewTitle: 'History first',
      overviewBody: 'Use this space for issue and task updates first, with chat activity supporting the loop instead of defining it.',
      operationsEmptyTitle: 'No operational history yet',
      operationsEmptyBody:
        'This home does not have issue or task updates yet. Open Issues or Tasks to start leaving a real operational trail.',
      unreadChats: 'Unread chats',
      unreadDms: 'Unread DMs',
      archivedChats: 'Archived chats',
      openChats: 'Open chats',
      openArchived: 'Archived',
      unreadSectionTitle: 'Messaging lane',
      unreadSectionBody: 'Optional communication follow-up while issue and task history becomes the main record.',
      recentTitle: 'Recent message activity',
      recentBody: 'Latest chat traffic stays here as a secondary layer around the work.',
      recentEmptyTitle: 'No recent messages yet',
      recentEmptyBody: 'Message activity will appear here when the communication lane is active.',
      alertsTitle: 'Alerts',
      alertsBody: 'Notification readiness and device-level messaging alerts.',
      digestTitle: 'Future layers later',
      digestBody: 'Recommendations, intelligence, and automation can land later without changing the first loop.',
      quietTitle: 'History is quiet',
      quietBody: 'Nothing in the secondary messaging lane needs attention right now.',
      openTasks: 'Open tasks',
      openTask: 'Open task',
      openHome: 'Open home',
      operationsTitle: 'Operational history',
      operationsBody: 'The first MVP history surface should revolve around these layers.',
      operationsIssues: 'Issue updates',
      operationsTasks: 'Task updates',
      operationsResolutions: 'Resolution notes',
      messagingTitle: 'Messaging stays secondary',
      messagingBody: 'Chat remains useful for coordination, but it should not define the main KeepCozy workflow.',
      recentMessagingTitle: 'Recent message traffic',
      recentMessagingBody: 'Use this lane when conversation context matters around the work.',
      testFlowTitle: 'Primary test flow history',
      testFlowBody:
        'This list is the first end-to-end MVP proof path: one room, one issue, one linked task, and the updates that move the work forward.',
      testFlowPendingBody:
        'The TEST home is active, but the canonical persisted room, issue, task, and history path has not been seeded yet.',
      testFlowMismatchBody:
        'Open the seeded TEST home first so the canonical MVP proof path and history stay aligned.',
    },
    inboxSettings: {
      title: 'Chats settings',
      subtitle: 'Choose how your chats section opens and feels.',
      backToInbox: 'Back to chats',
      saved: 'Chats settings updated.',
      saveChanges: 'Save chats settings',
      saveFailed: 'Unable to update chats settings right now. Please try again.',
      filtersTitle: 'Filters',
      filtersNote:
        'Choose which tabs stay visible in chats and which one opens by default.',
      visibleFiltersTitle: 'Visible filters',
      defaultFilterTitle: 'Default filter',
      defaultFilterNote:
        'Used when you open chats without a filter already selected.',
      groupingTitle: 'Grouping and organization',
      groupingNote: 'Lightweight organization for the main chats list.',
      showGroupsSeparately: 'Show groups separately',
      showPersonalChatsFirst: 'Show personal chats first',
      previewsTitle: 'Message previews',
      previewsNote: 'Choose how message previews appear in your chats list.',
      previewModeShow: 'Show message content',
      previewModeShowNote: 'Show the latest message content normally.',
      previewModeMask: 'Mask message content',
      previewModeMaskNote: 'Hide text and show only a generic preview by message kind.',
      previewModeRevealAfterOpen: 'Reveal after open',
      previewModeRevealAfterOpenNote:
        'Keep previews generic until the chat has been opened and read.',
      viewTitle: 'View preferences',
      viewNote: 'Pick the inbox density that feels best on your phone.',
      densityComfortable: 'Comfortable list density',
      densityCompact: 'Compact list density',
      previewModeShowSummary: 'Show content',
      previewModeMaskSummary: 'Masked',
      previewModeRevealAfterOpenSummary: 'Reveal after opening',
      densityComfortableSummary: 'Comfortable',
      densityCompactSummary: 'Compact',
      summaryShown: 'Shown',
      summaryDefault: 'Default',
      summaryStandard: 'Standard',
      summaryNoExtraRules: 'No extra rules',
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
      pullToRefresh: 'Pull to refresh chats',
      releaseToRefresh: 'Release to refresh',
      refreshing: 'Refreshing chats...',
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
        searchAria: 'Search people',
        searchPlaceholder: 'Search people',
        noUsers: 'No other registered users are available yet.',
        existingDmOnly: 'Everyone here already has a direct chat with you.',
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
      openAvatarPreviewAria: (title) => `Open avatar preview for ${title}`,
      closeAvatarPreview: 'Close avatar preview',
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
      adminOnly: 'Admins only.',
      groupPrivacy: 'Group privacy',
      groupPrivacyNote: 'Choose who can add people to this group.',
      groupPrivacyOpen: 'Open group',
      groupPrivacyOpenNote: 'Any current member can add people.',
      groupPrivacyClosed: 'Closed group',
      groupPrivacyClosedNote: 'Only group admins can add people.',
      groupOpenMembersCanAdd: 'Any current member can add people.',
      groupClosedAdminsOnly: 'Only group admins can add people.',
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
      avatarSchemaRequired: 'Chat photo updates need the latest chat schema update.',
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
      historySection: 'History',
      historyBaselineNote:
        'Hide earlier history on this device and continue from the next message.',
      historyBaselineActiveNote:
        'Earlier history is already hidden for you here. New messages continue from the clean baseline.',
      historyBaselineAction: 'Start fresh from next message',
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
      newMessage: 'New message',
      image: 'Image',
      audio: 'Audio',
      voiceMessage: 'Voice message',
      voiceMessagePlay: 'Play voice message',
      voiceMessagePause: 'Pause voice message',
      voiceMessageLoading: 'Loading voice message',
      voiceMessageUploading: 'Uploading voice message',
      voiceMessageProcessing: 'Preparing voice message',
      voiceMessageFailed: 'Voice message is not available right now.',
      voiceMessageUnavailable: 'Voice message is unavailable on this device.',
      encryptedMessage: 'Encrypted message',
      olderEncryptedMessage: 'Older encrypted message',
      newEncryptedMessage: 'New encrypted message',
      replyToEncryptedMessage: 'Reply to encrypted message',
      encryptedMessageUnavailable: 'Encrypted message is not available on this device.',
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
      voiceRecorderPreparing: 'Preparing…',
      voiceRecorderRecording: 'Recording',
      voiceRecorderDraftReady: 'Ready to send',
      voiceRecorderStop: 'Stop',
      voiceRecorderRetry: 'Try again',
      voiceRecorderRecordAgain: 'Record again',
      voiceRecorderPermissionDenied: 'Microphone access is blocked.',
      voiceRecorderUnavailable: 'Voice recording is not available here.',
      voiceRecorderFailed: 'Could not finish the recording.',
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
      encryptedHistoryUnavailableNote:
        'Not available on this device. New messages in this chat still work.',
      encryptedHistoryPolicyBlockedNote:
        'Sent before your current access to this chat.',
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
      title: 'Откройте рабочее пространство',
      subtitle:
        'Спокойное пространство, чтобы войти в доступные вам пространства и держать работу в движении.',
      openChats: 'Открыть пространство',
      openSettings: 'Открыть профиль',
      logIn: 'Войти',
      watermark: 'KeepCozy by Build With Care',
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
      contextLabel: 'Контекст оболочки KeepCozy',
      loadingTitle: 'Открываем этот дом',
      loadingBody: 'Подготавливаем текущий дом, главные разделы и следующие операционные шаги.',
      errorTitle: 'Не удалось открыть этот вид дома',
      errorBody:
        'Сначала попробуйте снова. Если ошибка повторится, вернитесь на главную или выберите другой контекст дома, прежде чем снова открывать этот раздел.',
      errorProofPathBody:
        'Если вы проверяете канонический TEST-сценарий, снова выберите TEST в переключателе домов перед повторной попыткой.',
      retry: 'Попробовать снова',
      home: 'Главная',
      rooms: 'Комнаты',
      issues: 'Проблемы',
      tasks: 'Задачи',
      chats: 'Чаты',
      spaces: 'Пространства',
      settings: 'Настройки',
      activity: 'История',
      messengerActivity: 'Активность',
      activeHomeLabel: 'Активный дом',
      currentSectionLabel: 'Текущий раздел',
      homeScopeBody: 'Все верхнеуровневые разделы остаются внутри этого дома, пока вы не смените контекст.',
      homeSectionBody: 'Начинайте здесь, чтобы открыть полный рабочий цикл этого дома.',
      roomsSectionBody: 'Используйте комнаты как основу для проблем и задач, которые живут внутри этого дома.',
      issuesSectionBody: 'Отслеживайте структурированные проблемы этого дома и переводите их в задачи.',
      tasksSectionBody: 'Следите за работой, связанной с проблемами этого дома, и держите следующий шаг на виду.',
      activitySectionBody: 'Просматривайте операционную историю и обновления, собранные по всему дому.',
      openHome: 'Открыть главную',
      openRooms: 'Открыть комнаты',
      openIssues: 'Открыть проблемы',
      openTasks: 'Открыть задачи',
      openChats: 'Открыть чаты',
      openSpaces: 'Открыть пространства',
      openSettings: 'Открыть настройки',
      openActivity: 'Открыть историю',
      openMessengerActivity: 'Открыть активность',
    },
    spaces: {
      title: 'Выберите пространство',
      subtitle: 'Сначала откройте нужное пространство.',
      backToChats: 'Назад к рабочему пространству',
      backToSpaces: 'Назад к пространствам',
      currentSpace: 'Текущее пространство',
      openSpace: 'Открыть пространство',
      currentActivityNote:
        'Отсюда открывается правильное рабочее пространство для этого пространства.',
      emptyTitle: 'Пока нет пространств',
      emptyBody: 'Попросите оператора добавить вас в пространство.',
      unavailableTitle: 'Пространства временно недоступны',
      unavailableBody:
        'Попробуйте снова чуть позже, пока доступ к пространствам обновляется.',
      globalAdminEyebrow: 'Глобальный админ',
      createSpaceTitle: 'Создать новое пространство',
      createSpaceBody:
        'Это действие доступно только супер-админам и создает новое управляемое пространство с первыми участниками и администраторами.',
      createSpaceAction: 'Создать пространство',
      createSpaceRouteTitle: 'Создать пространство',
      createSpaceRouteSubtitle:
        'Создайте новое пространство, выберите его основной режим и задайте первый управляемый состав участников.',
      createSpaceRouteBody:
        'Этот поток зарезервирован для супер-админов. Новое пространство создается с чистого листа: без истории и без копирования участников из TEST, если вы не укажете их явно.',
      fieldSpaceName: 'Название пространства',
      fieldSpaceProfile: 'Основной режим',
      fieldParticipantIdentifiers: 'Первые участники',
      fieldAdminIdentifiers: 'Первые админы пространства',
      profileMessengerFull: 'Мессенджер-пространство',
      profileKeepCozyOps: 'KeepCozy ops-пространство',
      profileHint:
        'Мессенджер-пространства открываются с чатов. Пространства KeepCozy открываются с дома, когда включено сохранение профиля пространства.',
      participantIdentifiersHint:
        'Введите по одному email или user ID на строку. Оставьте поле пустым, если хотите начать только с указанных админов. Ничего не копируется из TEST.',
      adminIdentifiersHint:
        'Введите по одному email или user ID на строку. Администраторы автоматически добавляются и как участники, а первый из них становится owner.',
      includeYourselfHint:
        'Добавьте себя в список участников или админов, если вам нужно сразу открыть новое пространство.',
      submitCreateSpace: 'Создать управляемое пространство',
      nameRequired: 'Нужно указать название пространства.',
      testSpaceReservedName:
        'TEST зарезервирован за существующей KeepCozy-песочницей. Для нового мессенджер-пространства используйте другое название.',
      adminIdentifiersRequired:
        'Нужно указать хотя бы одного первого администратора пространства.',
      createSpaceFailed: 'Сейчас не удалось создать пространство.',
      createSpaceSuccess: 'Пространство создано. Откройте его из списка ниже.',
      createSpaceSuccessNoAccess:
        'Пространство создано. Оно не появится в этом списке, пока вы не добавите себя как участника.',
      createSpaceSuccessProfileDeferred:
        'Пространство создано. Здесь ещё не включено сохранение профиля пространства, поэтому пока оно будет открываться в стандартной оболочке, пока не будет применена миграция профиля пространства.',
      createSpaceSuccessNoAccessProfileDeferred:
        'Пространство создано. Оно не появится в этом списке, пока вы не добавите себя как участника, а выбранный режим останется на стандартной оболочке, пока не будет применена миграция профиля пространства.',
      spaceAdminEyebrow: 'Админ пространства',
      manageMembersTitle: 'Управлять участниками текущего пространства',
      manageMembersBody:
        'Добавляйте тестировщиков только в это пространство по точному email или user ID и повышайте выбранных людей до админов пространства без широкого браузера людей.',
      manageMembersAction: 'Управлять участниками',
      manageMembersRouteTitle: 'Управлять участниками',
      manageMembersRouteSubtitle:
        'Добавляйте тестировщиков в это пространство только по явному email или user ID.',
      manageMembersRouteBody:
        'Эта страница меняет состав только для текущего пространства. Она не просматривает и не раскрывает людей из других пространств.',
      membersOrAdminsRequired:
        'Добавьте хотя бы одного участника или админа, чтобы продолжить.',
      manageMembersFailed:
        'Сейчас не удалось обновить участников пространства.',
      manageMembersSuccess:
        'Состав участников этого пространства обновлен.',
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
      statusTitle: 'Статус',
      statusSubtitle: 'Короткая заметка для профиля и будущих поверхностей чатов.',
      statusEmpty: 'Статус пока не задан.',
      statusEmoji: 'Эмодзи',
      statusText: 'Текст статуса',
      statusEmojiPlaceholder: '✨',
      statusTextPlaceholder: 'На созвоне, занят, доступен позже...',
      statusSave: 'Сохранить статус',
      statusEdit: 'Изменить статус',
      statusClear: 'Очистить статус',
      statusUpdated: 'Статус обновлён.',
      statusTextHint: 'Коротко, до 80 символов.',
      statusEmojiTooLong: 'Эмодзи-статус может быть до 16 символов.',
      statusTextTooLong: 'Текст статуса может быть до 80 символов.',
      statusUpdateFailed: 'Сейчас не удалось обновить статус.',
      spaceTitle: 'Пространство',
      spaceSubtitle:
        'Текущая активность по умолчанию открывается в этом пространстве. Меняйте пространство только когда хотите сменить контекст.',
      currentSpaceLabel: 'Текущее пространство',
      noSpaceSelected: 'Пространство пока не выбрано',
      chooseAnotherSpace: 'Выбрать другое пространство',
      logoutTitle: 'Выйти',
      logoutSubtitle: 'Выйти на этом устройстве',
      logoutButton: 'Выйти',
      profileUpdated: 'Профиль обновлён.',
      languageUpdated: 'Язык обновлён.',
    },
    messengerHome: {
      eyebrow: 'Пространство мессенджера',
      subtitle:
        'Используйте это пространство прежде всего для чатов, а затем проверяйте недавнюю активность, не выходя из текущего контекста.',
      overviewTitle: 'Чат-ориентированное пространство',
      overviewBody:
        'Открывайте чаты, чтобы начать общение, просматривайте недавнюю активность, когда нужен контекст, и переключайте пространство только когда нужен другой рабочий контур.',
      activeChatsTitle: 'Активные чаты',
      activeChatsBody: 'Текущие разговоры, которые относятся к этому пространству.',
      unreadChatsBody: 'Чаты в этом пространстве, которые ещё требуют внимания.',
      archivedChatsBody: 'Скрытые чаты остаются доступными, не покидая пространство.',
      recentTitle: 'Продолжить чаты',
      recentBody:
        'Быстро возвращайтесь в разговоры, которые уже движутся внутри этого пространства.',
      profileTitle: 'Профиль и пространство',
      profileBody:
        'Держите профиль и переключение пространства рядом, не превращая их в главный слой оболочки.',
      unreadBadgeLabel: 'Непрочитано',
      groupBadgeLabel: 'Группа',
      openProfileAction: 'Открыть профиль',
      recentEmptyBody: 'Откройте Чаты, чтобы начать следующий разговор в этом пространстве.',
      emptyTitle: 'Это пространство мессенджера начинается с нуля',
      emptyBody:
        'Откройте Чаты, чтобы начать здесь первый разговор. История и участники не копируются автоматически из TEST или любого другого пространства.',
    },
    messengerActivity: {
      subtitle:
        'Следите за непрочитанными чатами и недавним движением сообщений в этом пространстве.',
      overviewTitle: 'Активность сообщений',
      overviewBody:
        'Используйте этот экран, чтобы разбирать непрочитанные чаты, быстро просматривать недавнее движение и возвращаться к архивным разговорам, когда это снова важно.',
      unreadSectionTitle: 'Непрочитанные чаты',
      unreadSectionBody:
        'Разговоры в этом пространстве, которым прежде всего нужно внимание.',
      recentSectionTitle: 'Недавние чаты',
      recentSectionBody:
        'Последнее движение разговоров по этому пространству, сначала самые новые.',
      quietTitle: 'Сейчас ничего не требует внимания',
      quietBody:
        'Непрочитанные разговоры появятся здесь, когда в этом пространстве понадобится ответ.',
      recentEmptyTitle: 'Пока нет недавней активности в чатах',
      recentEmptyBody:
        'Недавняя активность разговоров появится здесь после того, как это пространство начнёт использоваться.',
    },
    homeDashboard: {
      eyebrow: 'Главная дома',
      subtitle:
        'Держите первый MVP-цикл в одном доме, а затем двигайтесь через комнаты, проблемы, задачи и историю.',
      previewPill: 'MVP-срез',
      previewBody:
        'Эта главная намеренно держит в центре первый persisted runtime-срез KeepCozy. Более широкие home-ops слои пока остаются вторичными.',
      currentHomeLabel: 'Текущий дом',
      switchHome: 'Выбрать другой дом',
      loopTitle: 'Первый доказанный цикл',
      loopBody:
        'Используйте этот дом как стартовую точку для комнатных проблем, задач и истории обновлений.',
      roomsTitle: 'Комнаты',
      roomsBody:
        'Привязывайте работу к реальной комнате, прежде чем она расплывется в общую активность.',
      issuesTitle: 'Проблемы',
      issuesBody:
        'Фиксируйте проблему как структурированную запись, а не как просто разговор.',
      tasksTitle: 'Задачи',
      tasksBody:
        'Разбивайте проблему на работу, которая может двигаться и оставлять чистую историю.',
      historyTitle: 'История',
      historyBody:
        'Держите обновления и решение на виду, не делая чат главным рабочим потоком.',
      openRooms: 'Открыть комнаты',
      openIssues: 'Открыть проблемы',
      openTasks: 'Открыть задачи',
      openHistory: 'Открыть историю',
      supportTitle: 'Поддерживающие поверхности',
      supportBody:
        'Профиль и чат остаются доступными, но больше не определяют основной путь продукта.',
      secondaryChatsTitle: 'Чаты',
      secondaryChatsBody: 'Дополнительный канал координации вокруг работы.',
      secondarySettingsTitle: 'Профиль',
      secondarySettingsBody: 'Язык, аккаунт и смена дома по-прежнему живут здесь.',
      testFlowTitle: 'Основной тестовый путь',
      testFlowBody:
        'Используйте одну показательную проблему на кухне, чтобы проверить полный MVP-путь: дом -> комната -> проблема -> задача -> история.',
      testFlowPendingBody:
        'Дом TEST активен, но канонический persisted-путь комната -> проблема -> задача -> история еще не засеян.',
      testFlowMismatchBody:
        'В этой ветке канонический MVP-путь проверяется через seeded-дом TEST. Переключите дом перед проверкой сценария.',
      openChats: 'Открыть чаты',
      openSettings: 'Открыть профиль',
    },
    rooms: {
      title: 'Комнаты',
      subtitle:
        'Комнаты должны быть местом, где проблемы и история задач начинают складываться в понятную картину.',
      backToHome: 'Назад к дому',
      previewPill: 'MVP-срез',
      previewBody:
        'Эти карточки комнат теперь читаются из первого persistence-среза KeepCozy и намеренно остаются узкими вокруг проблем, задач и истории.',
      emptyTitle: 'В этом доме пока нет комнат',
      emptyBody:
        'Комнаты появятся здесь, как только у этого дома появятся записи комнат. Начните с главной или переходите в проблемы, если работа уже зафиксирована.',
      emptyTestBody:
        'Дом TEST активен, но каноническая комната Kitchen еще не засеяна. Проверьте persisted-настройку TEST-дома перед валидацией сценария.',
      selectedHomeLabel: 'Выбранный дом',
      issuesLabel: 'Проблемы',
      tasksLabel: 'Задачи',
      historyLabel: 'Заметка по истории',
      viewIssues: 'Открыть проблемы',
      viewTasks: 'Открыть задачи',
      detailTitle: 'Детали комнаты',
      detailBody:
        'Комната должна собирать связанные проблемы, задачи и историю, не превращаясь в широкую портфельную поверхность.',
      detailHistoryTitle: 'Почему здесь важна история',
    },
    issues: {
      title: 'Проблемы',
      subtitle:
        'Держите проблемы структурированными, привязанными к дому и комнате, и готовыми перейти в задачи.',
      backToHome: 'Назад к дому',
      create: 'Создать проблему',
      submitCreate: 'Сохранить проблему',
      submitUpdate: 'Добавить обновление',
      previewPill: 'MVP-срез',
      previewBody:
        'Это сфокусированная линия проблем для MVP, теперь опирающаяся на первый persisted-срез проблем. Богатые поставщики, рекомендации и автоматизация пока не мешают.',
      emptyTitle: 'В этом доме пока нет проблем',
      emptyBody:
        'Создайте первую проблему, когда в этом доме что-то требует внимания. Держите запись структурированной, чтобы из нее могла вырасти задача и история.',
      emptyFilteredBody:
        'В этом фильтре пока нет проблем. Сбросьте фильтр или создайте первую проблему для этой комнаты.',
      emptyTestBody:
        'Дом TEST активен, но каноническая проблема с краном еще не засеяна. Проверьте persisted-настройку TEST-дома перед валидацией сценария.',
      selectedHomeLabel: 'Выбранный дом',
      filteredByRoom: 'Фильтр по комнате',
      allRooms: 'Все комнаты',
      viewRoom: 'Открыть комнату',
      viewTasks: 'Открыть задачи',
      updatesTitle: 'История проблемы',
      updatesBody:
        'Обновления проблемы должны фиксировать изменения, а не теряться в общем чате.',
      tasksTitle: 'Задачи по этой проблеме',
      tasksBody: 'Именно задачи двигают проблему вперед и доводят ее до решения.',
      detailBody:
        'В деталях проблемы должны быть вместе сама проблема, следующий шаг и история обновлений.',
      createTitle: 'Создать проблему',
      createSubtitle:
        'Держите ввод узким: дом, комната, краткое описание проблемы, первое обновление, затем задачи.',
      draftTitle: 'Первый seam для ввода',
      draftBody:
        'Этот маршрут теперь создает реальные записи issue и issue_history, оставаясь намеренно легким для MVP.',
      fieldHome: 'Контекст дома',
      fieldRoom: 'Комната',
      roomOptionalNote:
        'Необязательно. Оставьте пустым, если проблема относится ко всему дому, а не к одной комнате.',
      roomMissing:
        'Выбранная комната больше недоступна в этом доме. Выберите другую комнату или оставьте проблему на уровне дома.',
      fieldTitle: 'Название проблемы',
      fieldSummary: 'Краткое описание проблемы',
      fieldNextStep: 'Следующий шаг',
      fieldFirstUpdate: 'Первое обновление',
      firstUpdateHint:
        'Используйте первое обновление, чтобы зафиксировать, что вы увидели, что изменилось или что сейчас требует внимания.',
      fieldUpdateLabel: 'Заголовок обновления',
      labelOptionalHint:
        'Необязательно. Оставьте пустым, чтобы использовать стандартный заголовок истории проблемы.',
      fieldUpdateBody: 'Текст обновления',
      fieldStatus: 'Статус',
      currentStatusLabel: 'Текущий статус',
      statusIntentHint:
        'Оставьте статус без изменений, если хотите добавить только заметку. Меняйте его только когда проблема действительно сдвинулась.',
      fieldAttachments: 'Вложения',
      createNote:
        'Экран должен оставаться практичным: достаточно структуры для issues и issue_updates, без разрастания в полный сервисный workflow.',
      browseIssues: 'Назад к проблемам',
      appendTitle: 'Добавить обновление проблемы',
      appendBody:
        'Используйте одно короткое обновление, чтобы зафиксировать изменение, и меняйте статус только когда проблема действительно сдвинулась.',
      titleRequired: 'Добавьте короткое название перед сохранением проблемы.',
      firstUpdateRequired: 'Добавьте первое обновление перед сохранением проблемы.',
      updateBodyRequired: 'Добавьте короткое обновление перед сохранением истории.',
      createSuccess: 'Проблема сохранена.',
      updateSuccess: 'Обновление проблемы сохранено.',
      updateSuccessStatus: 'Статус проблемы обновлен.',
      updateSuccessResolved: 'Проблема решена, история сохранена.',
      createFailed: 'Не удалось сохранить проблему. Попробуйте еще раз.',
      updateFailed: 'Не удалось сохранить обновление проблемы. Попробуйте еще раз.',
      statusInvalid: 'Выберите корректный статус проблемы или оставьте текущий.',
      statusKeepCurrent: 'Оставить текущий статус',
      statusOpen: 'Требует внимания',
      statusPlanned: 'Запланировано',
      statusInReview: 'На разборе',
      statusResolved: 'Решено',
      loggedLabel: 'Проблема зафиксирована',
      updateLabelDefault: 'Обновление добавлено',
      statusUpdatedLabel: 'Статус обновлен',
      resolvedLabel: 'Проблема решена',
    },
    tasks: {
      title: 'Задачи',
      subtitle:
        'Используйте задачи, чтобы двигать проблему вперед с понятной ответственностью, заметками о прогрессе и историей завершения.',
      backToHome: 'Назад к дому',
      create: 'Создать задачу',
      submitCreate: 'Сохранить задачу',
      submitUpdate: 'Добавить обновление',
      previewPill: 'MVP-срез',
      previewBody:
        'Линия задач в MVP намеренно узкая и теперь читается из первого persisted-среза задач: конкретная работа, связанная проблема и история обновлений.',
      emptyTitle: 'В этом доме пока нет задач',
      emptyBody:
        'Задачи появятся здесь, когда работа по проблемам превратится в конкретные следующие шаги. Начните с проблем или откройте главную, чтобы удержать цикл.',
      emptyFilteredBody:
        'В этом фильтре пока нет задач. Сбросьте фильтр или создайте первую задачу из нужной проблемы.',
      emptyTestBody:
        'Дом TEST активен, но каноническая связанная задача еще не засеяна. Проверьте persisted-настройку TEST-дома перед валидацией сценария.',
      selectedHomeLabel: 'Выбранный дом',
      filteredByIssue: 'Фильтр по проблеме',
      allIssues: 'Все проблемы',
      viewIssue: 'Открыть проблему',
      viewRoom: 'Открыть комнату',
      updatesTitle: 'История задачи',
      updatesBody:
        'Обновления задачи должны показывать прогресс, блокеры и завершение без тяжелой модели work order.',
      detailBody:
        'В деталях задачи следующий шаг должен быть очевиден, а цепочка обновлений легко читаться с телефона.',
      createTitle: 'Создать задачу',
      createSubtitle:
        'Держите создание задачи привязанным к одной проблеме, одному следующему шагу и одной истории обновлений.',
      draftTitle: 'Первый seam для задачи',
      draftBody:
        'Этот маршрут теперь создает реальные записи task и task_history, оставаясь намеренно легким для MVP.',
      fieldHome: 'Контекст дома',
      fieldIssue: 'Родительская проблема',
      issueLinkNote:
        'В MVP задачи всегда остаются привязанными к одной проблеме. Сначала выберите проблему, чтобы история задачи оставалась связанной с нужной проблемой.',
      issueMissing:
        'Выбранная проблема больше недоступна в этом доме. Выберите другую проблему перед сохранением задачи.',
      fieldSummary: 'Краткое описание задачи',
      fieldNextStep: 'Следующий шаг',
      fieldTask: 'Название задачи',
      fieldFirstUpdate: 'Первое обновление',
      firstUpdateHint:
        'Используйте первое обновление, чтобы зафиксировать следующий шаг, блокер или передачу работы, которая делает задачу реальной.',
      fieldUpdateLabel: 'Заголовок обновления',
      labelOptionalHint:
        'Необязательно. Оставьте пустым, чтобы использовать стандартный заголовок истории задачи.',
      fieldUpdateBody: 'Текст обновления',
      fieldStatus: 'Статус',
      currentStatusLabel: 'Текущий статус',
      statusIntentHint:
        'Оставьте статус без изменений, если хотите добавить только заметку о прогрессе. Меняйте его только когда задача действительно сдвинулась.',
      fieldAttachments: 'Вложения',
      createNote:
        'Поверхность задачи в MVP должна быть меньше, чем закупки, назначение подрядчиков или глубокая автоматизация.',
      browseTasks: 'Назад к задачам',
      appendTitle: 'Добавить обновление задачи',
      appendBody:
        'Используйте короткие обновления задачи, чтобы фиксировать прогресс, блокеры или завершение, не превращая все в тяжелый workflow engine.',
      issueRequired: 'Выберите проблему перед сохранением задачи.',
      titleRequired: 'Добавьте короткое название задачи перед сохранением.',
      firstUpdateRequired: 'Добавьте первое обновление задачи перед сохранением.',
      updateBodyRequired: 'Добавьте короткое обновление задачи перед сохранением истории.',
      createSuccess: 'Задача сохранена.',
      updateSuccess: 'Обновление задачи сохранено.',
      updateSuccessStatus: 'Статус задачи обновлен.',
      updateSuccessCompleted: 'Задача завершена, история сохранена.',
      createFailed: 'Не удалось сохранить задачу. Попробуйте еще раз.',
      updateFailed: 'Не удалось сохранить обновление задачи. Попробуйте еще раз.',
      statusInvalid: 'Выберите корректный статус задачи или оставьте текущий.',
      statusKeepCurrent: 'Оставить текущий статус',
      statusPlanned: 'Запланирована',
      statusActive: 'Активна',
      statusWaiting: 'Ожидание',
      statusDone: 'Завершена',
      statusCancelled: 'Отменена',
      createdLabel: 'Задача создана',
      updateLabelDefault: 'Обновление добавлено',
      statusUpdatedLabel: 'Статус обновлен',
      completedLabel: 'Задача завершена',
      createIssueFirstBody:
        'В MVP задачи остаются привязанными к проблемам. Сначала создайте или откройте проблему, затем вернитесь сюда.',
    },
    activity: {
      title: 'История',
      subtitle:
        'Поверхность уровня дома для обновлений, движения работы и вторичного коммуникационного слоя.',
      overviewTitle: 'Сначала история',
      overviewBody:
        'Используйте это место прежде всего для обновлений по проблемам и задачам. Чат должен поддерживать цикл, а не определять его.',
      operationsEmptyTitle: 'Операционной истории пока нет',
      operationsEmptyBody:
        'У этого дома еще нет обновлений по проблемам или задачам. Откройте проблемы или задачи, чтобы начать оставлять реальный операционный след.',
      unreadChats: 'Непрочитанные чаты',
      unreadDms: 'Непрочитанные личные',
      archivedChats: 'Архивные чаты',
      openChats: 'Открыть чаты',
      openArchived: 'Архив',
      unreadSectionTitle: 'Коммуникационный слой',
      unreadSectionBody:
        'Дополнительные разговоры, пока история проблем и задач становится основным источником правды.',
      recentTitle: 'Недавняя активность сообщений',
      recentBody: 'Последний чат-трафик остается здесь как вторичный слой вокруг работы.',
      recentEmptyTitle: 'Пока нет недавних сообщений',
      recentEmptyBody: 'Когда коммуникационный слой оживет, сообщения появятся здесь.',
      alertsTitle: 'Оповещения',
      alertsBody: 'Готовность уведомлений и сигналы сообщений на этом устройстве.',
      digestTitle: 'Будущие слои позже',
      digestBody:
        'Рекомендации, интеллект и автоматизация могут появиться позже, не меняя первый цикл.',
      quietTitle: 'История спокойна',
      quietBody: 'Во вторичном коммуникационном слое сейчас ничего не требует внимания.',
      openTasks: 'Открыть задачи',
      openTask: 'Открыть задачу',
      openHome: 'Открыть дом',
      operationsTitle: 'Операционная история',
      operationsBody: 'Первая MVP-поверхность истории должна крутиться вокруг этих слоев.',
      operationsIssues: 'Обновления проблем',
      operationsTasks: 'Обновления задач',
      operationsResolutions: 'Заметки о решении',
      messagingTitle: 'Сообщения остаются вторичными',
      messagingBody:
        'Чат остается полезным для координации, но не должен определять основной путь KeepCozy.',
      recentMessagingTitle: 'Недавний трафик сообщений',
      recentMessagingBody:
        'Используйте этот слой, когда вокруг работы действительно важен разговорный контекст.',
      testFlowTitle: 'История основного тестового пути',
      testFlowBody:
        'Этот список служит первым сквозным MVP-доказательством: одна комната, одна проблема, одна связанная задача и обновления, которые двигают работу вперед.',
      testFlowPendingBody:
        'Дом TEST активен, но канонический persisted-путь комната -> проблема -> задача -> история еще не засеян.',
      testFlowMismatchBody:
        'Сначала откройте seeded-дом TEST, чтобы канонический MVP-сценарий и его история оставались согласованными.',
    },
    inboxSettings: {
      title: 'Настройки чатов',
      subtitle: 'Выберите, как раздел чатов открывается и выглядит.',
      backToInbox: 'Назад в чаты',
      saved: 'Настройки чатов обновлены.',
      saveChanges: 'Сохранить настройки чатов',
      saveFailed: 'Сейчас не удалось обновить настройки чатов. Попробуйте ещё раз.',
      filtersTitle: 'Фильтры',
      filtersNote:
        'Выберите, какие вкладки остаются видимыми в чатах и какая открывается по умолчанию.',
      visibleFiltersTitle: 'Видимые фильтры',
      defaultFilterTitle: 'Фильтр по умолчанию',
      defaultFilterNote:
        'Используется, когда вы открываете чаты без заранее выбранного фильтра.',
      groupingTitle: 'Группировка и организация',
      groupingNote: 'Лёгкая организация для основного списка чатов.',
      showGroupsSeparately: 'Показывать группы отдельно',
      showPersonalChatsFirst: 'Показывать личные чаты первыми',
      previewsTitle: 'Превью сообщений',
      previewsNote: 'Выберите, как превью сообщений выглядят в списке чатов.',
      previewModeShow: 'Показывать текст сообщений',
      previewModeShowNote: 'Показывать последнее сообщение как обычно.',
      previewModeMask: 'Скрывать текст сообщений',
      previewModeMaskNote:
        'Скрывать текст и показывать только общий тип последнего сообщения.',
      previewModeRevealAfterOpen: 'Показывать после открытия',
      previewModeRevealAfterOpenNote:
        'Оставлять превью общим, пока чат не был открыт и прочитан.',
      viewTitle: 'Вид списка',
      viewNote: 'Выберите плотность списка, которая удобнее на телефоне.',
      densityComfortable: 'Комфортная плотность списка',
      densityCompact: 'Компактная плотность списка',
      previewModeShowSummary: 'Показывать текст',
      previewModeMaskSummary: 'Скрыто',
      previewModeRevealAfterOpenSummary: 'После открытия',
      densityComfortableSummary: 'Комфортный',
      densityCompactSummary: 'Компактный',
      summaryShown: 'Видно',
      summaryDefault: 'По умолчанию',
      summaryStandard: 'Стандартно',
      summaryNoExtraRules: 'Без дополнительных правил',
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
      pullToRefresh: 'Потяните вниз, чтобы обновить чаты',
      releaseToRefresh: 'Отпустите, чтобы обновить',
      refreshing: 'Обновляем чаты...',
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
        searchAria: 'Поиск людей',
        searchPlaceholder: 'Поиск людей',
        noUsers: 'Других зарегистрированных пользователей пока нет.',
        existingDmOnly: 'Со всеми доступными людьми у вас уже есть личные чаты.',
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
      openAvatarPreviewAria: (title) => `Открыть фото профиля чата ${title}`,
      closeAvatarPreview: 'Закрыть просмотр аватара',
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
      adminOnly: 'Только админы.',
      groupPrivacy: 'Приватность группы',
      groupPrivacyNote: 'Выберите, кто может добавлять людей в группу.',
      groupPrivacyOpen: 'Открытая группа',
      groupPrivacyOpenNote: 'Любой текущий участник может добавлять людей.',
      groupPrivacyClosed: 'Закрытая группа',
      groupPrivacyClosedNote: 'Добавлять людей могут только админы группы.',
      groupOpenMembersCanAdd: 'Любой текущий участник может добавлять людей.',
      groupClosedAdminsOnly: 'Добавлять людей могут только админы группы.',
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
      avatarSchemaRequired: 'Для обновления фото чата нужна последняя схема чатов.',
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
      historySection: 'История',
      historyBaselineNote:
        'Скрыть более раннюю историю на этом устройстве и продолжить с следующего сообщения.',
      historyBaselineActiveNote:
        'Более ранняя история уже скрыта для вас здесь. Новые сообщения продолжаются от чистой точки.',
      historyBaselineAction: 'Начать заново со следующего сообщения',
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
      newMessage: 'Новое сообщение',
      image: 'Изображение',
      audio: 'Аудио',
      voiceMessage: 'Голосовое сообщение',
      voiceMessagePlay: 'Воспроизвести голосовое сообщение',
      voiceMessagePause: 'Поставить голосовое сообщение на паузу',
      voiceMessageLoading: 'Голосовое сообщение загружается',
      voiceMessageUploading: 'Голосовое сообщение загружается',
      voiceMessageProcessing: 'Голосовое сообщение подготавливается',
      voiceMessageFailed: 'Голосовое сообщение сейчас недоступно.',
      voiceMessageUnavailable: 'Голосовое сообщение недоступно на этом устройстве.',
      encryptedMessage: 'Зашифрованное сообщение',
      olderEncryptedMessage: 'Раннее зашифрованное сообщение',
      newEncryptedMessage: 'Новое зашифрованное сообщение',
      replyToEncryptedMessage: 'Ответ на зашифрованное сообщение',
      encryptedMessageUnavailable:
        'Зашифрованное сообщение недоступно на этом устройстве.',
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
      voiceRecorderPreparing: 'Подготовка…',
      voiceRecorderRecording: 'Идёт запись',
      voiceRecorderDraftReady: 'Готово к отправке',
      voiceRecorderStop: 'Стоп',
      voiceRecorderRetry: 'Повторить',
      voiceRecorderRecordAgain: 'Записать заново',
      voiceRecorderPermissionDenied: 'Нет доступа к микрофону.',
      voiceRecorderUnavailable: 'Запись голоса здесь недоступна.',
      voiceRecorderFailed: 'Не удалось завершить запись.',
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
      encryptedHistoryUnavailableNote:
        'Недоступно на этом устройстве. Новые сообщения в этом чате будут работать.',
      encryptedHistoryPolicyBlockedNote:
        'Отправлено до вашего текущего доступа к этому чату.',
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
