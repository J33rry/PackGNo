'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createTrip, listMyTrips, type NewTripInput } from '@/lib/trips';
import type { TripDoc } from '@sync/shared';

export default function TripsPage() {
  const [trips, setTrips] = useState<TripDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTrips(await listMyTrips());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(input: NewTripInput) {
    setCreating(true);
    setError(null);
    try {
      const trip = await createTrip(input);
      setTrips((prev) => [trip, ...prev]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Your trips</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Create a trip, then invite your group and start planning.
      </p>

      <NewTripForm onCreate={handleCreate} creating={creating} />

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <section className="mt-8">
        {loading ? (
          <p className="text-sm text-foreground/60">Loading trips…</p>
        ) : trips.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-sm text-foreground/60 dark:border-white/15">
            No trips yet. Create your first one above.
          </p>
        ) : (
          <ul className="grid gap-3">
            {trips.map((trip) => (
              <li key={trip.$id}>
                <Link
                  href={`/trips/${trip.$id}`}
                  className="block rounded-xl border border-black/10 p-4 transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <div className="font-medium">{trip.name}</div>
                  {trip.destination && (
                    <div className="text-sm text-foreground/60">{trip.destination}</div>
                  )}
                  <div className="mt-1 text-xs text-foreground/40">
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function NewTripForm({
  onCreate,
  creating,
}: {
  onCreate: (input: NewTripInput) => void;
  creating: boolean;
}) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), destination: destination.trim() || undefined });
    setName('');
    setDestination('');
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 flex flex-col gap-3 rounded-xl border border-black/10 p-4 sm:flex-row dark:border-white/10"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Trip name (e.g. Goa 2026)"
        className="flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
      />
      <input
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder="Destination (optional)"
        className="flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
      />
      <button
        type="submit"
        disabled={creating || !name.trim()}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {creating ? 'Creating…' : 'Create trip'}
      </button>
    </form>
  );
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Dates not set';
  const fmt = (d: string) => new Date(d).toLocaleDateString();
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt((start || end)!);
}

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}
