/**
 * Auth helpers for the Expo app.
 *
 * Mobile can't use the browser's redirect-based OAuth flow, so it uses
 * Appwrite's *token* flow instead:
 *   1. `createOAuth2Token` returns a URL to open in a secure web view.
 *   2. The user signs in with Google there.
 *   3. Appwrite redirects back to our `sync://` deep link carrying
 *      `userId` + `secret` in the query string.
 *   4. `createSession(userId, secret)` exchanges those for a real session.
 */

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Models } from 'react-native-appwrite';
import {
  account,
  appwriteConfig,
  databases,
  DB_ID,
  COLLECTIONS,
  OAuthProvider,
  Permission,
  Role,
} from './appwrite';
import type { Profile } from '@sync/shared';

export type CurrentUser = Models.User<Models.Preferences>;

export class OAuthCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled.');
    this.name = 'OAuthCancelledError';
  }
}

/**
 * Run the Google sign-in flow. Resolves once a session exists; throws
 * {@link OAuthCancelledError} if the user dismissed the web view.
 */
export async function loginWithGoogle(): Promise<void> {
  // Appwrite validates the OAuth success/failure URLs and rejects arbitrary app
  // schemes with "Invalid `success` param ... Register your new client as a new
  // platform" — our own `packngo://` scheme included. The one scheme it always
  // accepts for native apps is `appwrite-callback-<projectId>://`, which is why
  // app.json registers that scheme alongside `packngo`.
  const redirectUri = `appwrite-callback-${appwriteConfig.projectId}://`;

  const authUrl = account.createOAuth2Token(OAuthProvider.Google, redirectUri, redirectUri);
  if (!authUrl) throw new Error('Could not start Google sign-in.');

  const result = await WebBrowser.openAuthSessionAsync(authUrl.toString(), redirectUri);
  if (result.type !== 'success') throw new OAuthCancelledError();

  const params = Linking.parse(result.url).queryParams ?? {};
  const userId = typeof params.userId === 'string' ? params.userId : null;
  const secret = typeof params.secret === 'string' ? params.secret : null;
  if (!userId || !secret) throw new Error('Sign-in did not return a valid session.');

  await account.createSession(userId, secret);
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
