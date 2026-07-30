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
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
        <span className="font-semibold">PackNGo</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-foreground/60">{user.name || user.email}</span>
          <button
            onClick={() => signOut().then(() => router.replace('/login'))}
            className="rounded-md border border-black/10 px-3 py-1.5 transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            Sign out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-foreground/60">
      {children}
    </div>
  );
}
