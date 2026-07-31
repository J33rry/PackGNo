/**
 * Place lookup via OpenStreetMap Nominatim — free, no API key, CORS-enabled.
 *
 * Two operations back the "tap a place / search for a hotel" experience:
 *   - `searchPlaces`   — text query → candidate places (biased to the viewport).
 *   - `reverseGeocode` — a coordinate → the place/address sitting there.
 *
 * Nominatim's usage policy asks for at most ~1 request/second and no bulk use;
 * callers debounce typing and we cache reverse lookups, which keeps us well
 * inside that. Raw OSM `class`/`type` are folded onto our own PoiCategory via
 * the shared `poiCategoryFromTags` table.
 */

import { poiCategoryFromTags, type PoiCategory } from '@sync/shared';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** A place normalized from Nominatim into the shape the UI consumes. */
export interface Place {
  /** Human name of the POI, or the first line of the address if unnamed. */
  name: string;
  /** Our category, mapped from OSM class/type. */
  category: PoiCategory;
  /** Raw OSM type (e.g. `hotel`, `restaurant`), kept for display/debugging. */
  rawType: string | null;
  /** Full address string, if Nominatim resolved one. */
  address: string | null;
  lat: number;
  lng: number;
}

/** Map bounds used to bias search toward what the user is currently looking at. */
export interface ViewBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  category?: string; // OSM "class", e.g. tourism / amenity
  type?: string; // e.g. hotel / restaurant / museum
}

function normalize(raw: NominatimPlace): Place | null {
  const lat = Number(raw.lat);
  const lng = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const address = raw.display_name?.trim() || null;
  // jsonv2 gives `name` for named POIs; fall back to the first address segment.
  const name = raw.name?.trim() || address?.split(',')[0]?.trim() || 'Unnamed place';

  return {
    name,
    category: poiCategoryFromTags(raw.type, raw.category),
    rawType: raw.type ?? null,
    address,
    lat,
    lng,
  };
}

/**
 * Search places by free text. When `viewbox` is given, results are biased to
 * (but not strictly bounded by) the current map view so nearby hits rank first.
 */
export async function searchPlaces(
  query: string,
  opts: { viewbox?: ViewBox; signal?: AbortSignal; limit?: number } = {},
): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(opts.limit ?? 8),
  });
  if (opts.viewbox) {
    const { west, south, east, north } = opts.viewbox;
    params.set('viewbox', `${west},${north},${east},${south}`);
  }

  const res = await fetch(`${NOMINATIM}/search?${params}`, {
    headers: { Accept: 'application/json' },
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = (await res.json()) as NominatimPlace[];
  return data.map(normalize).filter((p): p is Place => p !== null);
}

// Reverse-geocoding the same spot twice is common (tap then "log visit"), so a
// tiny cache keyed by ~11 m-precision coords avoids duplicate network calls.
const reverseCache = new Map<string, Place | null>();
const cacheKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

/** Resolve the place/address at a coordinate. Returns null if nothing is found. */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<Place | null> {
  const key = cacheKey(lat, lng);
  if (reverseCache.has(key)) return reverseCache.get(key)!;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
  });

  const res = await fetch(`${NOMINATIM}/reverse?${params}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);

  const raw = (await res.json()) as NominatimPlace & { error?: string };
  const place = raw?.error ? null : normalize(raw);
  reverseCache.set(key, place);
  return place;
}
