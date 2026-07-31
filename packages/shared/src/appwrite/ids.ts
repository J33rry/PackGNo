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
  visits: 'visits',
  activities: 'activities',
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
 * update" into a plain upsert.
 *
 * ⚠️ Appwrite caps `documentId` at 36 chars. Two Appwrite-generated ids
 * (~20 chars each) plus the separator overflow that limit, so this ONLY works
 * when both parts are known-short (e.g. a short custom parentId). For docs keyed
 * by two full Appwrite ids, use `ID.unique()` and rely on a unique index over
 * the (parent, user) attributes instead — every member-scoped collection in
 * this app already defines one.
 */
export function memberScopedId(parentId: string, userId: string): string {
  return `${parentId}_${userId}`;
}
