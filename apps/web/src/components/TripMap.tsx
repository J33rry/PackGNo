'use client';

/**
 * MapLibre GL JS map for a trip.
 *
 * Uses OpenFreeMap vector tiles (free, no API key). Markers are managed
 * imperatively — MapLibre owns the DOM inside the container, so we sync
 * markers in an effect rather than rendering them as React children.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
// Pinned to maplibre-gl v5 on purpose: v6.0.0 does not work under Next 16's
// Turbopack — the style never finishes loading (`isStyleLoaded()` stays false,
// no `load` event, no tiles) and it fails *silently*, rendering a blank map.
// Re-test before bumping to v6. `MapLibreMap` is the alias for `Map`, which
// avoids clashing with the built-in Map used for the marker registry below.
import {
  LngLatBounds,
  MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  DEFAULT_MAP_CAMERA,
  DEFAULT_MAP_STYLE_URL,
  type PoiDoc,
  type VisitDoc,
} from '@sync/shared';
import type { ViewBox } from '@/lib/places';

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;

/** Marker colour per POI category, so the map reads at a glance. */
const CATEGORY_COLOR: Record<string, string> = {
  food: '#e8710a',
  sight: '#1a73e8',
  lodging: '#9334e6',
  activity: '#0f9d58',
  transport: '#5f6368',
  other: '#d93025',
};

/** A labeled place tapped straight off the vector tiles (a hotel, café, …). */
export interface TappedPlace {
  name: string;
  /** Raw OSM descriptor from the tile (e.g. `hotel`), for category mapping. */
  rawType: string | null;
  lat: number;
  lng: number;
}

/** Imperative controls the parent can call to drive the map. */
export interface TripMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  getViewBox: () => ViewBox | undefined;
}

interface TripMapProps {
  pois: PoiDoc[];
  /** Check-ins to render as a distinct marker layer. */
  visits?: VisitDoc[];
  /** Fired when the user clicks empty map space — used to add a POI there. */
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  /** Fired when the user taps a labeled place rendered in the tiles. */
  onPlaceTap?: (place: TappedPlace) => void;
  /** Fired when a POI marker is clicked. */
  onPoiClick?: (poi: PoiDoc) => void;
  className?: string;
}

/** OpenMapTiles POI source-layer name — where labeled places live in the tiles. */
const POI_SOURCE_LAYER = 'poi';

/** Build the small dot element used for a visit marker. */
function visitMarkerElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = '14px';
  el.style.height = '14px';
  el.style.borderRadius = '9999px';
  el.style.background = '#0d9488';
  el.style.border = '2px solid white';
  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
  el.style.cursor = 'pointer';
  return el;
}

