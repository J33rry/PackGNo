import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripMap } from '@/components/trip-map';
import { useTheme } from '@/hooks/use-theme';
import { createPoi, deletePoi, listPois, setPoiVisitStatus, subscribeToPois } from '@/lib/pois';
import { getTrip } from '@/lib/trips';
import { Spacing } from '@/constants/theme';
import type { PoiDoc, TripDoc } from '@sync/shared';

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const theme = useTheme();

  const [trip, setTrip] = useState<TripDoc | null>(null);
  const [pois, setPois] = useState<PoiDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState('');

  // Realtime needs the current list without re-subscribing on every change.
  const poisRef = useRef<PoiDoc[]>([]);
  poisRef.current = pois;

  useEffect(() => {
    if (!tripId) return;
    let active = true;
    (async () => {
      try {
        const [t, p] = await Promise.all([getTrip(tripId), listPois(tripId)]);
        if (!active) return;
        setTrip(t);
        setPois(p);
      } catch (e) {
        if (active) Alert.alert('Could not load trip', messageOf(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    const unsubscribe = subscribeToPois(tripId, () => poisRef.current, setPois);
    return () => unsubscribe();
  }, [tripId]);

  const addPoi = useCallback(async () => {
    if (!trip || !pending || !name.trim()) return;
    try {
      const created = await createPoi({
        tripId: trip.$id,
        teamId: trip.teamId,
        name: name.trim(),
        lat: pending.lat,
        lng: pending.lng,
      });
      // Realtime delivers this too; dedupe by $id.
      setPois((prev) => (prev.some((p) => p.$id === created.$id) ? prev : [created, ...prev]));
      setPending(null);
      setName('');
    } catch (e) {
      Alert.alert('Could not add place', messageOf(e));
    }
  }, [trip, pending, name]);

  function confirmPoiAction(poi: PoiDoc) {
    Alert.alert(poi.name, poi.category, [
      {
        text: poi.visitStatus === 'visited' ? 'Mark planned' : 'Mark visited',
        onPress: async () => {
          try {
            await setPoiVisitStatus(poi.$id, poi.visitStatus === 'visited' ? 'planned' : 'visited');
          } catch (e) {
            Alert.alert('Could not update', messageOf(e));
          }
        },
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePoi(poi.$id);
            setPois((prev) => prev.filter((p) => p.$id !== poi.$id));
          } catch (e) {
            Alert.alert('Could not remove', messageOf(e));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: trip?.name ?? 'Trip', headerShown: true }} />

      <View style={styles.mapWrap}>
        <TripMap pois={pois} onLongPress={setPending} onPoiPress={confirmPoiAction} />
        {!pending && (
          <View style={styles.hint} pointerEvents="none">
            <ThemedText type="small" style={styles.hintText}>
              Long-press the map to add a place
            </ThemedText>
          </View>
        )}
      </View>

      {pending && (
        <ThemedView type="backgroundElement" style={styles.composer}>
          <ThemedText type="small" themeColor="textSecondary">
            {pending.lat.toFixed(4)}, {pending.lng.toFixed(4)}
          </ThemedText>
          <View style={styles.composerRow}>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Place name"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              onSubmitEditing={addPoi}
              returnKeyType="done"
            />
            <Pressable
              onPress={addPoi}
              disabled={!name.trim()}
              style={({ pressed }) => [
                styles.button,
                (pressed || !name.trim()) && styles.buttonDisabled,
              ]}
            >
              <ThemedText type="smallBold" style={styles.buttonLabel}>
                Add
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setPending(null);
                setName('');
              }}
              style={styles.cancel}
            >
              <ThemedText type="small" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      )}

      <ThemedView style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          {pois.length} {pois.length === 1 ? 'place' : 'places'} ·{' '}
          {pois.filter((p) => p.visitStatus === 'visited').length} visited
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapWrap: { flex: 1 },
  hint: {
    position: 'absolute',
    bottom: Spacing.three,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  hintText: { color: '#ffffff' },
  composer: { padding: Spacing.three, gap: Spacing.two },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    backgroundColor: '#3c87f7',
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 11,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: '#ffffff' },
  cancel: { paddingHorizontal: Spacing.two },
  footer: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
