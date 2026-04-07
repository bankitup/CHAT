import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginAction } from '../actions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations } from '@/modules/i18n';
import { getCookieLanguage } from '@/modules/i18n/server';
import { DmE2eePublicBoundaryCleanup } from '@/modules/messaging/e2ee/local-state-boundary';
import { resolveHomeHrefForUser } from '@/modules/spaces/server';

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(
      await resolveHomeHrefForUser({
        userId: user.id,
        source: 'login-page',
      }),
    );
  }

  const params = await searchParams;
  const language = await getCookieLanguage();
  const t = getTranslations(language);

  return (
    <main className="page auth-page">
      <DmE2eePublicBoundaryCleanup />
      <section className="stack auth-shell auth-shell-login">
        <section className="auth-topbar">
          <Link
            aria-label={t.login.backToHome}
            className="back-arrow-link auth-back-link"
            href="/"
          >
            <span aria-hidden="true">←</span>
          </Link>
        </section>

        <section className="card stack auth-card">
          <div className="stack auth-card-copy">
            <h1 className="auth-title">{t.login.title}</h1>
            <p className="muted auth-subtitle">{t.login.subtitle}</p>
          </div>

          {params.error ? (
            <p className="notice notice-error">{params.error}</p>
          ) : null}

          {params.message ? <p className="notice">{params.message}</p> : null}

          <form action={loginAction} className="stack auth-form">
            <label className="field auth-field">
              <span>{t.login.email}</span>
              <input
                className="input auth-input"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>

            <label className="field auth-field">
              <span>{t.login.password}</span>
              <input
                className="input auth-input"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>

            <button className="button auth-submit" type="submit">
              {t.login.submit}
            </button>

            <p className="muted auth-switch-copy">{t.login.managedAccess}</p>
          </form>
        </section>
      </section>
    </main>
  );
}
