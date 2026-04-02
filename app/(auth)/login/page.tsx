import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginAction } from '../actions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
    redirect('/inbox');
  }

  const params = await searchParams;

  return (
    <main className="page stack">
      <section className="nav">
        <Link className="pill" href="/">
          Back home
        </Link>
      </section>

      <section className="card stack">
        <p className="eyebrow">Authentication</p>
        <h1>Login</h1>
        <p className="muted">
          Sign in with your email and password to enter the protected app area.
        </p>

        {params.error ? (
          <p className="notice notice-error">{params.error}</p>
        ) : null}

        {params.message ? <p className="notice">{params.message}</p> : null}

        <form action={loginAction} className="stack">
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              className="input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          <div className="cluster">
            <button className="button" type="submit">
              Log in
            </button>
            <Link className="pill" href="/signup">
              Create account
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
