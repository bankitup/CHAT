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

          <section className="conversation-settings-panel inbox-settings-section stack">
            <div className="stack conversation-settings-panel-copy inbox-settings-section-copy">
              <h2 className="card-title">{t.inboxSettings.filtersTitle}</h2>
              <p className="muted conversation-settings-note">
                {t.inboxSettings.filtersNote}
              </p>
            </div>

            <div className="stack inbox-settings-block inbox-settings-subsection">
              <div className="stack conversation-settings-panel-copy inbox-settings-subsection-copy">
                <h3 className="conversation-settings-subtitle">
                  {t.inboxSettings.visibleFiltersTitle}
                </h3>
              </div>

              <div className="checkbox-list conversation-checkbox-list inbox-settings-option-list">
                {(
                  [
                    ['all', t.inbox.filters.all],
                    ['dm', t.inbox.filters.dm],
                    ['groups', t.inbox.filters.groups],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="checkbox-row inbox-settings-option-row"
                  >
                    <input
                      className="inbox-settings-option-input"
                      defaultChecked={preferences.visibleFilters.includes(value)}
                      name="visibleFilters"
                      type="checkbox"
                      value={value}
                    />
                    <span
                      aria-hidden="true"
                      className="inbox-settings-option-mark"
                    />
                    <span className="checkbox-copy inbox-settings-option-copy">
                      <span className="user-label inbox-settings-option-title">
                        {label}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="stack inbox-settings-block inbox-settings-subsection">
              <div className="stack conversation-settings-panel-copy inbox-settings-subsection-copy">
                <h3 className="conversation-settings-subtitle">
                  {t.inboxSettings.defaultFilterTitle}
                </h3>
                <p className="muted conversation-settings-note">
                  {t.inboxSettings.defaultFilterNote}
                </p>
              </div>

              <div className="checkbox-list conversation-checkbox-list inbox-settings-option-list">
                {(
                  [
                    ['all', t.inbox.filters.all],
                    ['dm', t.inbox.filters.dm],
                    ['groups', t.inbox.filters.groups],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={`default-${value}`}
                    className="checkbox-row inbox-settings-option-row"
                  >
                    <input
                      className="inbox-settings-option-input"
                      defaultChecked={preferences.defaultFilter === value}
                      name="defaultFilter"
                      type="radio"
                      value={value}
                    />
                    <span
                      aria-hidden="true"
                      className="inbox-settings-option-mark"
                    />
                    <span className="checkbox-copy inbox-settings-option-copy">
                      <span className="user-label inbox-settings-option-title">
                        {label}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="conversation-settings-panel inbox-settings-section stack">
            <div className="stack conversation-settings-panel-copy inbox-settings-section-copy">
              <h2 className="card-title">{t.inboxSettings.groupingTitle}</h2>
              <p className="muted conversation-settings-note">
                {t.inboxSettings.groupingNote}
              </p>
            </div>

            <div className="checkbox-list conversation-checkbox-list inbox-settings-option-list">
              <label className="checkbox-row inbox-settings-option-row">
                <input
                  className="inbox-settings-option-input"
                  defaultChecked={preferences.showGroupsSeparately}
                  name="showGroupsSeparately"
                  type="checkbox"
                  value="1"
                />
                <span
                  aria-hidden="true"
                  className="inbox-settings-option-mark"
                />
                <span className="checkbox-copy inbox-settings-option-copy">
                  <span className="user-label inbox-settings-option-title">
                    {t.inboxSettings.showGroupsSeparately}
                  </span>
                </span>
              </label>
              <label className="checkbox-row inbox-settings-option-row">
                <input
                  className="inbox-settings-option-input"
                  defaultChecked={preferences.showPersonalChatsFirst}
                  name="showPersonalChatsFirst"
                  type="checkbox"
                  value="1"
                />
                <span
                  aria-hidden="true"
                  className="inbox-settings-option-mark"
                />
                <span className="checkbox-copy inbox-settings-option-copy">
                  <span className="user-label inbox-settings-option-title">
                    {t.inboxSettings.showPersonalChatsFirst}
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="conversation-settings-panel inbox-settings-section stack">
            <div className="stack conversation-settings-panel-copy inbox-settings-section-copy">
              <h2 className="card-title">{t.inboxSettings.viewTitle}</h2>
              <p className="muted conversation-settings-note">
                {t.inboxSettings.viewNote}
              </p>
            </div>

            <div className="checkbox-list conversation-checkbox-list inbox-settings-option-list">
              <label className="checkbox-row inbox-settings-option-row">
                <input
                  className="inbox-settings-option-input"
                  defaultChecked={preferences.density === 'comfortable'}
                  name="density"
                  type="radio"
                  value="comfortable"
                />
                <span
                  aria-hidden="true"
                  className="inbox-settings-option-mark"
                />
                <span className="checkbox-copy inbox-settings-option-copy">
                  <span className="user-label inbox-settings-option-title">
                    {t.inboxSettings.densityComfortable}
                  </span>
                </span>
              </label>
              <label className="checkbox-row inbox-settings-option-row">
                <input
                  className="inbox-settings-option-input"
                  defaultChecked={preferences.density === 'compact'}
                  name="density"
                  type="radio"
                  value="compact"
                />
                <span
                  aria-hidden="true"
                  className="inbox-settings-option-mark"
                />
                <span className="checkbox-copy inbox-settings-option-copy">
                  <span className="user-label inbox-settings-option-title">
                    {t.inboxSettings.densityCompact}
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="conversation-settings-panel inbox-settings-section stack">
            <div className="stack conversation-settings-panel-copy inbox-settings-section-copy">
              <h2 className="card-title">{t.inboxSettings.previewsTitle}</h2>
              <p className="muted conversation-settings-note">
                {t.inboxSettings.previewsNote}
              </p>
            </div>

            <div className="checkbox-list conversation-checkbox-list inbox-settings-option-list">
              <label className="checkbox-row inbox-settings-option-row">
                <input
                  className="inbox-settings-option-input"
                  defaultChecked={preferences.previewMode === 'show'}
                  name="previewMode"
                  type="radio"
                  value="show"
                />
                <span
                  aria-hidden="true"
                  className="inbox-settings-option-mark"
                />
                <span className="checkbox-copy inbox-settings-option-copy">
                  <span className="user-label inbox-settings-option-title">
                    {t.inboxSettings.previewModeShow}
                  </span>
                  <span className="muted conversation-settings-note">
                    {t.inboxSettings.previewModeShowNote}
                  </span>
                </span>
              </label>
              <label className="checkbox-row inbox-settings-option-row">
                <input
                  className="inbox-settings-option-input"
                  defaultChecked={preferences.previewMode === 'mask'}
                  name="previewMode"
                  type="radio"
                  value="mask"
                />
                <span
                  aria-hidden="true"
                  className="inbox-settings-option-mark"
                />
                <span className="checkbox-copy inbox-settings-option-copy">
                  <span className="user-label inbox-settings-option-title">
                    {t.inboxSettings.previewModeMask}
                  </span>
                  <span className="muted conversation-settings-note">
                    {t.inboxSettings.previewModeMaskNote}
                  </span>
                </span>
              </label>
              <label className="checkbox-row inbox-settings-option-row">
                <input
                  className="inbox-settings-option-input"
                  defaultChecked={preferences.previewMode === 'reveal_after_open'}
                  name="previewMode"
                  type="radio"
                  value="reveal_after_open"
                />
                <span
                  aria-hidden="true"
                  className="inbox-settings-option-mark"
                />
                <span className="checkbox-copy inbox-settings-option-copy">
                  <span className="user-label inbox-settings-option-title">
                    {t.inboxSettings.previewModeRevealAfterOpen}
                  </span>
                  <span className="muted conversation-settings-note">
                    {t.inboxSettings.previewModeRevealAfterOpenNote}
                  </span>
                </span>
              </label>
            </div>
          </section>

          <div className="inbox-settings-actions">
            <div className="inbox-settings-actions-shell">
              <PendingSubmitButton
                className="button inbox-settings-save-button"
                type="submit"
              >
                {t.inboxSettings.saveChanges}
              </PendingSubmitButton>
            </div>
          </div>
        </GuardedServerActionForm>
      </section>
    </section>
  );
}
