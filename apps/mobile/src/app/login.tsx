import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OAuthCancelledError } from '@/lib/auth';
import { Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const { user, loading, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) return <Redirect href="/trips" />;

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (e) {
      // A cancelled sign-in is a normal user action, not an error worth shouting about.
      setError(e instanceof OAuthCancelledError ? null : messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>
          <ThemedText type="subtitle">Welcome to PackNGo</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.tagline}>
            Sign in to plan and run trips with your group.
          </ThemedText>

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          <Pressable
            onPress={handleSignIn}
            disabled={busy}
            style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText type="smallBold" style={styles.buttonLabel}>
                Continue with Google
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Sign-in failed. Please try again.';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  tagline: { marginBottom: Spacing.four },
  error: { color: '#d93025', marginBottom: Spacing.two },
  button: {
    backgroundColor: '#3c87f7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.75 },
  buttonLabel: { color: '#ffffff' },
});
