/**
 * Live location sharing — a single, upserted "where I am now" doc per member.
 *
 * Unlike visits (append-only history), each member has at most one `locations`
 * row per trip, enforced by the unique (tripId, userId) index. Enabling sharing
 * upserts it on a foreground geolocation watch; disabling (or leaving the map)
 * deletes it. Presence of a *fresh* row is what "is sharing" means — there's no
 * separate stored flag to drift out of sync.
 *
 * Sharing is strictly opt-in and foreground-only on web: nothing is written
 * until the member turns it on, and the watch stops when they turn it off.
 */

import {
  account,
  client,
  databases,
  DB_ID,
  COLLECTIONS,
  ID,
  Permission,
  Query,
  Role,
} from './appwrite';
import {
  actionFromEvents,
  applyRealtimeChange,
  documentsChannel,
  type LocationPing,
  type LocationPingDoc,
} from '@sync/shared';

export interface UpsertLocationInput {
  tripId: string;
  teamId: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
}

/** Find the current user's location doc for a trip, if one exists. */
async function findMyLocation(tripId: string, userId: string): Promise<LocationPingDoc | null> {
  const { documents } = await databases.listDocuments<LocationPingDoc>(DB_ID, COLLECTIONS.locations, [
    Query.equal('tripId', tripId),
    Query.equal('userId', userId),
    Query.limit(1),
  ]);
  return documents[0] ?? null;
}

/**
 * Upsert the current user's live position. Updates their existing row in place
 * (keeping one doc per member) or creates it, team-readable and writable only by
 * the sharer.
 */
export async function upsertMyLocation(input: UpsertLocationInput): Promise<LocationPingDoc> {
  const user = await account.get();
  const now = new Date().toISOString();

  const existing = await findMyLocation(input.tripId, user.$id);
  if (existing) {
    return databases.updateDocument<LocationPingDoc>(DB_ID, COLLECTIONS.locations, existing.$id, {
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy ?? null,
      heading: input.heading ?? null,
      timestamp: now,
    });
  }

  const ping: LocationPing = {
    tripId: input.tripId,
    userId: user.$id,
    lat: input.lat,
    lng: input.lng,
    accuracy: input.accuracy ?? null,
    heading: input.heading ?? null,
    timestamp: now,
  };
  return databases.createDocument<LocationPingDoc>(
    DB_ID,
    COLLECTIONS.locations,
    ID.unique(),
    ping,
    [
      Permission.read(Role.team(input.teamId)),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ],
  );
}

/** All current member positions for a trip. */
export async function listLocations(tripId: string): Promise<LocationPingDoc[]> {
  const { documents } = await databases.listDocuments<LocationPingDoc>(DB_ID, COLLECTIONS.locations, [
    Query.equal('tripId', tripId),
    Query.limit(200),
  ]);
  return documents;
}

/** Stop sharing: remove the current user's live position, if any. */
export async function deleteMyLocation(tripId: string): Promise<void> {
  const user = await account.get();
  const existing = await findMyLocation(tripId, user.$id);
  if (existing) await databases.deleteDocument(DB_ID, COLLECTIONS.locations, existing.$id);
}

/** Subscribe to a trip's live positions so the map updates as members move. */
export function subscribeToLocations(
  tripId: string,
  getCurrent: () => LocationPingDoc[],
  onChange: (next: LocationPingDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.locations), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as LocationPingDoc;
    onChange(applyRealtimeChange(getCurrent(), action, doc, (l) => l.tripId === tripId));
  });
}
