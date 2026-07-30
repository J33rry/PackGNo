/**
 * MapLibre map for a trip (native).
 *
 * Uses OpenFreeMap vector tiles — free, no API key. This is a native module,
 * so it only renders in a development/production build, not Expo Go.
 */

import { Camera, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DEFAULT_MAP_CAMERA, DEFAULT_MAP_STYLE_URL, type PoiDoc } from '@sync/shared';

const STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;

/** Marker colour per POI category, matching the web map. */
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
  /** Long-press on the map — used to drop a new place. */
  onLongPress?: (coords: { lat: number; lng: number }) => void;
  onPoiPress?: (poi: PoiDoc) => void;
}

export function TripMap({ pois, onLongPress, onPoiPress }: TripMapProps) {
  // Centre on the first POI when there is one, otherwise the default view.
  const first = pois[0];
  const center: [number, number] = first
    ? [first.lng, first.lat]
    : [DEFAULT_MAP_CAMERA.longitude, DEFAULT_MAP_CAMERA.latitude];

  return (
    <Map
      style={styles.map}
      mapStyle={STYLE_URL}
      onLongPress={(e) => {
        const [lng, lat] = e.nativeEvent.lngLat;
        onLongPress?.({ lat, lng });
      }}
    >
      <Camera
        initialViewState={{
          center,
          zoom: first ? 12 : DEFAULT_MAP_CAMERA.zoom,
        }}
      />

      {pois.map((poi) => (
        <ViewAnnotation
          key={poi.$id}
          id={poi.$id}
          lngLat={[poi.lng, poi.lat]}
          onPress={() => onPoiPress?.(poi)}
        >
          <View
            style={[
              styles.pin,
              { backgroundColor: CATEGORY_COLOR[poi.category] ?? CATEGORY_COLOR.other },
              // Visited places are dimmed so the remaining plan stands out.
              poi.visitStatus === 'visited' && styles.pinVisited,
            ]}
          >
            <ThemedText type="small" style={styles.pinLabel} numberOfLines={1}>
              {poi.name}
            </ThemedText>
          </View>
        </ViewAnnotation>
      ))}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  pin: {
    maxWidth: 140,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pinVisited: { opacity: 0.55 },
  pinLabel: { color: '#ffffff' },
});
