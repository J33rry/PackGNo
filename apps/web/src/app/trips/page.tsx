'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listMyTrips } from '@/lib/trips';
import { UpiIdCard } from '@/components/UpiIdCard';
import { useAuth } from '@/components/AuthProvider';
import { CreateTripModal } from '@/components/trips/CreateTripModal';
import { JoinTripModal } from '@/components/trips/JoinTripModal';
import { Reveal } from '@/components/marketing/Reveal';
import { Calendar, MapPin, MapPinned, Plus } from '@/components/marketing/icons';
import type { TripDoc } from '@sync/shared';

export default function TripsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

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

  return (
    <main className="flex flex-1 flex-col">
      {/* header block */}
      <div className="flex flex-col gap-6 pb-8 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="fade-up">
          <h1 className="display text-3xl text-[color:var(--ink)] sm:text-4xl">Your trips</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Every trip you&apos;re part of, on one board.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={() => setShowCreate(true)} className={primaryBtn}>
            <Plus size={18} />
            Create a trip
          </button>
          <button onClick={() => setShowJoin(true)} className={ghostBtn}>
            Join a trip
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl border border-[color:var(--line)] bg-[#101012]" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} onJoin={() => setShowJoin(true)} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip, i) => (
            <Reveal as="li" key={trip.$id} delay={i * 0.05}>
              <Link
                href={`/trips/${trip.$id}`}
                className="group block h-full rounded-2xl border border-[color:var(--line)] bg-[#101012] p-5 transition-colors hover:border-[color:var(--accent)]/30"
              >
                <div className="relative mb-4 h-28 overflow-hidden rounded-xl bg-[#1b1b1e]">
                  <MiniMap seed={trip.$id} />
                  {trip.ownerId === user?.$id && (
                    <span className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-[color:var(--accent)] backdrop-blur">
                      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                      Owner
                    </span>
                  )}
                </div>
                <div className="truncate text-lg font-medium text-[color:var(--ink)]">{trip.name}</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-[color:var(--muted)]">
                  <MapPin size={14} className="shrink-0" />
                  <span className="truncate">{trip.destination || 'Destination flexible'}</span>
                </div>
                {formatDateRange(trip.startDate, trip.endDate) && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-[color:var(--faint)]">
                    <Calendar size={13} className="shrink-0" />
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </div>
                )}
              </Link>
            </Reveal>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <UpiIdCard />
      </div>

      <CreateTripModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(trip) => setTrips((prev) => [trip, ...prev])}
        onError={setError}
      />
      <JoinTripModal
        open={showJoin}
        onClose={() => setShowJoin(false)}
        onJoined={(tripId) => router.push(`/trips/${tripId}`)}
      />
    </main>
  );
}

function EmptyState({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[color:var(--line-strong)] py-20 text-center">
      <MapPinned size={44} className="text-[color:var(--faint)]" />
      <p className="mt-5 text-lg text-[color:var(--ink)]">No trips yet</p>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Create your first trip or join one with an invite code.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button onClick={onCreate} className={primaryBtn}>
          <Plus size={18} />
          Create a trip
        </button>
        <button onClick={onJoin} className={ghostBtn}>
          Join a trip
        </button>
      </div>
    </div>
  );
}

/** Deterministic mini map preview per trip (no real coords needed yet). */
function MiniMap({ seed }: { seed: string }) {
  const hue = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  const x = 30 + (hue % 40);
  const y = 25 + ((hue >> 2) % 30);
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      <rect width="200" height="120" fill="#141416" />
      <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="120" />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 40} x2="200" y2={i * 40} />
        ))}
      </g>
      <path
        d={`M10 ${90 - (hue % 20)} C 60 ${70 - (hue % 15)}, 120 ${40 + (hue % 20)}, 190 ${60 - (hue % 10)}`}
        fill="none"
        stroke="#34d399"
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      <circle cx={x * 2} cy={y * 2} r="14" fill="#34d399" opacity="0.14" />
      <circle cx={x * 2} cy={y * 2} r="4" fill="#34d399" />
    </svg>
  );
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '';
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt((start || end)!);
}

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}

const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--ink)] px-5 py-2.5 text-sm font-medium text-black hover:shadow-[0_0_28px_rgba(52,211,153,0.3)]';
const ghostBtn =
  'inline-flex items-center justify-center rounded-full border border-[color:var(--line-strong)] px-5 py-2.5 text-sm font-medium text-[color:var(--ink)] hover:border-[color:var(--ink)]/40';
