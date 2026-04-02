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
    <main className="page stack">
      <section className="nav">
        <Link className="pill" href="/">
          Back home
        </Link>
      </section>

      <section className="card stack">
        <p className="eyebrow">Authentication</p>
        <h1>Signup</h1>
        <p className="muted">
          Create an account with email and password. This keeps the initial auth
          surface minimal while the repository stays focused on foundation work.
        </p>

        {params.error ? (
          <p className="notice notice-error">{params.error}</p>
        ) : null}

        <form action={signupAction} className="stack">
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
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          <div className="cluster">
            <button className="button" type="submit">
              Create account
            </button>
            <Link className="pill" href="/login">
              Already have an account
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
