import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signupAction } from '../actions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type SignupPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/inbox');
  }

  const params = await searchParams;

  return (
    <main className="page auth-page">
      <section className="stack auth-shell">
        <section className="auth-topbar">
          <Link className="pill auth-back-link" href="/">
            Back
          </Link>
        </section>

        <section className="stack auth-brand">
          <div className="auth-brand-mark" aria-hidden="true">
            C
          </div>
          <div className="stack auth-brand-copy">
            <p className="auth-brand-name">Chat</p>
            <p className="auth-brand-line">Chat by Build With Care</p>
          </div>
        </section>

        <section className="card stack auth-card">
          <div className="stack auth-card-copy">
            <h1 className="auth-title">Create account</h1>
            <p className="muted auth-subtitle">
              Start with email and password.
            </p>
          </div>

          {params.error ? (
            <p className="notice notice-error">{params.error}</p>
          ) : null}

          <form action={signupAction} className="stack auth-form">
            <label className="field auth-field">
              <span>Email</span>
              <input
                className="input auth-input"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>

            <label className="field auth-field">
              <span>Password</span>
              <input
                className="input auth-input"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>

            <button className="button auth-submit" type="submit">
              Create account
            </button>

            <p className="muted auth-switch-copy">
              Already have an account?{' '}
              <Link className="auth-switch-link" href="/login">
                Log in
              </Link>
            </p>
          </form>
        </section>
      </section>
    </main>
  );
}
