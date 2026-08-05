'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createTrip, listMyTrips, type NewTripInput } from '@/lib/trips';
import { joinTripByCode } from '@/lib/join';
import { UpiIdCard } from '@/components/UpiIdCard';
import { isValidInviteCode, type TripDoc } from '@sync/shared';

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  // Load the trip list on mount. Guarded so a fast unmount can't setState on a
  // gone component, mirroring the trip-detail page's loader.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const mine = await listMyTrips();
        if (active) setTrips(mine);
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

  async function handleJoin(code: string) {
    setJoining(true);
    setError(null);
    try {
      const { tripId } = await joinTripByCode(code);
      router.push(`/trips/${tripId}`);
    } catch (e) {
      setError(errorMessage(e));
      setJoining(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      <section className="glass rounded-[2rem] px-6 py-7 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div>
            <div className="eyebrow">Your trips</div>
            <h1 className="display mt-4 text-[clamp(2.8rem,6vw,4.8rem)] leading-[0.95] text-[color:var(--ink)]">
              Build the next trip board.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--muted)]">
              Start a trip, save the places worth remembering, and let expenses, check-ins, and
              notes organize themselves around the map.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <NewTripForm onCreate={handleCreate} creating={creating} />
            <JoinTripForm onJoin={handleJoin} joining={joining} />
          </div>
        </div>
      </section>

      <UpiIdCard />

      {error && (
        <p className="rounded-[1.4rem] border border-[color:var(--danger)]/20 bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </p>
      )}

      <section className="glass rounded-[2rem] px-6 py-6 sm:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="data-label">Library</div>
            <h2 className="mt-2 text-xl font-semibold text-[color:var(--ink)]">
              {loading ? 'Loading trips' : `${trips.length} trip${trips.length === 1 ? '' : 's'} ready`}
            </h2>
          </div>
          <p className="max-w-md text-right text-sm leading-6 text-[color:var(--muted)]">
            Each trip opens its own map board with saved places, activities, check-ins, and live
            split expenses.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-[color:var(--muted)]">Loading trips…</p>
        ) : trips.length === 0 ? (
          <p className="rounded-[1.4rem] border border-dashed border-[color:var(--line-strong)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
            No trips yet. Create the first one above and the workspace opens from there.
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {trips.map((trip) => (
              <li key={trip.$id}>
                <Link
                  href={`/trips/${trip.$id}`}
                  className="group block rounded-[1.6rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-5 hover:-translate-y-0.5 hover:border-[color:var(--line-strong)] hover:bg-white"
                >
                  <div className="data-label">{formatDateRange(trip.startDate, trip.endDate)}</div>
                  <div className="mt-3 text-2xl font-semibold text-[color:var(--ink)]">{trip.name}</div>
                  <div className="mt-2 text-sm text-[color:var(--muted)]">
                    {trip.destination || 'Destination still flexible'}
                  </div>
                  <div className="mt-6 text-sm font-medium text-[color:var(--accent)]">Open board</div>
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
      className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-5"
    >
      <div className="data-label">Create a trip</div>
      <div className="mt-4 grid gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Trip name, like Goa 2026"
          className="w-full rounded-full border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)]"
        />
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Destination or anchor city"
          className="w-full rounded-full border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)]"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="rounded-full bg-[color:var(--ink)] px-4 py-3 text-sm font-semibold text-[color:var(--paper)] hover:-translate-y-0.5 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create trip'}
        </button>
      </div>
    </form>
  );
}

function JoinTripForm({
  onJoin,
  joining,
}: {
  onJoin: (code: string) => void;
  joining: boolean;
}) {
  const [code, setCode] = useState('');
  const ready = isValidInviteCode(code);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    onJoin(code.trim());
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-5"
    >
      <div className="data-label">Join a trip</div>
      <p className="mt-1 text-xs text-[color:var(--muted)]">
        Got an invite code or link? Enter the code to hop on.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Invite code"
          maxLength={12}
          className="min-w-0 flex-1 rounded-full border border-[color:var(--line)] bg-white/75 px-4 py-3 font-mono text-sm tracking-[0.25em] text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)]"
        />
        <button
          type="submit"
          disabled={joining || !ready}
          className="shrink-0 rounded-full bg-[color:var(--accent-2)] px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 disabled:opacity-50"
        >
          {joining ? 'Joining…' : 'Join'}
        </button>
      </div>
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
