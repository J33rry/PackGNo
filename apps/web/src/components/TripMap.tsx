'use client';

/**
 * MapLibre GL JS map for a trip.
 *
 * Uses OpenFreeMap vector tiles (free, no API key). Markers are managed
 * imperatively — MapLibre owns the DOM inside the container, so we sync
 * markers in an effect rather than rendering them as React children.
 */

import { useEffect, useRef, useState } from 'react';
// maplibre-gl v6 is named-exports-only (no default export). `MapLibreMap` is
// its alias for `Map`, avoiding a clash with the built-in Map we use below.
import {
  LngLatBounds,
  MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_MAP_CAMERA, DEFAULT_MAP_STYLE_URL, type PoiDoc } from '@sync/shared';

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

interface TripMapProps {
  pois: PoiDoc[];
  /** Fired when the user clicks empty map space — used to add a POI there. */
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  /** Fired when a marker is clicked. */
  onPoiClick?: (poi: PoiDoc) => void;
  className?: string;
}

export function TripMap({ pois, onMapClick, onPoiClick, className }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const hasFitRef = useRef(false);
  // Bumped when the map instance is created, so the marker effect re-runs.
  const [mapReady, setMapReady] = useState(0);

  // Keep the latest callbacks without re-creating the map.
  const clickRef = useRef(onMapClick);
  const poiClickRef = useRef(onPoiClick);
  clickRef.current = onMapClick;
  poiClickRef.current = onPoiClick;

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
      map.on('click', (e) => clickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      // Tile/style failures are otherwise silent — the map just renders empty.
      map.on('error', (e) => console.warn('[map]', e.error?.message ?? e));
      mapRef.current = map;
      // Markers/camera are applied by the effect below once the map exists.
      setMapReady((n) => n + 1);
    };

    build();
    const observer = new ResizeObserver(build);
    observer.observe(container);

    return () => {
      observer.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers whenever the POI list changes.
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

  return <div ref={containerRef} className={className} />;
}
