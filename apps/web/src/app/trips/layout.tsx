'use client';

/** Gates the /trips area: redirects to /login when there's no session. */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { ChevronDown } from '@/components/marketing/icons';

export default function TripsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) return <CenteredMessage>Loading…</CenteredMessage>;
  if (!user) return <CenteredMessage>Redirecting to sign in…</CenteredMessage>;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-black/85 backdrop-blur-md">
        <div className="shell flex items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/trips" className="flex items-center gap-2 text-lg font-bold tracking-tight text-[color:var(--ink)]">
            PackNGo
            <span className="live-dot h-1.5 w-1.5" aria-hidden="true" />
          </Link>
          <UserMenu
            name={user.name || user.email || 'You'}
            onSignOut={() => signOut().then(() => router.replace('/login'))}
          />
        </div>
      </header>
      <div className="shell px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}

function UserMenu({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-[color:var(--line)] py-1 pl-1 pr-2.5 text-sm text-[color:var(--ink)]/85 hover:border-[color:var(--line-strong)]"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--accent)]/15 text-xs font-semibold text-[color:var(--accent)]">
          {initials(name)}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:block">{name}</span>
        <ChevronDown size={14} className="text-[color:var(--faint)]" />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[#141416] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
          style={{ animation: 'pngo-pull-up 0.18s ease both' }}
        >
          <div className="truncate px-3 py-2 text-xs text-[color:var(--faint)]">{name}</div>
          <button
            onClick={onSignOut}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-[color:var(--ink)] hover:bg-white/5"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function initials(value: string): string {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-sm text-[color:var(--muted)]">
      {children}
    </div>
  );
}
