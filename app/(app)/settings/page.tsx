import { logoutAction } from '../actions';
import { updateLanguagePreferenceAction } from './actions';
import { ProfileSettingsForm } from './profile-settings-form';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/modules/messaging/data/server';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import { IdentityAvatar } from '@/modules/messaging/ui/identity';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';

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
  const hasAvatar = Boolean(profile.avatarPath);
  const visibleError = params.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'settings'),
        language,
        rawMessage: params.error,
      })
    : null;

  return (
    <section className="settings-screen settings-shell settings-layout">
      <div className="stack settings-main-content">
        <section className="stack settings-hero">
          <div className="settings-hero-topbar">
            <div className="settings-language-compact" aria-label={t.settings.languageTitle}>
              <form
                action={updateLanguagePreferenceAction}
                className="settings-language-compact-form"
              >
                <input name="preferredLanguage" type="hidden" value="en" />
                <button
                  className={
                    currentLanguage === 'en'
                      ? 'settings-language-compact-button settings-language-compact-button-active'
                      : 'settings-language-compact-button'
                  }
                  type="submit"
                >
                  EN
                </button>
              </form>

              <form
                action={updateLanguagePreferenceAction}
                className="settings-language-compact-form"
              >
                <input name="preferredLanguage" type="hidden" value="ru" />
                <button
                  className={
                    currentLanguage === 'ru'
                      ? 'settings-language-compact-button settings-language-compact-button-active'
                      : 'settings-language-compact-button'
                  }
                  type="submit"
                >
                  RU
                </button>
              </form>
            </div>
          </div>

          <div className="profile-settings-summary settings-hero-summary">
            <IdentityAvatar
              diagnosticsSurface="settings:profile-summary"
              identity={{
                userId: profile.userId,
                displayName: profile.displayName,
                avatarPath: profile.avatarPath,
              }}
              label={profileLabel}
              size="lg"
            />

            <div className="stack profile-settings-copy settings-hero-copy">
              <h1 className="settings-hero-title">{profileLabel}</h1>
              <p className="muted profile-settings-email">
                {profile.email ?? t.settings.profileFallback}
              </p>
            </div>
          </div>
          <div className="cluster settings-hero-pills">
            {profile.email ? (
              <span className="summary-pill settings-hero-pill settings-hero-pill-subtle">
                {profile.email}
              </span>
            ) : null}
          </div>
        </section>

        {visibleError ? <p className="notice notice-error">{visibleError}</p> : null}
        {params.message ? (
          <div aria-live="polite" className="notice notice-success notice-inline">
            <span aria-hidden="true" className="notice-check">
              ✓
            </span>
            <span className="notice-copy">{params.message}</span>
          </div>
        ) : null}

        <section className="stack settings-hub">
          <section className="card stack settings-surface settings-home-card">
            <ProfileSettingsForm
              avatarPath={profile.avatarPath}
              userId={profile.userId}
              defaultDisplayName={profile.displayName ?? ''}
              hasAvatar={hasAvatar}
              labels={{
                profileTitle: t.settings.profileTitle,
                profileSubtitle: t.settings.profileSubtitle,
                profilePhoto: t.settings.profilePhoto,
                profilePhotoNote: t.settings.profilePhotoNote,
                profilePhotoCurrent: t.settings.profilePhotoCurrent,
                profilePhotoEmpty: t.settings.profilePhotoEmpty,
                displayName: t.settings.displayName,
                displayNamePlaceholder: t.settings.displayNamePlaceholder,
                saveChanges: t.settings.saveChanges,
                editProfile: t.settings.editProfile,
                cancelEdit: t.settings.cancelEdit,
                tapPhotoToChange: t.settings.tapPhotoToChange,
                removePhoto: t.settings.removePhoto,
                avatarTooLarge: t.settings.avatarTooLarge,
                avatarInvalidType: t.settings.avatarInvalidType,
                avatarUploading: t.settings.avatarUploading,
                avatarUploadFailed: t.settings.avatarUploadFailed,
                avatarStorageUnavailable: t.settings.avatarStorageUnavailable,
                profileUpdateFailed: t.settings.profileUpdateFailed,
                avatarEditorHint: t.settings.avatarEditorHint,
                avatarEditorZoom: t.settings.avatarEditorZoom,
                avatarEditorApply: t.settings.avatarEditorApply,
                avatarEditorDraftReady: t.settings.avatarEditorDraftReady,
                avatarEditorPreparing: t.settings.avatarEditorPreparing,
                avatarEditorLoadFailed: t.settings.avatarEditorLoadFailed,
                avatarEditorApplyBeforeSave: t.settings.avatarEditorApplyBeforeSave,
              }}
            />
          </section>
        </section>
      </div>

      <div className="settings-bottom-actions">
        <section className="card stack settings-surface settings-home-card settings-home-card-session">
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
      </div>
    </section>
  );
}
