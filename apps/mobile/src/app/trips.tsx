import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
} from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { createTrip, listMyTrips } from '@/lib/trips';
import { Spacing } from '@/constants/theme';
import type { TripDoc } from '@sync/shared';

export default function TripsScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  const [trips, setTrips] = useState<TripDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTrips(await listMyTrips());
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load().finally(() => setLoading(false));
  }, [user, load]);

  if (!authLoading && !user) return <Redirect href="/login" />;

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      const trip = await createTrip({ name: trimmed });
      setTrips((prev) => [trip, ...prev]);
      setName('');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.composer}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Trip name (e.g. Goa 2026)"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          editable={!creating}
          onSubmitEditing={handleCreate}
          returnKeyType="done"
        />
        <Pressable
          onPress={handleCreate}
          disabled={creating || !name.trim()}
          style={({ pressed }) => [
            styles.button,
            (pressed || creating || !name.trim()) && styles.buttonDisabled,
          ]}
        >
          <ThemedText type="smallBold" style={styles.buttonLabel}>
            {creating ? 'Creating…' : 'Create'}
          </ThemedText>
        </Pressable>
      </ThemedView>

      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      {loading ? (
        <ThemedView style={styles.center}>
          <ActivityIndicator />
        </ThemedView>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.$id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              No trips yet. Create your first one above.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/trip/${item.$id}`)}
              style={({ pressed }) => pressed && styles.cardPressed}
            >
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="default">{item.name}</ThemedText>
                {!!item.destination && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.destination}
                  </ThemedText>
                )}
              </ThemedView>
            </Pressable>
          )}
        />
      )}

      <Pressable
        onPress={() => signOut().then(() => router.replace('/login'))}
        style={styles.signOut}
      >
        <ThemedText type="small" themeColor="textSecondary">
          Sign out
        </ThemedText>
      </Pressable>
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
  composer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
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
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: '#ffffff' },
  error: { color: '#d93025', paddingHorizontal: Spacing.three },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.four },
  card: { borderRadius: 12, padding: Spacing.three },
  cardPressed: { opacity: 0.7 },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
  signOut: { alignItems: 'center', paddingVertical: Spacing.three },
});
