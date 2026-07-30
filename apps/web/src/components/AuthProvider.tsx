'use client';

/**
 * Client-side auth context. Loads the current Appwrite user once on mount,
 * ensures their profile exists, and exposes { user, loading, refresh, signOut }.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ensureProfile, getCurrentUser, logout, type CurrentUser } from '@/lib/auth';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const current = await getCurrentUser();
    setUser(current);
    if (current) await ensureProfile(current);
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const current = await getCurrentUser();
      if (!active) return;
      setUser(current);
      if (current) await ensureProfile(current);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
