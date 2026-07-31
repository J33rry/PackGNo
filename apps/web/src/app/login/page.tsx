'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { loginWithGoogle } from '@/lib/auth';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const oauthError = params.get('error') === 'oauth';

  // Already signed in → go straight to trips.
  useEffect(() => {
    if (!loading && user) router.replace('/trips');
  }, [loading, user, router]);

  return (
    <main className="shell flex min-h-screen items-center px-4 py-6 sm:px-6">
      <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="glass overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10">
          <div className="eyebrow">PackNGo sign in</div>
          <h1 className="display mt-4 max-w-3xl text-[clamp(3rem,8vw,5.75rem)] leading-[0.94] text-[color:var(--ink)]">
            Trips look calmer when the group has one board.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[color:var(--muted)]">
            Use your Google account to open the shared workspace for maps, expenses, check-ins,
            and trip notes.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <Value title="Places" value="Live" body="Realtime points, check-ins, and map context." />
            <Value title="Expenses" value="Split" body="Shared balances with UPI settle-up." />
            <Value title="Activities" value="Journal" body="Capture what actually happened there." />
          </div>
        </section>

        <section className="glass flex flex-col justify-center rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="data-label">Continue</div>
          <h2 className="mt-3 text-2xl font-semibold text-[color:var(--ink)]">Open your trip workspace</h2>
          <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
            One login, then your trips, saved places, and balances stay synced with the group.
          </p>

          {oauthError && (
            <p className="mt-6 rounded-[1.2rem] border border-[color:var(--danger)]/20 bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--danger)]">
              Sign-in was cancelled or failed. Please try again.
            </p>
          )}

          <button
            onClick={loginWithGoogle}
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-[color:var(--ink)] px-5 py-4 text-sm font-semibold text-[color:var(--paper)] hover:-translate-y-0.5 disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="mt-4 text-xs leading-6 text-[color:var(--muted)]">
            Google sign-in is handled by Appwrite OAuth. Your account opens the same trip workspace
            on web now, with mobile functionality left aligned for a later pass.
          </p>
        </section>
      </div>
    </main>
  );
}

function Value({ title, value, body }: { title: string; value: string; body: string }) {
  return (
    <div className="rounded-[1.4rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
      <div className="data-label">{title}</div>
      <div className="display mt-3 text-3xl text-[color:var(--ink)]">{value}</div>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{body}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
