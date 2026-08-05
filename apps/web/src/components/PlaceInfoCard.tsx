'use client';

/**
 * Info card for a place the user tapped, searched, or clicked on the map —
 * the "Google-Maps-style" panel. Shows the resolved name / category / address
 * and lets the user add it to the trip's Places (name + category editable
 * first), plus optional "log a visit" / "create activity" actions when the
 * parent supplies those handlers.
 *
 * The parent should give this a `key` tied to the place's coordinates so its
 * internal edit state resets cleanly each time a different place is selected.
 */

import { useState } from 'react';
import type { PoiCategory } from '@sync/shared';
import type { Place } from '@/lib/places';

const CATEGORIES: PoiCategory[] = ['sight', 'food', 'lodging', 'activity', 'transport', 'other'];

interface PlaceInfoCardProps {
  place: Place;
  /** Reverse-geocode still enriching the address after a tap. */
  loadingDetails?: boolean;
  /** An action is in flight — disables buttons. */
  busy?: boolean;
  onAddToPlaces: (name: string, category: PoiCategory) => void;
  onLogVisit?: () => void;
  onCreateActivity?: () => void;
  onClose: () => void;
}

export function PlaceInfoCard({
  place,
  loadingDetails,
  busy,
  onAddToPlaces,
  onLogVisit,
  onCreateActivity,
  onClose,
}: PlaceInfoCardProps) {
  const [name, setName] = useState(place.name === 'Unnamed place' ? '' : place.name);
  const [category, setCategory] = useState<PoiCategory>(place.category);

  return (
    <div className="absolute bottom-4 left-1/2 w-[min(500px,92%)] -translate-x-1/2 rounded-2xl border border-[color:var(--line-strong)] bg-[#161618]/95 p-4 shadow-[0_24px_50px_rgba(0,0,0,0.6)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[color:var(--ink)]">{place.name}</p>
          <p className="mt-0.5 text-xs capitalize text-[color:var(--muted)]">
            {place.rawType?.replace(/_/g, ' ') ?? place.category}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full border border-[color:var(--line)] px-2.5 py-1 text-xs text-[color:var(--muted)] hover:bg-white/10"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <p className="mt-2 min-h-[1rem] text-xs text-[color:var(--muted)]">
        {loadingDetails ? 'Looking up address…' : (place.address ?? 'No address found.')}
      </p>

      <div className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name for this place"
          className="flex-1 rounded-full border border-[color:var(--line)] bg-white/5 px-4 py-3 text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PoiCategory)}
          className="rounded-full border border-[color:var(--line)] bg-white/5 px-3 py-3 text-sm capitalize text-[color:var(--ink)] outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {onCreateActivity && (
          <button
            type="button"
            onClick={onCreateActivity}
            disabled={busy}
            className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--ink)] hover:bg-white/10 disabled:opacity-50"
          >
            Create activity
          </button>
        )}
        {onLogVisit && (
          <button
            type="button"
            onClick={onLogVisit}
            disabled={busy}
            className="rounded-full bg-[color:var(--accent-2)] px-4 py-2 text-sm font-medium text-white hover:-translate-y-0.5 disabled:opacity-50"
          >
            Log visit here
          </button>
        )}
        <button
          type="button"
          onClick={() => onAddToPlaces(name.trim() || place.name, category)}
          disabled={busy}
          className="rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Add to Places
        </button>
      </div>
    </div>
  );
}
