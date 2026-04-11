import { logoutAction } from '../actions';
import { updateLanguagePreferenceAction } from './actions';
import { ProfileSettingsForm } from './profile-settings-form';
import { ProfileStatusForm } from './profile-status-form';
import Link from 'next/link';
import type { AppLanguage } from '@/modules/i18n';
import { loadMessengerSettingsPageData } from '@/modules/messaging/server/settings-page';
import { withSpaceParam } from '@/modules/spaces/url';

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    space?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const data = await loadMessengerSettingsPageData(params);

  if (!data) {
    return null;
  }

  return (
    <section className="settings-screen settings-shell settings-layout">
      <div className="stack settings-main-content">
        <section className="stack settings-hero">
          <div className="settings-hero-topbar">
            <div className="settings-language-compact" aria-label={data.t.settings.languageTitle}>
              <form
                action={updateLanguagePreferenceAction}
                className="settings-language-compact-form"
              >
                <input name="preferredLanguage" type="hidden" value="en" />
                <button
                  className={
                    data.currentLanguage === 'en'
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
                    data.currentLanguage === 'ru'
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
        </section>

        {data.visibleError ? <p className="notice notice-error">{data.visibleError}</p> : null}
        {data.message ? (
          <div aria-live="polite" className="notice notice-success notice-inline">
            <span aria-hidden="true" className="notice-check">
              ✓
            </span>
            <span className="notice-copy">{data.message}</span>
          </div>
        ) : null}

        <section className="stack settings-hub">
          <section className="card stack settings-surface settings-home-card settings-home-card-profile">
            <ProfileSettingsForm
              avatarPath={data.profile.avatarPath}
              defaultEmail={data.profile.email ?? ''}
              userId={data.profile.userId}
              defaultDisplayName={data.profile.displayName ?? ''}
              defaultUsername={data.profile.username ?? ''}
              hasAvatar={data.hasAvatar}
              labels={{
                profileTitle: data.t.settings.profileTitle,
                profileSubtitle: data.t.settings.profileSubtitle,
                profilePhoto: data.t.settings.profilePhoto,
                profilePhotoNote: data.t.settings.profilePhotoNote,
                profilePhotoCurrent: data.t.settings.profilePhotoCurrent,
                profilePhotoEmpty: data.t.settings.profilePhotoEmpty,
                displayName: data.t.settings.displayName,
                displayNamePlaceholder: data.t.settings.displayNamePlaceholder,
                saveChanges: data.t.settings.saveChanges,
                editProfile: data.t.settings.editProfile,
                cancelEdit: data.t.settings.cancelEdit,
                tapPhotoToChange: data.t.settings.tapPhotoToChange,
                removePhoto: data.t.settings.removePhoto,
                avatarTooLarge: data.t.settings.avatarTooLarge,
                avatarInvalidType: data.t.settings.avatarInvalidType,
                avatarUploading: data.t.settings.avatarUploading,
                avatarUploadFailed: data.t.settings.avatarUploadFailed,
                avatarStorageUnavailable: data.t.settings.avatarStorageUnavailable,
                profileUpdateFailed: data.t.settings.profileUpdateFailed,
                avatarEditorHint: data.t.settings.avatarEditorHint,
                avatarEditorZoom: data.t.settings.avatarEditorZoom,
                avatarEditorApply: data.t.settings.avatarEditorApply,
                avatarEditorDraftReady: data.t.settings.avatarEditorDraftReady,
                avatarEditorPreparing: data.t.settings.avatarEditorPreparing,
                avatarEditorLoadFailed: data.t.settings.avatarEditorLoadFailed,
                avatarEditorApplyBeforeSave: data.t.settings.avatarEditorApplyBeforeSave,
              }}
              spaceId={data.activeSpaceId}
            />
          </section>

          <section className="card stack settings-surface settings-home-card">
            <ProfileStatusForm
              key={`profile-status-${data.profile.statusEmoji ?? ''}-${data.profile.statusText ?? ''}-${data.profile.statusUpdatedAt ?? ''}`}
              defaultStatusEmoji={data.profile.statusEmoji ?? ''}
              defaultStatusText={data.profile.statusText ?? ''}
              labels={{
                statusTitle: data.t.settings.statusTitle,
                statusSubtitle: data.t.settings.statusSubtitle,
                statusEmpty: data.t.settings.statusEmpty,
                statusEmoji: data.t.settings.statusEmoji,
                statusText: data.t.settings.statusText,
                statusEmojiPlaceholder: data.t.settings.statusEmojiPlaceholder,
                statusTextPlaceholder: data.t.settings.statusTextPlaceholder,
                statusSave: data.t.settings.statusSave,
                statusEdit: data.t.settings.statusEdit,
                statusClear: data.t.settings.statusClear,
                cancelEdit: data.t.settings.cancelEdit,
                statusTextHint: data.t.settings.statusTextHint,
                statusEmojiTooLong: data.t.settings.statusEmojiTooLong,
                statusTextTooLong: data.t.settings.statusTextTooLong,
              }}
              language={data.currentLanguage as AppLanguage}
              spaceId={data.activeSpaceId}
              statusUpdatedAt={data.profile.statusUpdatedAt}
            />
          </section>

          <section className="card stack settings-surface settings-home-card">
            <div className="stack settings-card-copy settings-section-copy">
              <h2 className="section-title">{data.t.settings.spaceTitle}</h2>
              <p className="muted">{data.t.settings.spaceSubtitle}</p>
            </div>

            <div className="settings-space-summary">
              <div className="stack settings-space-copy">
                <span className="settings-space-label">
                  {data.t.settings.currentSpaceLabel}
                </span>
                <strong className="settings-space-name">
                  {data.activeSpaceName ?? data.t.settings.noSpaceSelected}
                </strong>
              </div>

              <Link
                className="button button-secondary settings-space-switch"
                href={withSpaceParam('/spaces', data.activeSpaceId)}
                prefetch={false}
              >
                {data.t.settings.chooseAnotherSpace}
              </Link>
            </div>
          </section>
        </section>
      </div>

      <div className="settings-bottom-actions">
        <section className="card stack settings-surface settings-home-card settings-home-card-session">
          <div className="stack settings-card-copy settings-section-copy">
            <h2 className="section-title">{data.t.settings.logoutTitle}</h2>
            <p className="muted">{data.t.settings.logoutSubtitle}</p>
          </div>

          <form action={logoutAction}>
            <button className="button button-secondary settings-logout-button" type="submit">
              {data.t.settings.logoutButton}
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}