export const TripMap = forwardRef<TripMapHandle, TripMapProps>(function TripMap(
  { pois, visits = [], onMapClick, onPlaceTap, onPoiClick, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const visitMarkersRef = useRef<Map<string, Marker>>(new Map());
  const hasFitRef = useRef(false);
  // Bumped when the map instance is created, so the marker effect re-runs.
  const [mapReady, setMapReady] = useState(0);

  // Keep the latest callbacks without re-creating the map. Assigned in an
  // effect (not during render) so this stays React-strict-mode clean.
  const clickRef = useRef(onMapClick);
  const placeTapRef = useRef(onPlaceTap);
  const poiClickRef = useRef(onPoiClick);
  useEffect(() => {
    clickRef.current = onMapClick;
    placeTapRef.current = onPlaceTap;
    poiClickRef.current = onPoiClick;
  });

  // Expose fly-to + viewport reads to the parent (search results, biasing).
  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, zoom = 15) {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 800 });
    },
    getViewBox() {
      const b = mapRef.current?.getBounds();
      if (!b) return undefined;
      return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
    },
  }), []);

  // Create the map once the container actually has a size.
  //
  // MapLibre measures its container exactly once, at construction. In a flex or
  // grid parent the box is frequently still 0×0 on first paint, and a map built
  // at that size never finishes loading its style — it just renders an empty
  // background. So we wait for a real size, then build, and keep the observer
  // around to track later resizes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Capture the stable marker registries for the cleanup closure.
    const markers = markersRef.current;
    const visitMarkers = visitMarkersRef.current;

    const build = () => {
      if (mapRef.current) {
        mapRef.current.resize();
        return;
      }
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return; // not laid out yet

      const map = new MapLibreMap({
        container,
        style: STYLE_URL,
        center: [DEFAULT_MAP_CAMERA.longitude, DEFAULT_MAP_CAMERA.latitude],
        zoom: DEFAULT_MAP_CAMERA.zoom,
      });
      map.addControl(new NavigationControl(), 'top-right');
      map.on('click', (e) => {
        // Prefer a labeled place under the cursor (a hotel, restaurant, …) so
        // tapping one shows its info; fall back to a raw-coordinate click.
        const hits = map
          .queryRenderedFeatures(e.point)
          .filter((f) => f.sourceLayer === POI_SOURCE_LAYER && f.properties?.name);
        const place = hits[0];
        if (place && placeTapRef.current) {
          const props = place.properties ?? {};
          placeTapRef.current({
            name: String(props.name),
            rawType: props.subclass
              ? String(props.subclass)
              : props.class
                ? String(props.class)
                : null,
            lat: e.lngLat.lat,
            lng: e.lngLat.lng,
          });
          return;
        }
        clickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      // Tile/style failures are otherwise silent — the map just renders empty.
      map.on('error', (ev) => console.warn('[map]', ev.error?.message ?? ev));
      mapRef.current = map;
      // Markers/camera are applied by the effect below once the map exists.
      setMapReady((n) => n + 1);
    };

    build();
    const observer = new ResizeObserver(build);
    observer.observe(container);

    return () => {
      observer.disconnect();
      markers.forEach((m) => m.remove());
      markers.clear();
      visitMarkers.forEach((m) => m.remove());
      visitMarkers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync POI markers whenever the POI list changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = markersRef.current;
    const seen = new Set<string>();

    for (const poi of pois) {
      seen.add(poi.$id);
      const existing = markers.get(poi.$id);
      if (existing) {
        existing.setLngLat([poi.lng, poi.lat]);
        existing.getElement().style.opacity = poi.visitStatus === 'visited' ? '0.5' : '1';
        continue;
      }
      const marker = new Marker({
        color: CATEGORY_COLOR[poi.category] ?? CATEGORY_COLOR.other,
      })
        .setLngLat([poi.lng, poi.lat])
        .setPopup(new Popup({ offset: 24 }).setText(poi.name))
        .addTo(map);

      // Visited places are dimmed so the remaining plan stands out.
      if (poi.visitStatus === 'visited') marker.getElement().style.opacity = '0.5';

      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        poiClickRef.current?.(poi);
      });
      markers.set(poi.$id, marker);
    }

    // Drop markers for POIs that no longer exist.
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    // Frame all POIs the first time we get any, then leave the camera alone
    // so the map doesn't yank around while the user is panning.
    if (!hasFitRef.current && pois.length > 0) {
      hasFitRef.current = true;
      const bounds = new LngLatBounds();
      pois.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0 });
    }
  }, [pois, mapReady]);

  // Sync visit-check-in markers (a distinct teal dot) whenever they change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = visitMarkersRef.current;
    const seen = new Set<string>();

    for (const visit of visits) {
      seen.add(visit.$id);
      const existing = markers.get(visit.$id);
      const label = visit.placeName || 'Visited spot';
      if (existing) {
        existing.setLngLat([visit.lng, visit.lat]);
        existing.getPopup()?.setText(label);
        continue;
      }
      const marker = new Marker({ element: visitMarkerElement() })
        .setLngLat([visit.lng, visit.lat])
        .setPopup(new Popup({ offset: 16 }).setText(label))
        .addTo(map);
      markers.set(visit.$id, marker);
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }, [visits, mapReady]);

  return <div ref={containerRef} className={className} />;
});
