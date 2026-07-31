/**
 * Profile reads/writes for the current user and trip members.
 *
 * A `profiles` doc is keyed by the user's id (created on first login), readable
 * by any authenticated user, and writable only by its owner. The UPI id lives
 * here because it's the payee VPA others use when settling up.
 */

import { account, databases, DB_ID, COLLECTIONS } from './appwrite';
import type { ProfileDoc } from '@sync/shared';

/** Fetch a single profile by user id, or null if none exists yet. */
export async function getProfile(userId: string): Promise<ProfileDoc | null> {
  try {
    return await databases.getDocument<ProfileDoc>(DB_ID, COLLECTIONS.profiles, userId);
  } catch {
    return null;
  }
}

/** Set (or clear) the current user's UPI id used to receive settle-up payments. */
export async function updateMyUpiId(upiId: string): Promise<ProfileDoc> {
  const user = await account.get();
  return databases.updateDocument<ProfileDoc>(DB_ID, COLLECTIONS.profiles, user.$id, {
    upiId: upiId.trim() || null,
  });
}
