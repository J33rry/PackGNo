'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { loginWithGoogle } from '@/lib/auth';
import { NightMap } from '@/components/marketing/NightMap';
import { PullWords } from '@/components/marketing/PullWords';
import { GoogleG } from '@/components/marketing/icons';

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
  const rawRedirect = params.get('redirect');
  const redirectPath = rawRedirect && rawRedirect.startsWith('/') ? rawRedirect : '/trips';
  const joining = rawRedirect?.startsWith('/join/');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(redirectPath);
  }, [loading, user, router, redirectPath]);

  function handleSignIn() {
    setRedirecting(true);
    loginWithGoogle(redirectPath);
  }

  return (
    <main className="min-h-screen bg-black p-3 sm:p-5">
      <div className="relative flex h-[calc(100vh-1.5rem)] items-center justify-center overflow-hidden rounded-[1.75rem] sm:h-[calc(100vh-2.5rem)] sm:rounded-[2.25rem]">
        {/* quiet map texture */}
        <div className="absolute inset-0 opacity-40">
          <NightMap variant="hero" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
        <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.4] mix-blend-overlay" />

        <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-6 text-center">
          <div className="fade-up eyebrow" style={{ ['--d' as string]: '0s' }}>
            Group travel, in sync
          </div>

          <h1 className="display mt-5 flex items-start text-5xl text-[color:var(--ink)] sm:text-6xl">
            <PullWords text="PackNGo" baseDelay={0.1} />
            <span className="live-dot ml-1 mt-2 h-2 w-2 shrink-0" aria-hidden="true" />
          </h1>

          <p
            className="fade-up mt-4 text-sm text-[color:var(--muted)]"
            style={{ ['--d' as string]: '0.25s' }}
          >
            {joining ? 'Sign in to join the trip.' : 'Sign in to see your trips.'}
          </p>

          {oauthError && (
            <p className="mt-6 rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
              Sign-in didn&apos;t finish. Try again.
            </p>
          )}

          <button
            onClick={handleSignIn}
            disabled={loading || redirecting}
            className="fade-up mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-[color:var(--ink)] px-6 py-3.5 text-sm font-medium text-black hover:scale-[1.02] hover:shadow-[0_0_36px_rgba(52,211,153,0.3)] disabled:pointer-events-none disabled:opacity-70"
            style={{ ['--d' as string]: '0.4s' }}
          >
            {redirecting ? (
              <>
                <Spinner />
                Redirecting…
              </>
            ) : (
              <>
                <GoogleG size={18} />
                Continue with Google
              </>
            )}
          </button>

          <p
            className="fade-up mt-5 max-w-xs text-xs leading-relaxed text-[color:var(--faint)]"
            style={{ ['--d' as string]: '0.55s' }}
          >
            By continuing you agree to share your name and photo with your trip members.
          </p>
        </div>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
