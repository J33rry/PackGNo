'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TripMap } from '@/components/TripMap';
import { getTrip } from '@/lib/trips';
import { createPoi, deletePoi, listPois, setPoiVisitStatus, subscribeToPois } from '@/lib/pois';
import type { PoiCategory, PoiDoc, TripDoc } from '@sync/shared';

const CATEGORIES: PoiCategory[] = ['sight', 'food', 'lodging', 'activity', 'transport', 'other'];

export default function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);

  const [trip, setTrip] = useState<TripDoc | null>(null);
  const [pois, setPois] = useState<PoiDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);

  // Realtime needs the current list without re-subscribing on every change.
  const poisRef = useRef<PoiDoc[]>([]);
  poisRef.current = pois;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [t, p] = await Promise.all([getTrip(tripId), listPois(tripId)]);
        if (!active) return;
        setTrip(t);
        setPois(p);
      } catch (e) {
        if (active) setError(messageOf(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tripId]);

  // Live POI updates from other members.
  useEffect(() => {
    const unsubscribe = subscribeToPois(tripId, () => poisRef.current, setPois);
    return () => unsubscribe();
  }, [tripId]);

  const handleAdd = useCallback(
    async (name: string, category: PoiCategory) => {
      if (!trip || !pending) return;
      setError(null);
      try {
        // Realtime will also deliver this; applyRealtimeChange dedupes by $id.
        const created = await createPoi({
          tripId,
          teamId: trip.teamId,
          name,
          category,
          lat: pending.lat,
          lng: pending.lng,
        });
        setPois((prev) => (prev.some((p) => p.$id === created.$id) ? prev : [created, ...prev]));
        setPending(null);
      } catch (e) {
        setError(messageOf(e));
      }
    },
    [trip, pending, tripId],
  );

  async function toggleVisited(poi: PoiDoc) {
    setError(null);
    try {
      await setPoiVisitStatus(poi.$id, poi.visitStatus === 'visited' ? 'planned' : 'visited');
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function remove(poi: PoiDoc) {
    setError(null);
    try {
      await deletePoi(poi.$id);
      setPois((prev) => prev.filter((p) => p.$id !== poi.$id));
    } catch (e) {
      setError(messageOf(e));
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-foreground/60">Loading trip…</p>;
  }
  if (!trip) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 dark:text-red-400">{error ?? 'Trip not found.'}</p>
        <Link href="/trips" className="mt-3 inline-block text-sm underline">
          Back to trips
        </Link>
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">{trip.name}</h1>
          {trip.destination && (
            <p className="text-sm text-foreground/60">{trip.destination}</p>
          )}
        </div>
        <Link href="/trips" className="text-sm text-foreground/60 underline">
          All trips
        </Link>
      </div>

      {error && (
        <p className="mx-6 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="grid flex-1 gap-4 px-6 pb-6 lg:grid-cols-[2fr_1fr]">
        <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
          <TripMap
            pois={pois}
            onMapClick={setPending}
            className="absolute inset-0 h-full w-full"
          />
          {!pending && (
            <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
              Click the map to add a place
            </p>
          )}
          {pending && (
            <NewPoiForm
              coords={pending}
              onCancel={() => setPending(null)}
              onSubmit={handleAdd}
            />
          )}
        </div>

        <aside className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground/70">
            Places ({pois.length})
          </h2>
          {pois.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-foreground/60 dark:border-white/15">
              No places yet. Click the map to add your first.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pois.map((poi) => (
                <li
                  key={poi.$id}
                  className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div
                        className={poi.visitStatus === 'visited' ? 'line-through opacity-60' : ''}
                      >
                        {poi.name}
                      </div>
                      <div className="text-xs capitalize text-foreground/50">{poi.category}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => toggleVisited(poi)}
                        title={poi.visitStatus === 'visited' ? 'Mark planned' : 'Mark visited'}
                        className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {poi.visitStatus === 'visited' ? '↩' : '✓'}
                      </button>
                      <button
                        onClick={() => remove(poi)}
                        title="Remove"
                        className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}

function NewPoiForm({
  coords,
  onCancel,
  onSubmit,
}: {
  coords: { lat: number; lng: number };
  onCancel: () => void;
  onSubmit: (name: string, category: PoiCategory) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PoiCategory>('sight');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim(), category);
      }}
      className="absolute bottom-3 left-1/2 w-[min(420px,90%)] -translate-x-1/2 rounded-xl border border-black/10 bg-background p-3 shadow-lg dark:border-white/15"
    >
      <p className="mb-2 text-xs text-foreground/50">
        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
      </p>
      <div className="flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Place name"
          className="flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PoiCategory)}
          className="rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm capitalize outline-none dark:border-white/15"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-foreground/60 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
        >
          Add place
        </button>
      </div>
    </form>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}
