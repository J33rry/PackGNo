/**
 * Canonical Appwrite collection, bucket, and OAuth identifiers.
 *
 * These string ids must match what you create in the Appwrite console (or via
 * the setup script / CLI). Both apps import from here so a rename happens in
 * exactly one place.
 */

export const COLLECTIONS = {
  profiles: 'profiles',
  trips: 'trips',
  tripMembers: 'trip_members',
  pois: 'pois',
  locations: 'locations',
  expenses: 'expenses',
  expenseSplits: 'expense_splits',
  settlements: 'settlements',
  polls: 'polls',
  pollOptions: 'poll_options',
  pollVotes: 'poll_votes',
  sosEvents: 'sos_events',
} as const;

export type CollectionId = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const BUCKETS = {
  tripCovers: 'trip-covers',
  poiPhotos: 'poi-photos',
  receipts: 'receipts',
  avatars: 'avatars',
} as const;

export type BucketId = (typeof BUCKETS)[keyof typeof BUCKETS];

/** OAuth providers we support through Appwrite. */
export const OAUTH_PROVIDERS = {
  google: 'google',
} as const;

/**
 * Build the deterministic document id for a per-user-per-trip singleton doc
 * (live location pings, poll votes). Using a stable id turns "insert or
 * update" into a plain upsert and enforces one-row-per-user without a query.
 */
export function memberScopedId(parentId: string, userId: string): string {
  return `${parentId}_${userId}`;
}
