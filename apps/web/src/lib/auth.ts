/**
 * Client-side auth helpers built on the Appwrite browser SDK.
 *
 * Phase 1 uses SPA-style auth: the browser holds the Appwrite session and
 * `account.get()` tells us who's logged in. Google sign-in uses Appwrite's
 * OAuth2 redirect flow (`createOAuth2Session`), which bounces to Google and
 * back to `successUrl` with the session already established — no manual token
 * exchange needed.
 */

import type { Models } from 'appwrite';
import { account, databases, DB_ID, COLLECTIONS, ID, OAuthProvider, Permission, Role } from './appwrite';
import type { Profile } from '@sync/shared';

export type CurrentUser = Models.User<Models.Preferences>;

/** Absolute URL helper (OAuth redirect targets must be absolute). */
function appUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).toString();
}

/** Start the Google OAuth redirect. The browser navigates away after this. */
export function loginWithGoogle(): void {
  account.createOAuth2Session(
    OAuthProvider.Google,
    appUrl('/trips'),
    appUrl('/login?error=oauth'),
  );
}

/** Returns the logged-in user, or null if there's no active session. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

/** Log out of the current device session. */
export async function logout(): Promise<void> {
  try {
    await account.deleteSession('current');
  } catch {
    // Already signed out — nothing to do.
  }
}

/**
 * Ensure a `profiles` document exists for this user (created on first login).
 * The doc id is the user id so lookups are a direct get, not a query.
 */
export async function ensureProfile(user: CurrentUser): Promise<void> {
  try {
    await databases.getDocument(DB_ID, COLLECTIONS.profiles, user.$id);
    return; // already exists
  } catch {
    // Fall through to create.
  }

  const profile: Profile = {
    userId: user.$id,
    name: user.name || user.email || 'Traveller',
    avatarUrl: null,
    phone: user.phone || null,
    upiId: null,
    createdAt: new Date().toISOString(),
  };

  try {
    await databases.createDocument(DB_ID, COLLECTIONS.profiles, user.$id, profile, [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]);
  } catch {
    // A concurrent login may have created it first; that's fine.
  }
}
