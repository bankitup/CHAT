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
        <p className="public-home-name">Chat</p>
        <h1 className="title public-home-title">{user ? 'Open chats.' : 'Start chatting.'}</h1>
        <p className="subtitle public-home-subtitle">
          {user
            ? 'Your conversations and settings are ready.'
            : 'Log in or create an account to start a direct message or group.'}
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

      <section className="stack public-home-note" aria-label={user ? 'Welcome back' : 'Get started'}>
        <p className="muted public-home-note-copy">
          {user ? 'Welcome back.' : 'Create an account or log in to continue.'}
        </p>
      </section>

      <p className="public-home-watermark">Chat by Build With Care</p>
    </main>
  );
}
