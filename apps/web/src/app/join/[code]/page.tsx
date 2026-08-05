'use client';

/**
 * Landing page for an invite link (`/join/<code>`).
 *
 * If the visitor isn't signed in, we bounce them to login and come straight
 * back here afterwards. Once signed in, we auto-join in the background and
 * forward them to the trip board. The join call is fired exactly once.
 */

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { joinTripByCode } from '@/lib/join';
import { normalizeInviteCode } from '@sync/shared';

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = normalizeInviteCode(rawCode);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (loading || !user || attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        const { tripId } = await joinTripByCode(code);
        router.replace(`/trips/${tripId}`);
      } catch (e) {
        setError(messageOf(e));
      }
    })();
  }, [loading, user, code, router]);

  const loginHref = `/login?redirect=${encodeURIComponent(`/join/${code}`)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[color:var(--line)] bg-[#101012] px-6 py-10 text-center sm:px-8">
        <div className="eyebrow">Trip invite</div>
        <h1 className="display mt-4 flex items-center justify-center text-4xl text-[color:var(--ink)]">
          Join the trip
          <span className="live-dot ml-2 h-2 w-2" aria-hidden="true" />
        </h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Invite code{' '}
          <span className="font-mono text-lg font-semibold tracking-[0.2em] text-[color:var(--ink)]">
            {code || '—'}
          </span>
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-[color:var(--muted)]">Checking your session…</p>
        ) : !user ? (
          <div className="mt-8">
            <p className="text-sm text-[color:var(--muted)]">Sign in to join this trip.</p>
            <Link
              href={loginHref}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[color:var(--ink)] px-5 py-3.5 text-sm font-medium text-black hover:shadow-[0_0_28px_rgba(52,211,153,0.3)]"
            >
              Sign in to continue
            </Link>
          </div>
        ) : error ? (
          <div className="mt-8">
            <p className="rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
              {error}
            </p>
            <Link href="/trips" className="mt-4 inline-block text-sm font-medium text-[color:var(--accent)]">
              Go to my trips
            </Link>
          </div>
        ) : (
          <p className="mt-8 text-sm text-[color:var(--muted)]">Joining the trip…</p>
        )}
      </div>
    </main>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Could not join that trip.';
}
