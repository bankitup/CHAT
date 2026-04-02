import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="page stack public-home">
      <section className="stack public-home-hero">
        <div className="public-home-brand">
          <div className="auth-brand-mark public-home-brand-mark" aria-hidden="true">
            C
          </div>
          <div className="stack public-home-brand-copy">
            <p className="public-home-name">Chat</p>
            <p className="public-home-line">Chat by Build With Care</p>
          </div>
        </div>
        <h1 className="title public-home-title">A calm place for everyday conversation.</h1>
        <p className="subtitle">
          Direct messages, groups, and a mobile-first messenger that stays out of the way.
        </p>
      </section>

      <section className="cluster public-home-actions">
        {user ? (
          <>
            <Link className="pill pill-accent" href="/inbox">
              Open chats
            </Link>
            <Link className="pill" href="/settings">
              Open settings
            </Link>
          </>
        ) : (
          <>
            <Link className="pill pill-accent" href="/login">
              Log in
            </Link>
            <Link className="pill" href="/signup">
              Create account
            </Link>
          </>
        )}
      </section>

      <section className="card card-muted stack public-home-note">
        <h2 className="card-title">{user ? 'Welcome back' : 'Get started'}</h2>
        <p className="muted">
          {user
            ? 'Your chats and settings are ready.'
            : 'Create an account or log in to start chatting.'}
        </p>
      </section>
    </main>
  );
}
