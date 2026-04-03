import { logoutAction } from '../actions';
import { updateLanguagePreferenceAction, updateProfileAction } from './actions';
import { NotificationReadinessPanel } from './notification-readiness';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getCurrentUserProfile,
  PROFILE_AVATAR_ACCEPT,
} from '@/modules/messaging/data/server';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import { IdentityAvatar } from '@/modules/messaging/ui/identity';
import Link from 'next/link';

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

function getProfileLabel(
  email: string | null,
  displayName: string | null,
  fallbackLabel: string,
) {
  if (displayName?.trim()) {
    return displayName.trim();
  }

  if (email?.trim()) {
    return email.trim().split('@')[0] || fallbackLabel;
  }

  return fallbackLabel;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return null;
  }

  const profile = await getCurrentUserProfile(user.id, user.email ?? null);
  const language = await getRequestLanguage(profile.preferredLanguage);
  const t = getTranslations(language);
  const profileLabel = getProfileLabel(profile.email, profile.displayName, t.settings.heroEyebrow);
  const currentLanguage = (profile.preferredLanguage ?? language) as AppLanguage;

  return (
    <section className="stack settings-screen settings-shell">
      <div className="settings-topbar settings-topbar-light">
        <Link
          aria-label={t.settings.backToChats}
          className="back-arrow-link settings-back-link"
          href="/inbox"
        >
          <span aria-hidden="true">←</span>
        </Link>
      </div>

      <section className="stack settings-hero">
        <div className="profile-settings-summary settings-hero-summary">
          <IdentityAvatar
            identity={{
              userId: profile.userId,
              displayName: profile.displayName,
              avatarPath: profile.avatarPath,
            }}
            label={profileLabel}
            size="lg"
          />

          <div className="stack profile-settings-copy settings-hero-copy">
            <p className="eyebrow">{t.settings.heroEyebrow}</p>
            <h1 className="settings-hero-title">{profileLabel}</h1>
            <p className="muted profile-settings-email">
              {profile.email ?? t.settings.profileFallback}
            </p>
          </div>
        </div>
        <p className="muted settings-hero-note">{t.settings.heroNote}</p>
      </section>

      {params.error ? <p className="notice notice-error">{params.error}</p> : null}
      {params.message ? <p className="notice">{params.message}</p> : null}

      <section className="card stack settings-surface">
        <section className="stack settings-section">
          <div className="stack settings-card-copy settings-section-copy">
            <h2 className="section-title">{t.settings.profileTitle}</h2>
            <p className="muted">{t.settings.profileSubtitle}</p>
          </div>

          <form action={updateProfileAction} className="stack profile-settings-form">
            <label className="field profile-avatar-field">
              <span>{t.settings.profilePhoto}</span>
              <input
                className="input profile-file-input"
                name="avatar"
                accept={PROFILE_AVATAR_ACCEPT}
                type="file"
              />
              <span className="muted profile-field-note">
                {t.settings.profilePhotoNote}
              </span>
            </label>

            <label className="field">
              <span>{t.settings.displayName}</span>
              <input
                className="input"
                defaultValue={profile.displayName ?? ''}
                name="displayName"
                placeholder={t.settings.displayNamePlaceholder}
                maxLength={40}
              />
            </label>

            <button className="button" type="submit">
              {t.settings.saveChanges}
            </button>
          </form>
        </section>

        <section className="stack settings-section">
          <div className="stack settings-card-copy settings-section-copy">
            <h2 className="section-title">{t.settings.languageTitle}</h2>
            <p className="muted">{t.settings.languageSubtitle}</p>
          </div>

          <form action={updateLanguagePreferenceAction} className="settings-language-form">
            <input name="preferredLanguage" type="hidden" value="en" />
            <button
              className={
                currentLanguage === 'en'
                  ? 'settings-language-button settings-language-button-active'
                  : 'settings-language-button'
              }
              type="submit"
            >
              <span className="settings-language-title">{t.settings.languageEnglish}</span>
            </button>
          </form>

          <form action={updateLanguagePreferenceAction} className="settings-language-form">
            <input name="preferredLanguage" type="hidden" value="ru" />
            <button
              className={
                currentLanguage === 'ru'
                  ? 'settings-language-button settings-language-button-active'
                  : 'settings-language-button'
              }
              type="submit"
            >
              <span className="settings-language-title">{t.settings.languageRussian}</span>
            </button>
          </form>
        </section>

        <NotificationReadinessPanel embedded language={language} />

        <section className="stack settings-section settings-section-session">
          <div className="stack settings-card-copy settings-section-copy">
            <h2 className="section-title">{t.settings.logoutTitle}</h2>
            <p className="muted">{t.settings.logoutSubtitle}</p>
          </div>

          <form action={logoutAction}>
            <button className="button button-secondary settings-logout-button" type="submit">
              {t.settings.logoutButton}
            </button>
          </form>
        </section>
      </section>
    </section>
  );
}
