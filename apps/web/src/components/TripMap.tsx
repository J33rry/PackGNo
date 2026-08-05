'use client';

/**
 * Google Maps implementation for the web trip map.
 *
 * Uses AdvancedMarkerElement (replaces the deprecated google.maps.Marker).
 *
 * Cost control notes:
 * - Map loads are billed, so the app should keep this screen purposeful.
 * - Search requests are handled separately with debouncing + session tokens.
 * - Reverse geocode is only used after a deliberate tap/click action.
 */

// The Google Maps runtime (Map, AdvancedMarkerElement, InfoWindow) is loaded at
// runtime and untyped here — we don't depend on `@types/google.maps` — so the
// refs holding those instances are `any` by design.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DEFAULT_MAP_CAMERA, type PoiDoc, type VisitDoc } from '@sync/shared';
import { getPlaceById, type ViewBox } from '@/lib/places';
import { hasGoogleMapsKey, importGoogleMapsLibrary, loadGoogleMaps } from '@/lib/google-maps';

const CATEGORY_COLOR: Record<string, string> = {
  food: '#ff7b54',
  sight: '#0d8abc',
  lodging: '#5440ff',
  activity: '#1c9b6f',
  transport: '#4d6578',
  other: '#ff4f6a',
};

export interface TappedPlace {
  name: string;
  rawType: string | null;
  lat: number;
  lng: number;
  placeId?: string | null;
}

/** A member's live position rendered on the map. */
export interface LiveLocation {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  /** ISO timestamp of the fix — used for the tooltip. */
  timestamp: string;
  /** True for the current user's own marker (styled distinctly). */
  isSelf: boolean;
}

export interface TripMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  getViewBox: () => ViewBox | undefined;
}

interface TripMapProps {
  pois: PoiDoc[];
  /** Check-ins to render as a distinct marker layer. */
  visits?: VisitDoc[];
  /** Live member positions to render as a distinct marker layer. */
  locations?: LiveLocation[];
  /** Fired when the user clicks empty map space — used to add a POI there. */
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  /** Fired when the user taps a labeled place rendered in the tiles. */
  onPlaceTap?: (place: TappedPlace) => void;
  /** Fired when a POI marker is clicked. */
  onPoiClick?: (poi: PoiDoc) => void;
  className?: string;
}

/** Create a circle-shaped DOM element used as AdvancedMarkerElement content. */
function createCirclePin(opts: {
  fillColor: string;
  fillOpacity: number;
  radius: number;
  strokeColor: string;
  strokeWidth: number;
}): HTMLElement {
  const size = (opts.radius + opts.strokeWidth) * 2;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.style.display = 'block';

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', String(size / 2));
  circle.setAttribute('cy', String(size / 2));
  circle.setAttribute('r', String(opts.radius));
  circle.setAttribute('fill', opts.fillColor);
  circle.setAttribute('fill-opacity', String(opts.fillOpacity));
  circle.setAttribute('stroke', opts.strokeColor);
  circle.setAttribute('stroke-width', String(opts.strokeWidth));
  svg.appendChild(circle);

  const wrapper = document.createElement('div');
  wrapper.style.cursor = 'pointer';
  wrapper.appendChild(svg);
  return wrapper;
}

/** Stable-ish colour per user so a member keeps the same live-marker hue. */
function colorForUser(userId: string): string {
  const palette = ['#0d8abc', '#1c9b6f', '#c8862a', '#8b5cf6', '#e0567a', '#3b82f6', '#0f766e'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length]!;
}

/** Up-to-two-letter initials from a display name. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * A circular avatar-style pin (initials on a coloured disc) for a live member
 * position. `self` gets a heavier ring so you can spot your own dot at a glance.
 */
function createPersonPin(name: string, color: string, self: boolean): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:30px',
    'height:30px',
    'border-radius:9999px',
    `background:${color}`,
    'color:#fff',
    'font:700 11px/1 sans-serif',
    `border:${self ? '3px solid #17324d' : '2px solid #f7f3ea'}`,
    'box-shadow:0 2px 8px rgba(19,33,44,0.35)',
    'cursor:pointer',
  ].join(';');
  el.textContent = initialsOf(name);
  return el;
}

