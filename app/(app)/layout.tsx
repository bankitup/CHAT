import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logoutAction } from './actions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="page page-mobile stack">
      <header className="app-header stack">
        <div className="stack" style={{ gap: '4px' }}>
          <p className="eyebrow">Authenticated area</p>
          <p className="muted">
            Signed in as <span className="mono">{user.email ?? user.id}</span>
          </p>
        </div>

        <nav className="nav-links" aria-label="App navigation">
          <Link className="pill" href="/inbox">
            Inbox
          </Link>
          <Link className="pill" href="/settings">
            Settings
          </Link>
          <form action={logoutAction}>
            <button className="button button-secondary" type="submit">
              Log out
            </button>
          </form>
        </nav>
      </header>

      {children}
    </main>
  );
}
