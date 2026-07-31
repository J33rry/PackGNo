'use client';

/**
 * Search box over OpenStreetMap Nominatim. Typing is debounced (~400 ms) and
 * biased to the current map viewport; picking a result hands the resolved
 * {@link Place} back to the parent, which flies the map there and opens the
 * info card. In-flight requests are aborted when the query changes.
 */

import { useEffect, useRef, useState } from 'react';
import { searchPlaces, type Place, type ViewBox } from '@/lib/places';

interface PlaceSearchProps {
  /** Reads the map's current bounds so results near the view rank first. */
  getViewBox?: () => ViewBox | undefined;
  onSelect: (place: Place) => void;
}

export function PlaceSearch({ getViewBox, onSelect }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avoid re-running the search effect just because the parent re-rendered.
  const vbRef = useRef(getViewBox);
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
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const found = await searchPlaces(q, { viewbox: vbRef.current?.(), signal: ctrl.signal });
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

  function choose(place: Place) {
    onSelect(place);
    setQuery(place.name);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search for a hotel, restaurant, sight…"
        className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
      />
      {loading && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground/50">
          …
        </span>
      )}

      {open && (results.length > 0 || error) && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-black/10 bg-background shadow-lg dark:border-white/15">
          {error && <li className="px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</li>}
          {results.map((place) => (
            <li key={`${place.lat},${place.lng}`}>
              <button
                onClick={() => choose(place)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="text-sm">{place.name}</span>
                {place.address && (
                  <span className="line-clamp-1 text-xs text-foreground/55">{place.address}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
