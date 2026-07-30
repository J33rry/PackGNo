/**
 * Appwrite client for the mobile (Expo) app.
 *
 * Uses the `react-native-appwrite` SDK. Connection values come from EXPO_PUBLIC_*
 * env vars (inlined by Expo at build time), validated through @sync/shared's
 * `resolveAppwriteConfig`. `setPlatform` must be your app's bundle id / package
 * name so Appwrite's platform allow-list accepts requests from the native app.
 */

import {
  Account,
  Client,
  Databases,
  ID,
  OAuthProvider,
  Permission,
  Query,
  Role,
  Storage,
  Teams,
} from 'react-native-appwrite';
import { resolveAppwriteConfig } from '@sync/shared';

export const appwriteConfig = resolveAppwriteConfig({
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
});

export const client = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId)
  .setPlatform(process.env.EXPO_PUBLIC_APP_BUNDLE_ID ?? 'com.packngo.app');

export const account = new Account(client);
export const databases = new Databases(client);
export const teams = new Teams(client);
export const storage = new Storage(client);

/** Shorthand for the configured database id. */
export const DB_ID = appwriteConfig.databaseId;

// Re-export SDK helpers so call sites import everything Appwrite from one place.
export { ID, OAuthProvider, Permission, Query, Role };

export { COLLECTIONS, BUCKETS } from '@sync/shared';
