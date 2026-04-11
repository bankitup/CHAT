import type { AppLanguage } from '@/modules/i18n';

export type ProfileIdentityRecord = {
  userId: string;
  displayName: string | null;
  username?: string | null;
  email?: string | null;
  emailLocalPart?: string | null;
  avatarPath?: string | null;
  statusEmoji?: string | null;
  statusText?: string | null;
  statusUpdatedAt?: string | null;
};

export type CurrentUserProfile = {
  userId: string;
  email: string | null;
  displayName: string | null;
  username: string | null;
  avatarPath: string | null;
  preferredLanguage: AppLanguage | null;
  statusEmoji: string | null;
  statusText: string | null;
  statusUpdatedAt: string | null;
};
