/**
 * Map configuration shared by both platforms.
 *
 * We use MapLibre (GL JS on web, maplibre-react-native on mobile) with
 * OpenFreeMap vector tiles — fully free, no API key, no billing account.
 * The style URL below is passed straight to MapLibre as its `style` /
 * `mapStyle`. Swap it for another MapLibre-compatible style (e.g. a MapTiler
 * style URL with your key) without touching any map component code.
 */

/** OpenFreeMap style variants (https://openfreemap.org). No key required. */
export const OPENFREEMAP_STYLES = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron',
} as const;

export type OpenFreeMapStyle = keyof typeof OPENFREEMAP_STYLES;

/** Default map style used across the apps. */
export const DEFAULT_MAP_STYLE_URL = OPENFREEMAP_STYLES.liberty;

/** Fallback map centre + zoom when a trip has no POIs yet (roughly India). */
export const DEFAULT_MAP_CAMERA = {
  latitude: 20.5937,
  longitude: 78.9629,
  zoom: 3.5,
} as const;
