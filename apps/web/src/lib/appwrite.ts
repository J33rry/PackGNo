/**
 * Browser-side Appwrite client for the web app.
 *
 * Uses the `appwrite` (web) SDK. Connection values come from NEXT_PUBLIC_*
 * env vars, validated through @sync/shared's `resolveAppwriteConfig` so a
 * missing value fails loudly at startup. The database id and collection ids
 * are re-exported from @sync/shared for convenience at call sites.
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
} from 'appwrite';
import { resolveAppwriteConfig } from '@sync/shared';

export const appwriteConfig = resolveAppwriteConfig({
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
});

export const client = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const teams = new Teams(client);
export const storage = new Storage(client);

/** Shorthand for the configured database id. */
export const DB_ID = appwriteConfig.databaseId;

// Re-export SDK helpers so call sites import everything Appwrite from one place.
export { ID, OAuthProvider, Permission, Query, Role };

export { COLLECTIONS, BUCKETS } from '@sync/shared';
