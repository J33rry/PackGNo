'use client';

/**
 * Members roster + invite panel for a trip.
 *
 * Membership is the trip's Appwrite Team, so this lists everyone on it and
 * surfaces the invite code two ways: a copyable `/join/<code>` link and the
 * raw code for reading aloud. The owner's page auto-generates a code if the
 * trip predates invite codes; other members just see and share it.
 */

import { useCallback, useEffect, useState } from 'react';
import type { TripDoc } from '@sync/shared';
import { ensureInviteCode } from '@/lib/trips';
import { listTripMembers, type TripMemberView } from '@/lib/members';

export function InviteMembersCard({
  trip,
  currentUserId,
}: {
  trip: TripDoc;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<TripMemberView[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [code, setCode] = useState<string | null>(trip.inviteCode ?? null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentUserId === trip.ownerId;

  useEffect(() => {
    let active = true;
    listTripMembers(trip.teamId)
      .then((m) => {
        if (active) setMembers(m);
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      })
      .finally(() => {
        if (active) setLoadingMembers(false);
      });
    return () => {
      active = false;
    };
  }, [trip.teamId]);

  // Owner opening a trip that has no code yet → generate one so it's shareable.
  useEffect(() => {
    if (code || !isOwner) return;
    let active = true;
    ensureInviteCode(trip)
      .then((c) => {
        if (active) setCode(c);
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      });
    return () => {
      active = false;
    };
  }, [code, isOwner, trip]);

  const inviteUrl =
    code && typeof window !== 'undefined' ? `${window.location.origin}/join/${code}` : '';

  const copy = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy — select and copy the link manually.');
    }
  }, [inviteUrl]);

  return (
    <section className="glass rounded-[2rem] px-6 py-6 sm:px-8">
      <div className="data-label">Members &amp; invites</div>
      <h2 className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">Bring people in</h2>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Anyone who opens the link or enters the code — once signed in — joins this trip.
      </p>

      <div className="mt-5 rounded-[1.6rem] border border-[color:var(--line)] bg-[color:var(--paper)] p-4">
        {code ? (
          <>
            <div className="data-label">Share link</div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-full border border-[color:var(--line)] bg-white/75 px-4 py-2.5 text-sm text-[color:var(--ink)] outline-none"
              />
              <button
                onClick={copy}
                className="shrink-0 rounded-full bg-[color:var(--ink)] px-5 py-2.5 text-sm font-semibold text-[color:var(--paper)] hover:-translate-y-0.5"
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="data-label">Or use code</span>
              <span className="rounded-full border border-[color:var(--line)] bg-white/75 px-4 py-1.5 font-mono text-lg font-semibold tracking-[0.3em] text-[color:var(--ink)]">
                {code}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            {isOwner
              ? 'Generating an invite link…'
              : 'The trip owner hasn’t created an invite link yet.'}
          </p>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-[color:var(--danger)]">{error}</p>}

      <div className="mt-6">
        <div className="data-label">
          On this trip{!loadingMembers ? ` · ${members.length}` : ''}
        </div>
        {loadingMembers ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">Just you so far.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-2 rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--accent-2)] text-xs font-semibold text-white">
                    {initialsOf(m.name)}
                  </span>
                  <span className="truncate text-[color:var(--ink)]">
                    {m.name}
                    {m.userId === currentUserId ? ' (you)' : ''}
                  </span>
                </span>
                {m.userId === trip.ownerId && (
                  <span className="shrink-0 rounded-full bg-[color:var(--ink)] px-2.5 py-1 text-xs font-semibold text-[color:var(--paper)]">
                    Owner
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong.';
}
