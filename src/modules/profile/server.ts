import 'server-only';

export {
  getCurrentUserProfile,
  getStoredProfileLanguage,
  removeCurrentUserAvatar,
  updateCurrentUserLanguagePreference,
  updateCurrentUserProfile,
  updateCurrentUserStatus,
} from '@/modules/messaging/data/profiles-server';
export type {
  CurrentUserProfile,
  ProfileIdentityRecord,
} from '@/modules/profile/types';
