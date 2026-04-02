import { logoutAction } from '../actions';
import { updateProfileAction } from './actions';
import { NotificationReadinessPanel } from './notification-readiness';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getCurrentUserProfile,
  PROFILE_AVATAR_ACCEPT,
} from '@/modules/messaging/data/server';
import { IdentityAvatar } from '@/modules/messaging/ui/identity';

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

function getProfileLabel(email: string | null, displayName: string | null) {
  if (displayName?.trim()) {
    return displayName.trim();
  }

  if (email?.trim()) {
    return email.trim().split('@')[0] || 'You';
  }

  return 'You';
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
  const profileLabel = getProfileLabel(profile.email, profile.displayName);

  return (
    <section className="stack settings-screen">
      <section className="card stack settings-card profile-settings-hero">
        <div className="profile-settings-summary">
          <IdentityAvatar
            identity={{
              userId: profile.userId,
              displayName: profile.displayName,
              avatarPath: profile.avatarPath,
            }}
            label={profileLabel}
            size="lg"
          />

          <div className="stack profile-settings-copy">
            <p className="eyebrow">You</p>
            <h1 className="section-title">{profileLabel}</h1>
            <p className="muted profile-settings-email">
              {profile.email ?? 'Your account'}
            </p>
          </div>
        </div>
      </section>

      {params.error ? <p className="notice notice-error">{params.error}</p> : null}
      {params.message ? <p className="notice">{params.message}</p> : null}

      <section className="card stack settings-card">
        <div className="stack settings-card-copy">
          <p className="eyebrow">Account</p>
          <h2 className="section-title">Profile</h2>
          <p className="muted">
            Update the name and photo people see in your chats.
          </p>
        </div>

        <form action={updateProfileAction} className="stack profile-settings-form">
          <label className="field profile-avatar-field">
            <span>Avatar</span>
            <input
              className="input profile-file-input"
              name="avatar"
              accept={PROFILE_AVATAR_ACCEPT}
              type="file"
            />
            <span className="muted profile-field-note">
              JPG, PNG, WEBP, or GIF up to 5 MB.
            </span>
          </label>

          <label className="field">
            <span>Display name</span>
            <input
              className="input"
              defaultValue={profile.displayName ?? ''}
              name="displayName"
              placeholder="Your name"
              maxLength={40}
            />
          </label>

          <button className="button" type="submit">
            Save profile
          </button>
        </form>
      </section>

      <NotificationReadinessPanel />

      <section className="card stack settings-card">
        <div className="stack settings-card-copy">
          <p className="eyebrow">Session</p>
          <h2 className="section-title">Account</h2>
          <p className="muted">
            You can sign out on this device any time.
          </p>
        </div>

        <form action={logoutAction}>
          <button className="button button-secondary settings-logout-button" type="submit">
            Log out
          </button>
        </form>
      </section>
    </section>
  );
}
