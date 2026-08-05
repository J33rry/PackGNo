/**
 * Google Maps + Places helpers for the web app.
 *
 * Cost controls:
 * - Autocomplete is debounced in the UI and only starts at 3+ chars.
 * - Autocomplete uses a session token so a selection can terminate a session.
 * - Place Details requests use a tight field mask.
 * - Reverse geocodes are cached at coarse coordinate precision.
 *
 * The user should still set Cloud Console quotas / alerts for hard spend caps.
 */

import { poiCategoryFromTags, type PoiCategory } from '@sync/shared';
import { hasGoogleMapsKey, importGoogleMapsLibrary, loadGoogleMaps } from './google-maps';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';

export interface Place {
  name: string;
  category: PoiCategory;
  rawType: string | null;
  address: string | null;
  lat: number;
  lng: number;
  placeId?: string | null;
}

export interface PlacePrediction {
  placeId: string;
  primaryText: string;
  secondaryText: string | null;
}

export interface ViewBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface GoogleAutocompleteSuggestion {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

interface GooglePlaceResponse {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  types?: string[];
}

function requireApiKey() {
  if (!hasGoogleMapsKey()) {
    throw new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to apps/web/.env.local.');
  }
}

function apiHeaders(fieldMask: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
    'X-Goog-FieldMask': fieldMask,
  };
}

function normalizePlace(place: GooglePlaceResponse): Place {
  const lat = Number(place.location?.latitude);
  const lng = Number(place.location?.longitude);
  const rawType = place.primaryType || place.types?.[0] || null;
  return {
    placeId: place.id ?? null,
    name: place.displayName?.text?.trim() || place.formattedAddress?.split(',')[0]?.trim() || 'Unnamed place',
    category: poiCategoryFromTags(rawType),
    rawType,
    address: place.formattedAddress?.trim() || null,
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
  };
}

export function createPlacesSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `packngo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function searchPlaces(
  query: string,
  opts: { viewbox?: ViewBox; signal?: AbortSignal; limit?: number; sessionToken: string },
): Promise<PlacePrediction[]> {
  requireApiKey();
  const q = query.trim();
  if (!q) return [];

  const body: Record<string, unknown> = {
    input: q,
    sessionToken: opts.sessionToken,
    includedRegionCodes: ['in'],
  };


  if (opts.viewbox) {
    body.locationBias = {
      rectangle: {
        low: { latitude: opts.viewbox.south, longitude: opts.viewbox.west },
        high: { latitude: opts.viewbox.north, longitude: opts.viewbox.east },
      },
    };
  }

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: apiHeaders('suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'),
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    throw new Error(`Place search failed (${res.status})`);
  }

  const data = (await res.json()) as { suggestions?: GoogleAutocompleteSuggestion[] };
  return (data.suggestions ?? [])
    .map((item) => {
      const prediction = item.placePrediction;
      const placeId = prediction?.placeId?.trim();
      if (!placeId) return null;
      return {
        placeId,
        primaryText:
          prediction?.structuredFormat?.mainText?.text?.trim() ||
          prediction?.text?.text?.trim() ||
          'Unknown place',
        secondaryText: prediction?.structuredFormat?.secondaryText?.text?.trim() || null,
      };
    })
    .filter((item): item is PlacePrediction => item !== null);
}

export async function resolvePlacePrediction(
  prediction: PlacePrediction,
  sessionToken: string,
): Promise<Place> {
  requireApiKey();
  const url = `${PLACE_DETAILS_URL}/${encodeURIComponent(prediction.placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url, {
    headers: apiHeaders('id,displayName,formattedAddress,location,primaryType,types'),
  });
  if (!res.ok) {
    throw new Error(`Place details failed (${res.status})`);
  }

  return normalizePlace((await res.json()) as GooglePlaceResponse);
}

export async function getPlaceById(placeId: string): Promise<Place | null> {
  requireApiKey();
  const res = await fetch(`${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`, {
    headers: apiHeaders('id,displayName,formattedAddress,location,primaryType,types'),
  });
  if (!res.ok) return null;
  return normalizePlace((await res.json()) as GooglePlaceResponse);
}

const reverseCache = new Map<string, Place | null>();
const cacheKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<Place | null> {
  const key = cacheKey(lat, lng);
  if (reverseCache.has(key)) return reverseCache.get(key)!;

  const runtime = await loadGoogleMaps();
  await importGoogleMapsLibrary('geocoding');
  const geocoder = new runtime.maps.Geocoder();

  // Google's GeocoderResult/GeocoderStatus are untyped here (no @types/google.maps).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await new Promise<any | null>((resolve, reject) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }
    const abort = () => resolve(null);
    signal?.addEventListener('abort', abort, { once: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      signal?.removeEventListener('abort', abort);
      if (status === 'OK') {
        resolve(results?.[0] ?? null);
        return;
      }
      if (status === 'ZERO_RESULTS') {
        resolve(null);
        return;
      }
      reject(new Error(`Reverse geocode failed (${status})`));
    });
  });

  const place: Place | null = result
    ? {
        placeId: result.place_id || null,
        name:
          result.address_components?.[0]?.long_name?.trim() ||
          result.formatted_address?.split(',')[0]?.trim() ||
          'Dropped pin',
        category: poiCategoryFromTags(result.types?.[0] ?? null),
        rawType: result.types?.[0] ?? null,
        address: result.formatted_address?.trim() || null,
        lat,
        lng,
      }
    : null;

  reverseCache.set(key, place);
  return place;
}
