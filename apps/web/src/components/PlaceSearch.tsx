'use client';

/**
 * Search box over Google Places Autocomplete (New). Typing is debounced and
 * biased to the current map viewport. Each search session is backed by a
 * session token so the eventual place selection can terminate that session.
 */

import { useEffect, useRef, useState } from 'react';
import {
  createPlacesSessionToken,
  resolvePlacePrediction,
  searchPlaces,
  type Place,
  type PlacePrediction,
  type ViewBox,
} from '@/lib/places';
import { Search } from '@/components/marketing/icons';

interface PlaceSearchProps {
  getViewBox?: () => ViewBox | undefined;
  onSelect: (place: Place) => void;
}

export function PlaceSearch({ getViewBox, onSelect }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vbRef = useRef(getViewBox);
  const sessionRef = useRef(createPlacesSessionToken());
  useEffect(() => {
    vbRef.current = getViewBox;
  });

  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();
    // All state changes happen inside the debounce timer (never synchronously in
    // the effect body) so a short query clears results a tick later too.
    const timer = setTimeout(async () => {
      if (q.length < 3) {
        setResults([]);
        setError(null);
        setOpen(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const found = await searchPlaces(q, {
          viewbox: vbRef.current?.(),
          signal: ctrl.signal,
          sessionToken: sessionRef.current,
          limit: 6,
        });

        setResults(found);
        setOpen(true);
      } catch {
        if (!ctrl.signal.aborted) setError('Search failed. Try again.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  async function choose(place: PlacePrediction) {
    setResolvingId(place.placeId);
    setError(null);
    try {
      const resolved = await resolvePlacePrediction(place, sessionRef.current);
      onSelect(resolved);
      setQuery(resolved.name);
      setOpen(false);
      sessionRef.current = createPlacesSessionToken();
    } catch {
      setError('Could not load that place. Try another result.');
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--faint)]" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search hotels, cafes, landmarks, stations"
        className="w-full rounded-full border border-[color:var(--line)] bg-[#1b1b1e] px-4 py-3 pl-10 text-sm text-[color:var(--ink)] outline-none transition placeholder:text-[color:var(--faint)] focus:border-[color:var(--accent)]/50"
      />
      {loading && (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[color:var(--muted)]">
          Searching
        </span>
      )}

      {open && (results.length > 0 || error) && (
        <ul className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-[color:var(--line-strong)] bg-[#141416] p-2 shadow-[0_22px_60px_rgba(0,0,0,0.55)]">
          {error && <li className="px-3 py-2 text-xs text-[color:var(--danger)]">{error}</li>}
          {results.map((place) => (
            <li key={place.placeId}>
              <button
                onClick={() => choose(place)}
                disabled={resolvingId === place.placeId}
                className="flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-3 text-left transition hover:bg-white/5 disabled:opacity-60"
              >
                <span className="text-sm font-medium text-[color:var(--ink)]">{place.primaryText}</span>
                {place.secondaryText && (
                  <span className="line-clamp-1 text-xs text-[color:var(--muted)]">
                    {place.secondaryText}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
