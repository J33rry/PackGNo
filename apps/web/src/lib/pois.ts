/**
 * Point-of-interest CRUD + live updates for a trip.
 *
 * POIs inherit the trip's Team permissions, so any member can add one and every
 * member sees it appear live via Appwrite Realtime.
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
  type Poi,
  type PoiCategory,
  type PoiDoc,
  type PoiVisitStatus,
} from '@sync/shared';

export interface NewPoiInput {
  tripId: string;
  teamId: string;
  name: string;
  lat: number;
  lng: number;
  category?: PoiCategory;
  notes?: string;
}

/** Add a POI to a trip. Any team member may create; only they may edit it. */
export async function createPoi(input: NewPoiInput): Promise<PoiDoc> {
  const user = await account.get();

  const poi: Poi = {
    tripId: input.tripId,
    name: input.name,
    lat: input.lat,
    lng: input.lng,
    category: input.category ?? 'other',
    notes: input.notes || null,
    addedBy: user.$id,
    photoId: null,
    visitStatus: 'planned',
    createdAt: new Date().toISOString(),
  };

  return databases.createDocument<PoiDoc>(DB_ID, COLLECTIONS.pois, ID.unique(), poi, [
    Permission.read(Role.team(input.teamId)),
    // Anyone on the trip can tick a place off; only the author can remove it.
    Permission.update(Role.team(input.teamId)),
    Permission.delete(Role.user(user.$id)),
  ]);
}

/** All POIs for a trip, newest first. */
export async function listPois(tripId: string): Promise<PoiDoc[]> {
  const { documents } = await databases.listDocuments<PoiDoc>(DB_ID, COLLECTIONS.pois, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(200),
  ]);
  return documents;
}

/** Move a POI between planned / visited / skipped. */
export async function setPoiVisitStatus(
  poiId: string,
  visitStatus: PoiVisitStatus,
): Promise<PoiDoc> {
  return databases.updateDocument<PoiDoc>(DB_ID, COLLECTIONS.pois, poiId, { visitStatus });
}

export async function deletePoi(poiId: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.pois, poiId);
}

/**
 * Subscribe to this trip's POIs. Calls `onChange` with the next list whenever
 * a member adds, edits, or removes one. Returns an unsubscribe function.
 */
export function subscribeToPois(
  tripId: string,
  getCurrent: () => PoiDoc[],
  onChange: (next: PoiDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.pois), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as PoiDoc;
    onChange(
      applyRealtimeChange(getCurrent(), action, doc, (p) => p.tripId === tripId),
    );
  });
}
