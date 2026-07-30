/**
 * Auth context for the Expo app. Loads the current Appwrite user on mount,
 * ensures their profile document exists, and exposes sign-in/out actions.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ensureProfile, getCurrentUser, loginWithGoogle, logout, type CurrentUser } from '@/lib/auth';
import { registerForPushNotifications, unregisterPushTarget } from '@/lib/push';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const current = await getCurrentUser();
    setUser(current);
    if (current) {
      await ensureProfile(current);
      // Push registration is best-effort: a denied permission, Expo Go, or a
      // missing FCM provider must never block the user from using the app.
      try {
        const result = await registerForPushNotifications();
        if (result.status === 'skipped') {
          console.warn('[push] not registered:', result.reason);
        }
      } catch (e) {
        console.warn('[push] registration failed:', e);
      }
    }
    return current;
  }, []);

  const signIn = useCallback(async () => {
    await loginWithGoogle();
    await load();
  }, [load]);

  const signOut = useCallback(async () => {
    // Detach this device first, while the session is still valid.
    await unregisterPushTarget();
    await logout();
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await load();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
