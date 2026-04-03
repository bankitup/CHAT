'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  LANGUAGE_COOKIE_NAME,
  type AppLanguage,
  getTranslations,
} from '@/modules/i18n';
import { DmE2eePublicBoundaryCleanup } from '@/modules/messaging/e2ee/local-state-boundary';

type PublicHomeScreenProps = {
  initialLanguage: AppLanguage;
  isAuthenticated: boolean;
};

function persistLanguage(language: AppLanguage) {
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${language}; path=/; max-age=31536000; samesite=lax`;
}

export function PublicHomeScreen({
  initialLanguage,
  isAuthenticated,
}: PublicHomeScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(initialLanguage);
  const t = getTranslations(language);

  function handleLanguageChange(nextLanguage: AppLanguage) {
    setLanguage(nextLanguage);
    persistLanguage(nextLanguage);
  }

  return (
    <main className="page stack public-home">
      {!isAuthenticated ? <DmE2eePublicBoundaryCleanup /> : null}
      <div className="public-home-language">
        <div className="public-home-language-switch" aria-label={t.languageSwitcher.label}>
          <button
            className={
              language === 'en'
                ? 'public-home-language-button public-home-language-button-active'
                : 'public-home-language-button'
            }
            onClick={() => handleLanguageChange('en')}
            type="button"
          >
            {t.languageSwitcher.en}
          </button>
          <button
            className={
              language === 'ru'
                ? 'public-home-language-button public-home-language-button-active'
                : 'public-home-language-button'
            }
            onClick={() => handleLanguageChange('ru')}
            type="button"
          >
            {t.languageSwitcher.ru}
          </button>
        </div>
      </div>

      <section className="stack public-home-hero">
        <p className="public-home-name">Chat</p>
        <h1 className="title public-home-title">{t.publicHome.title}</h1>
        <p className="subtitle public-home-subtitle">
          {t.publicHome.subtitle}
        </p>
        <section
          className="public-home-actions"
          aria-label={
            isAuthenticated ? t.publicHome.authActionsAria : t.publicHome.guestActionsAria
          }
        >
          {isAuthenticated ? (
            <>
              <Link className="pill pill-accent public-home-action-primary" href="/spaces">
                {t.publicHome.openChats}
              </Link>
              <Link className="pill public-home-action-secondary" href="/settings">
                {t.publicHome.openSettings}
              </Link>
            </>
          ) : (
            <Link className="pill pill-accent public-home-action-primary" href="/login">
              {t.publicHome.logIn}
            </Link>
          )}
        </section>
      </section>

      <p className="public-home-watermark">{t.publicHome.watermark}</p>
    </main>
  );
}
