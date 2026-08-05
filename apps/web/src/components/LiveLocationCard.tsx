'use client';

/**
 * Live-location control for the map board.
 *
 * Sharing is opt-in and foreground-only: nothing is written until the member
 * flips the toggle, at which point a geolocation watch upserts their position
 * (throttled) into the trip's `locations` collection. Turning it off — or
 * leaving the map — clears the watch and deletes their position.
 *
 * The component keeps the raw pings (seeded once, then updated live), filters
 * them to those seen recently, and lifts the fresh set up to the page so
 * `TripMap` can render everyone's markers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LocationPingDoc } from '@sync/shared';
import type { LiveLocation } from './TripMap';
import {
  deleteMyLocation,
  listLocations,
  subscribeToLocations,
  upsertMyLocation,
} from '@/lib/locations';
import { listTripMembers, type TripMemberView } from '@/lib/members';

/** A position older than this is treated as offline and hidden. */
const FRESH_MS = 2 * 60 * 1000;
/** Minimum gap between writes while the watch is streaming fixes. */
const WRITE_INTERVAL_MS = 8000;

export function LiveLocationCard({
  tripId,
  teamId,
  currentUserId,
  onLocationsChange,
}: {
  tripId: string;
  teamId: string;
  currentUserId: string;
  /** Lifts the current fresh positions up so the map can render them. */
  onLocationsChange: (locations: LiveLocation[]) => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [pings, setPings] = useState<LocationPingDoc[]>([]);
  const [members, setMembers] = useState<TripMemberView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const pingsRef = useRef<LocationPingDoc[]>([]);
  useEffect(() => {
    pingsRef.current = pings;
  }, [pings]);

  const lastWriteRef = useRef(0);
  const onChangeRef = useRef(onLocationsChange);
  useEffect(() => {
    onChangeRef.current = onLocationsChange;
  });

  // Seed positions + member names, then stream position changes live.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [locs, mem] = await Promise.all([listLocations(tripId), listTripMembers(teamId)]);
        if (!active) return;
        setPings(locs);
        setMembers(mem);
      } catch (e) {
        if (active) setError(messageOf(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [tripId, teamId]);

  useEffect(() => {
    const unsub = subscribeToLocations(tripId, () => pingsRef.current, setPings);
    return () => unsub();
  }, [tripId]);

  // Re-evaluate freshness on a timer so stale members drop off without an event.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const nameOf = useCallback(
    (userId: string) => members.find((m) => m.userId === userId)?.name ?? 'Member',
    [members],
  );

  const live = useMemo<LiveLocation[]>(
    () =>
      pings
        .filter((p) => now - new Date(p.timestamp).getTime() < FRESH_MS)
        .map((p) => ({
          userId: p.userId,
          name: nameOf(p.userId),
          lat: p.lat,
          lng: p.lng,
          timestamp: p.timestamp,
          isSelf: p.userId === currentUserId,
        }))
        .sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.name.localeCompare(b.name)),
    [pings, now, nameOf, currentUserId],
  );

  // Push the fresh set to the map, but only when it actually changes.
  const liveSig = live.map((l) => `${l.userId}:${l.lat}:${l.lng}:${l.timestamp}`).join('|');
  const lastSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSigRef.current === liveSig) return;
    lastSigRef.current = liveSig;
    onChangeRef.current(live);
  }, [liveSig, live]);

  // Clear the map layer when this control unmounts (e.g. leaving the map tab).
  useEffect(() => () => onChangeRef.current([]), []);

  // Flip sharing on/off. Availability is checked here (not in the effect) so the
  // effect never calls setState synchronously.
  const toggleSharing = useCallback(() => {
    setError(null);
    setSharing((on) => {
      if (on) return false;
      if (!('geolocation' in navigator)) {
        setError('Location sharing is not available in this browser.');
        return false;
      }
      return true;
    });
  }, []);

  // The geolocation watch, active only while sharing is on.
  useEffect(() => {
    if (!sharing || !('geolocation' in navigator)) return;

    let cancelled = false;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const ts = Date.now();
        if (ts - lastWriteRef.current < WRITE_INTERVAL_MS) return;
        lastWriteRef.current = ts;
        void upsertMyLocation({
          tripId,
          teamId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
        }).catch((e) => {
          if (!cancelled) setError(messageOf(e));
        });
      },
      (err) => {
        if (cancelled) return;
        setError(err.message || 'Could not get your location.');
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      lastWriteRef.current = 0;
      // Stop broadcasting: remove our position so others see us go offline.
      void deleteMyLocation(tripId).catch(() => {});
    };
  }, [sharing, tripId, teamId]);

  const sharedCount = live.filter((l) => !l.isSelf).length;

  return (
    <section className="glass rounded-[2rem] px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="data-label">Live location</div>
          <h2 className="mt-1 text-lg font-semibold text-[color:var(--ink)]">
            {live.length === 0 ? 'No one sharing' : `${live.length} live`}
          </h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {sharing
              ? 'Your position is visible to the group while this tab is open.'
              : 'Opt in to show your live position on the map.'}
          </p>
        </div>
        <button
          onClick={toggleSharing}
          aria-pressed={sharing}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
            sharing
              ? 'bg-[color:var(--danger)] text-white hover:-translate-y-0.5'
              : 'bg-[color:var(--accent-2)] text-white hover:-translate-y-0.5'
          }`}
        >
          {sharing ? 'Stop sharing' : 'Share my location'}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-[1.2rem] border border-[color:var(--danger)]/20 bg-[color:var(--paper)] px-3 py-2 text-xs text-[color:var(--danger)]">
          {error}
        </p>
      )}

      {live.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {live.map((l) => (
            <li
              key={l.userId}
              className="flex items-center justify-between gap-2 rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 truncate">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent-2)]" />
                <span className="truncate text-[color:var(--ink)]">
                  {l.name}
                  {l.isSelf ? ' (you)' : ''}
                </span>
              </span>
              <span className="shrink-0 text-xs text-[color:var(--muted)]">{agoLabel(l.timestamp, now)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-[1.4rem] border border-dashed border-[color:var(--line-strong)] px-4 py-6 text-center text-sm text-[color:var(--muted)]">
          {sharing ? 'Waiting for your first location fix…' : 'No one is sharing their location yet.'}
        </p>
      )}

      {sharedCount > 0 && (
        <p className="mt-3 text-xs text-[color:var(--muted)]">
          Tap a person pin on the map to see who it is.
        </p>
      )}
    </section>
  );
}

/** Short "how long ago" label for a timestamp. */
function agoLabel(iso: string, nowMs: number): string {
  const secs = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (secs < 10) return 'now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return `${mins}m ago`;
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}
