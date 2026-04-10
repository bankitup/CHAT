'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { saveHomeSpaceThemeAction } from './actions';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { type SpaceTheme } from '@/modules/spaces/model';

type SpaceThemeCardProps = {
  currentTheme: SpaceTheme;
  language: AppLanguage;
  spaceId: string;
};

function applySpaceThemeToActiveShell(theme: SpaceTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  const shell = document.querySelector<HTMLElement>('.page.app-shell');

  if (!shell) {
    return;
  }

  shell.dataset.spaceTheme = theme;
}

function resolveThemeOptionCopy(input: {
  theme: SpaceTheme;
  t: ReturnType<typeof getTranslations>;
}) {
  if (input.theme === 'light') {
    return {
      hint: input.t.homeDashboard.spaceThemeLightHint,
      label: input.t.homeDashboard.spaceThemeLightLabel,
    };
  }

  return {
    hint: input.t.homeDashboard.spaceThemeDarkHint,
    label: input.t.homeDashboard.spaceThemeDarkLabel,
  };
}

export function SpaceThemeCard({
  currentTheme: initialTheme,
  language,
  spaceId,
}: SpaceThemeCardProps) {
  const router = useRouter();
  const t = getTranslations(language);
  const [currentTheme, setCurrentTheme] = useState<SpaceTheme>(initialTheme);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  useEffect(() => {
    setCurrentTheme(initialTheme);
    applySpaceThemeToActiveShell(initialTheme);
  }, [initialTheme]);

  const handleSelectTheme = useCallback(
    (nextTheme: SpaceTheme) => {
      if (nextTheme === currentTheme || isSaving) {
        return;
      }

      const previousTheme = currentTheme;
      setCurrentTheme(nextTheme);
      setErrorMessage(null);
      applySpaceThemeToActiveShell(nextTheme);

      startTransition(async () => {
        const result = await saveHomeSpaceThemeAction({
          language,
          spaceId,
          theme: nextTheme,
        });

        if (!result.ok) {
          setCurrentTheme(previousTheme);
          setErrorMessage(result.error);
          applySpaceThemeToActiveShell(previousTheme);
          return;
        }

        router.refresh();
      });
    },
    [currentTheme, isSaving, language, router, spaceId],
  );

  return (
    <section className="card stack settings-surface settings-home-card space-theme-card">
      <div className="stack space-theme-panel">
        <div className="space-theme-header">
          <div className="stack settings-card-copy settings-section-copy">
            <h2 className="section-title">{t.homeDashboard.spaceThemeTitle}</h2>
            <p className="muted">{t.homeDashboard.spaceThemeBody}</p>
          </div>
          <span className="summary-pill summary-pill-muted">
            {t.homeDashboard.spaceThemeSpaceWideBadge}
          </span>
        </div>

        <div className="space-theme-option-list">
          {(['dark', 'light'] as const).map((theme) => {
            const optionCopy = resolveThemeOptionCopy({ t, theme });
            const isActive = currentTheme === theme;

            return (
              <button
                key={theme}
                aria-pressed={isActive}
                className={
                  isActive
                    ? 'space-theme-option space-theme-option-active'
                    : 'space-theme-option'
                }
                disabled={isSaving && !isActive}
                onClick={() => handleSelectTheme(theme)}
                type="button"
              >
                <span className="space-theme-option-copy">
                  <span className="space-theme-option-title">
                    {optionCopy.label}
                  </span>
                  <span className="space-theme-option-hint">
                    {optionCopy.hint}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="space-theme-preview"
                  data-space-theme-preview={theme}
                >
                  <span className="space-theme-preview-bar space-theme-preview-bar-wide" />
                  <span className="space-theme-preview-bar" />
                  <span className="space-theme-preview-chip" />
                </span>
                {isActive ? (
                  <span className="summary-pill summary-pill-muted space-theme-option-state">
                    {t.homeDashboard.spaceThemeCurrentBadge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="space-theme-note">{t.homeDashboard.spaceThemeNote}</p>

        {errorMessage ? (
          <p className="notice notice-error space-theme-error">{errorMessage}</p>
        ) : null}
      </div>
    </section>
  );
}
