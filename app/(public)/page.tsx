import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="page stack">
      <section className="stack">
        <p className="eyebrow">CHAT</p>
        <h1 className="title">Web-first messenger foundation</h1>
        <p className="subtitle">
          CHAT is being built as a reusable messaging-core with a web shell on
          top, not as a one-off chat UI. Phase 1 is focused on auth, schema,
          RLS, and a clean application structure that can later support
          embedded and native clients.
        </p>
      </section>

      <section className="cluster">
        {user ? (
          <>
            <Link className="pill pill-accent" href="/inbox">
              Open inbox
            </Link>
            <Link className="pill" href="/settings">
              Open settings
            </Link>
          </>
        ) : (
          <>
            <Link className="pill pill-accent" href="/login">
              Go to login
            </Link>
            <Link className="pill" href="/signup">
              Go to signup
            </Link>
            <Link className="pill" href="/inbox">
              Protected inbox
            </Link>
          </>
        )}
      </section>

      <section className="card stack">
        <h2>Session status</h2>
        {user ? (
          <p className="muted">
            You are signed in as <span className="mono">{user.email ?? user.id}</span>.
          </p>
        ) : (
          <p className="muted">
            You are currently signed out. Use email/password auth to enter the
            protected app shell.
          </p>
        )}
      </section>

      <section className="card stack">
        <h2>Current foundation priorities</h2>
        <ul className="list">
          <li>Supabase-backed auth and server/browser client boundaries.</li>
          <li>Protected route groups for the authenticated app shell.</li>
          <li>Messaging module scaffolding with reusable long-term boundaries.</li>
          <li>Minimal placeholder surfaces for inbox, chat, and settings.</li>
        </ul>
      </section>

      <section className="card card-muted stack">
        <h2>Planned next, not implemented yet</h2>
        <p className="muted">
          Realtime, attachments, richer messaging flows, and deeper product
          behavior come after the base foundation is stable.
        </p>
      </section>
    </main>
  );
}
