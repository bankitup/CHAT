import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import { getInboxSectionPreferences } from '@/modules/messaging/inbox/preferences-server';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import { withSpaceParam } from '@/modules/spaces/url';
import { saveInboxPreferencesAction } from '../actions';
import { GuardedServerActionForm } from '../../guarded-server-action-form';
import { PendingSubmitButton } from '../../pending-submit-button';

type InboxSettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    space?: string;
  }>;
};

export default async function InboxSettingsPage({
  searchParams,
}: InboxSettingsPageProps) {
  const [query, user, language, preferences] = await Promise.all([
    searchParams,
    getRequestViewer(),
    getRequestLanguage(),
    getInboxSectionPreferences(),
  ]);

  if (!user?.id) {
    redirect('/login');
  }

  const t = getTranslations(language);
  const activeSpaceId = query.space?.trim() || null;
  const visibleError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'inbox'),
        language,
        rawMessage: query.error,
      })
    : null;
  const hasSavedState = query.saved === '1';

  return (
    <section className="stack settings-screen settings-shell inbox-settings-route-screen">
      <section className="stack settings-hero inbox-settings-route-hero">
        <div className="inbox-settings-route-header">
          <Link
            aria-label={t.inboxSettings.backToInbox}
            className="back-arrow-link conversation-settings-back-link"
            href={withSpaceParam('/inbox', activeSpaceId)}
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        <div className="stack inbox-settings-route-copy">
          <h1 className="settings-hero-title">{t.inboxSettings.title}</h1>
          <p className="muted">{t.inboxSettings.subtitle}</p>
        </div>
      </section>

      <section className="card stack settings-surface inbox-settings-route-surface">
        {visibleError ? <p className="notice notice-error">{visibleError}</p> : null}

        {hasSavedState ? (
          <div aria-live="polite" className="notice notice-success notice-inline">
            <span aria-hidden="true" className="notice-check">
              ✓
            </span>
            <span className="notice-copy">{t.inboxSettings.saved}</span>
          </div>
        ) : null}

        <GuardedServerActionForm
          action={saveInboxPreferencesAction}
          className="stack inbox-settings-form"
        >
          <input name="spaceId" type="hidden" value={activeSpaceId ?? ''} />

          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h2 className="card-title">{t.inboxSettings.filtersTitle}</h2>
              <p className="muted conversation-settings-note">
                {t.inboxSettings.filtersNote}
              </p>
            </div>

            <div className="stack inbox-settings-block">
              <div className="stack conversation-settings-panel-copy">
                <h3 className="conversation-settings-subtitle">
                  {t.inboxSettings.visibleFiltersTitle}
                </h3>
              </div>

              <div className="checkbox-list conversation-checkbox-list">
                {(
                  [
                    ['all', t.inbox.filters.all],
                    ['dm', t.inbox.filters.dm],
                    ['groups', t.inbox.filters.groups],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="checkbox-row">
                    <input
                      defaultChecked={preferences.visibleFilters.includes(value)}
                      name="visibleFilters"
                      type="checkbox"
                      value={value}
                    />
                    <span className="checkbox-copy">
                      <span className="user-label">{label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="stack inbox-settings-block">
              <div className="stack conversation-settings-panel-copy">
                <h3 className="conversation-settings-subtitle">
                  {t.inboxSettings.defaultFilterTitle}
                </h3>
                <p className="muted conversation-settings-note">
                  {t.inboxSettings.defaultFilterNote}
                </p>
              </div>

              <div className="checkbox-list conversation-checkbox-list">
                {(
                  [
                    ['all', t.inbox.filters.all],
                    ['dm', t.inbox.filters.dm],
                    ['groups', t.inbox.filters.groups],
                  ] as const
                ).map(([value, label]) => (
                  <label key={`default-${value}`} className="checkbox-row">
                    <input
                      defaultChecked={preferences.defaultFilter === value}
                      name="defaultFilter"
                      type="radio"
                      value={value}
                    />
                    <span className="checkbox-copy">
                      <span className="user-label">{label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h2 className="card-title">{t.inboxSettings.groupingTitle}</h2>
              <p className="muted conversation-settings-note">
                {t.inboxSettings.groupingNote}
              </p>
            </div>

            <div className="checkbox-list conversation-checkbox-list">
              <label className="checkbox-row">
                <input
                  defaultChecked={preferences.showGroupsSeparately}
                  name="showGroupsSeparately"
                  type="checkbox"
                  value="1"
                />
                <span className="checkbox-copy">
                  <span className="user-label">{t.inboxSettings.showGroupsSeparately}</span>
                </span>
              </label>
              <label className="checkbox-row">
                <input
                  defaultChecked={preferences.showPersonalChatsFirst}
                  name="showPersonalChatsFirst"
                  type="checkbox"
                  value="1"
                />
                <span className="checkbox-copy">
                  <span className="user-label">{t.inboxSettings.showPersonalChatsFirst}</span>
                </span>
              </label>
            </div>
          </section>

          <section className="conversation-settings-panel stack">
            <div className="stack conversation-settings-panel-copy">
              <h2 className="card-title">{t.inboxSettings.viewTitle}</h2>
              <p className="muted conversation-settings-note">
                {t.inboxSettings.viewNote}
              </p>
            </div>

            <div className="checkbox-list conversation-checkbox-list">
              <label className="checkbox-row">
                <input
                  defaultChecked={preferences.density === 'comfortable'}
                  name="density"
                  type="radio"
                  value="comfortable"
                />
                <span className="checkbox-copy">
                  <span className="user-label">{t.inboxSettings.densityComfortable}</span>
                </span>
              </label>
              <label className="checkbox-row">
                <input
                  defaultChecked={preferences.density === 'compact'}
                  name="density"
                  type="radio"
                  value="compact"
                />
                <span className="checkbox-copy">
                  <span className="user-label">{t.inboxSettings.densityCompact}</span>
                </span>
              </label>
            </div>
          </section>

          <div className="inbox-settings-actions">
            <PendingSubmitButton className="button" type="submit">
              {t.inboxSettings.saveChanges}
            </PendingSubmitButton>
          </div>
        </GuardedServerActionForm>
      </section>
    </section>
  );
}