export const TripMap = forwardRef<TripMapHandle, TripMapProps>(function TripMap(
  { pois, visits = [], locations = [], onMapClick, onPlaceTap, onPoiClick, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any | null>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const visitMarkersRef = useRef<Map<string, any>>(new Map());
  const locationMarkersRef = useRef<Map<string, any>>(new Map());
  const hasFitRef = useRef(false);
  const infoWindowRef = useRef<any | null>(null);
  const markerClassRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);

  const clickRef = useRef(onMapClick);
  const placeTapRef = useRef(onPlaceTap);
  const poiClickRef = useRef(onPoiClick);
  useEffect(() => {
    clickRef.current = onMapClick;
    placeTapRef.current = onPlaceTap;
    poiClickRef.current = onPoiClick;
  });

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, zoom = 15) {
      mapRef.current?.panTo({ lat, lng });
      if (zoom) mapRef.current?.setZoom(zoom);
    },
    getViewBox() {
      const b = mapRef.current?.getBounds();
      if (!b) return undefined;
      const { south, west, north, east } = b.toJSON();
      return { west, south, east, north };
    },
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const markers = markersRef.current;
    const visitMarkers = visitMarkersRef.current;
    const locationMarkers = locationMarkersRef.current;
    let cancelled = false;

    let building = false;
    const build = async () => {
      if (mapRef.current || building) return;
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;

      building = true;
      try {
        const runtime = await loadGoogleMaps();
        const maps = runtime.maps;
        // Load both libraries in parallel.
        const [, markerLib] = await Promise.all([
          importGoogleMapsLibrary('maps'),
          importGoogleMapsLibrary('marker'),
        ]);
        if (cancelled) return;

        // Store the AdvancedMarkerElement class for use in marker effects.
        markerClassRef.current = (markerLib as any).AdvancedMarkerElement;

        const map = new maps.Map(container, {
          center: { lat: DEFAULT_MAP_CAMERA.latitude, lng: DEFAULT_MAP_CAMERA.longitude },
          zoom: DEFAULT_MAP_CAMERA.zoom,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
        });

        infoWindowRef.current = new maps.InfoWindow();

        map.addListener('click', async (event: any) => {
          const latLng = event.latLng;
          if (!latLng) return;

          if (event.placeId && placeTapRef.current) {
            event.stop();
            const place = await getPlaceById(event.placeId).catch(() => null);
            if (place) {
              placeTapRef.current(place);
              return;
            }
          }

          clickRef.current?.({ lat: latLng.lat(), lng: latLng.lng() });
        });
        mapRef.current = map;
        observer.disconnect(); // No longer needed once map is created.
        setMapError(null);
        setMapReady((n) => n + 1);
      } catch (error) {
        building = false;
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : 'Failed to load Google Maps.');
        }
      }
    };

    if (!hasGoogleMapsKey()) {
      setMapError('Google Maps is not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.');
      return;
    }

    void build();
    const observer = new ResizeObserver(build);
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      markers.forEach((m) => (m.map = null));
      markers.clear();
      visitMarkers.forEach((m) => (m.map = null));
      visitMarkers.clear();
      locationMarkers.forEach((m) => (m.map = null));
      locationMarkers.clear();
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      mapRef.current = null;
    };
  }, []);

  // ── POI markers ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const AME = markerClassRef.current;
    if (!map || !AME) return;

    const markers = markersRef.current;
    const seen = new Set<string>();

    for (const poi of pois) {
      seen.add(poi.$id);
      const existing = markers.get(poi.$id);
      if (existing) {
        existing.position = { lat: poi.lat, lng: poi.lng };
        const el = existing.content as HTMLElement | null;
        if (el instanceof HTMLElement) el.style.opacity = poi.visitStatus === 'visited' ? '0.48' : '1';
        continue;
      }

      const content = createCirclePin({
        fillColor: CATEGORY_COLOR[poi.category] ?? CATEGORY_COLOR.other,
        fillOpacity: poi.visitStatus === 'visited' ? 0.42 : 1,
        radius: 9,
        strokeColor: '#f7f3ea',
        strokeWidth: 3,
      });

      const marker = new AME({
        map,
        position: { lat: poi.lat, lng: poi.lng },
        title: poi.name,
        content,
      });
      marker.addEventListener('gmp-click', () => {
        infoWindowRef.current?.setContent(
          `<div style="font:600 13px sans-serif;color:#17324d;">${escapeHtml(poi.name)}</div>`,
        );
        infoWindowRef.current?.open({ anchor: marker, map });
        poiClickRef.current?.(poi);
      });
      markers.set(poi.$id, marker);
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.map = null;
        markers.delete(id);
      }
    }

    if (!hasFitRef.current && pois.length > 0) {
      hasFitRef.current = true;
      const maps = window.google?.maps;
      if (!maps) return;
      const bounds = new maps.LatLngBounds();
      pois.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(bounds, 80);
    }
  }, [pois, mapReady]);

  // ── Visit markers ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const AME = markerClassRef.current;
    if (!map || !AME) return;

    const markers = visitMarkersRef.current;
    const seen = new Set<string>();

    for (const visit of visits) {
      seen.add(visit.$id);
      const existing = markers.get(visit.$id);
      const label = visit.placeName || 'Visited spot';
      if (existing) {
        existing.position = { lat: visit.lat, lng: visit.lng };
        continue;
      }

      const content = createCirclePin({
        fillColor: '#17324d',
        fillOpacity: 1,
        radius: 7,
        strokeColor: '#f7f3ea',
        strokeWidth: 3,
      });

      const marker = new AME({
        map,
        position: { lat: visit.lat, lng: visit.lng },
        title: label,
        content,
      });
      marker.addEventListener('gmp-click', () => {
        infoWindowRef.current?.setContent(
          `<div style="font:600 13px sans-serif;color:#17324d;">${escapeHtml(label)}</div>`,
        );
        infoWindowRef.current?.open({ anchor: marker, map });
      });
      markers.set(visit.$id, marker);
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.map = null;
        markers.delete(id);
      }
    }
  }, [visits, mapReady]);

  // ── Live location markers ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const AME = markerClassRef.current;
    if (!map || !AME) return;

    const markers = locationMarkersRef.current;
    const seen = new Set<string>();

    for (const loc of locations) {
      seen.add(loc.userId);
      const title = `${loc.name}${loc.isSelf ? ' (you)' : ''} · ${new Date(loc.timestamp).toLocaleTimeString()}`;
      const existing = markers.get(loc.userId);
      if (existing) {
        existing.position = { lat: loc.lat, lng: loc.lng };
        existing.title = title;
        continue;
      }

      const marker = new AME({
        map,
        position: { lat: loc.lat, lng: loc.lng },
        title,
        content: createPersonPin(loc.name, colorForUser(loc.userId), loc.isSelf),
        zIndex: loc.isSelf ? 1000 : 900, // keep people above place pins
      });
      markers.set(loc.userId, marker);
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.map = null;
        markers.delete(id);
      }
    }
  }, [locations, mapReady]);

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full" />
      {mapError && (
        <div className="absolute inset-x-4 top-4 rounded-2xl border border-[color:var(--danger)]/20 bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--danger)] shadow-[0_12px_30px_rgba(19,33,44,0.14)]">
          {mapError}
        </div>
      )}
    </div>
  );
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
