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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome to PackNGo</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Sign in to plan and run trips with your group.
        </p>
      </div>

      {oauthError && (
        <p className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          Sign-in was cancelled or failed. Please try again.
        </p>
      )}

      <button
        onClick={loginWithGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-black/10 bg-white px-5 py-3 text-sm font-medium text-black shadow-sm transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="text-center text-xs text-foreground/50">
        By continuing you agree to travel responsibly with your friends.
      </p>
    </main>
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
