'use client';

/** Gates the /trips area: redirects to /login when there's no session. */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function TripsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  if (!user) {
    return <CenteredMessage>Redirecting to sign in…</CenteredMessage>;
  }

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6">
      <div className="shell flex min-h-[calc(100vh-2rem)] flex-col">
        <header className="glass flex items-center justify-between rounded-[1.8rem] px-5 py-4 sm:px-6">
          <div>
            <div className="eyebrow">PackNGo</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">Trip operations for your group.</div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-[color:var(--muted)] sm:block">{user.name || user.email}</span>
            <span className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-1.5 text-[color:var(--ink)] sm:hidden">
              {initials(user.name || user.email || 'U')}
            </span>
            <button
              onClick={() => signOut().then(() => router.replace('/login'))}
              className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-[color:var(--ink)] hover:bg-white"
            >
              Sign out
            </button>
          </div>
        </header>
        <div className="mt-4 flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-[color:var(--muted)]">
      {children}
    </div>
  );
}
