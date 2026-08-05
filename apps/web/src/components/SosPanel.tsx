'use client';

/**
 * SOS / emergency control.
 *
 * The button does two things at once: it dials the trip's emergency number via a
 * `tel:` link (which works even with no data connection) and raises an
 * `sos_events` alert that every member sees in realtime. A short confirm guards
 * against accidental taps. Active alerts from anyone on the trip are listed with
 * a map link and a "mark safe" action any member can use.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildTelLink, sanitizeEmergencyNumber, type SosEventDoc } from '@sync/shared';
import { raiseSos, resolveSos } from '@/lib/sos';
import { listTripMembers, type TripMemberView } from '@/lib/members';

/** Pan-India emergency number, used when a trip hasn't set its own. */
const DEFAULT_EMERGENCY_NUMBER = '112';

export function SosPanel({
  tripId,
  teamId,
  currentUserId,
  emergencyNumber,
  events,
}: {
  tripId: string;
  teamId: string;
  currentUserId: string;
  emergencyNumber?: string | null;
  /** SOS events for the trip (owned + kept live by the page). */
  events: SosEventDoc[];
}) {
  const [members, setMembers] = useState<TripMemberView[]>([]);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listTripMembers(teamId)
      .then((m) => {
        if (active) setMembers(m);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [teamId]);

  const dialNumber = sanitizeEmergencyNumber(emergencyNumber || DEFAULT_EMERGENCY_NUMBER);

  const nameOf = useCallback(
    (userId: string) =>
      userId === currentUserId
        ? 'You'
        : members.find((m) => m.userId === userId)?.name ?? 'A member',
    [members, currentUserId],
  );

  const activeEvents = useMemo(() => events.filter((e) => e.status === 'active'), [events]);
  const resolvedEvents = useMemo(
    () => events.filter((e) => e.status === 'resolved').slice(0, 5),
    [events],
  );

  // Keep the latest message available to the async trigger without re-creating it.
  const messageRef = useRef(message);
  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const triggerSos = useCallback(async () => {
    setBusy(true);
    setError(null);
    // Grab a quick position if we can, but never block the alert on it.
    const location = await getQuickPosition().catch(() => null);
    try {
      await raiseSos({
        tripId,
        teamId,
        message: messageRef.current,
        location,
      });
      // Fire the dialer after the alert is written so the group is notified even
      // if the user stays on the call.
      window.location.href = buildTelLink(dialNumber);
      setConfirming(false);
      setMessage('');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, [tripId, teamId, dialNumber]);

  const handleResolve = useCallback(async (eventId: string) => {
    setResolvingId(eventId);
    setError(null);
    try {
      await resolveSos(eventId);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setResolvingId(null);
    }
  }, []);

  return (
    <section className="board-card px-6 py-6 sm:px-8">
      <div className="flex flex-col gap-1">
        <div className="data-label text-[color:var(--danger)]">Emergency</div>
        <h2 className="text-2xl font-bold text-[color:var(--ink)]">SOS</h2>
        <p className="text-sm text-[color:var(--muted)]">
          Calls{' '}
          <span className="font-semibold text-[color:var(--ink)]">{dialNumber}</span> and alerts
          everyone on the trip with your location. Use only in a real emergency.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-[color:var(--danger)]/25 bg-[color:var(--danger)]/5 p-4">
        <label htmlFor="sos-message" className="data-label">
          Optional note
        </label>
        <input
          id="sos-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={140}
          placeholder="What's happening? (sent with the alert)"
          className="mt-2 w-full rounded-full border border-[color:var(--line)] bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-[color:var(--danger)]"
        />

        {!confirming ? (
          <button
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
            className="mt-4 w-full rounded-full bg-[color:var(--danger)] px-6 py-4 text-lg font-bold uppercase tracking-wide text-white shadow-[0_14px_30px_rgba(200,40,40,0.28)] transition hover:-translate-y-0.5"
          >
            🚨 Send SOS
          </button>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-center text-sm font-semibold text-[color:var(--danger)]">
              This calls {dialNumber} and alerts the group. Continue?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="flex-1 rounded-full border border-[color:var(--line-strong)] px-4 py-3 text-sm font-semibold text-[color:var(--ink)] hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={triggerSos}
                disabled={busy}
                className="flex-[2] rounded-full bg-[color:var(--danger)] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:-translate-y-0.5 disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Yes, send SOS & call'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-center text-sm text-[color:var(--danger)]">{error}</p>}
      </div>

      <div className="mt-6">
        <div className="data-label">Active alerts</div>
        {activeEvents.length === 0 ? (
          <p className="mt-2 rounded-[1.4rem] border border-dashed border-[color:var(--line-strong)] px-4 py-6 text-center text-sm text-[color:var(--muted)]">
            No active alerts. Everyone&apos;s safe.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {activeEvents.map((e) => (
              <li
                key={e.$id}
                className="rounded-[1.4rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[color:var(--ink)]">
                      🚨 {nameOf(e.userId)} needs help
                    </div>
                    <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                      {new Date(e.createdAt).toLocaleString()}
                    </div>
                    {e.message && (
                      <p className="mt-2 text-sm text-[color:var(--ink)]">“{e.message}”</p>
                    )}
                    {e.lat != null && e.lng != null && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm font-medium text-[color:var(--accent)] underline"
                      >
                        View location on map
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleResolve(e.$id)}
                    disabled={resolvingId === e.$id}
                    className="shrink-0 rounded-full bg-[color:var(--accent)]/15 px-3.5 py-2 text-xs font-semibold text-[color:var(--accent)] hover:bg-[color:var(--accent)]/25 disabled:opacity-50"
                  >
                    {resolvingId === e.$id ? '…' : 'Mark safe'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {resolvedEvents.length > 0 && (
        <div className="mt-5">
          <div className="data-label">Recently resolved</div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {resolvedEvents.map((e) => (
              <li
                key={e.$id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--line)] bg-[#17171a] px-3 py-2 text-sm"
              >
                <span className="truncate text-[color:var(--muted)]">
                  {nameOf(e.userId)} — resolved
                  {e.resolvedBy ? ` by ${nameOf(e.resolvedBy)}` : ''}
                </span>
                <span className="shrink-0 text-xs text-[color:var(--muted)]">
                  {e.resolvedAt ? new Date(e.resolvedAt).toLocaleTimeString() : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Best-effort, fast position for attaching to an alert; resolves null on failure. */
function getQuickPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6_000, maximumAge: 30_000 },
    );
  });
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Could not send the alert. Please try again.';
}
