/**
 * Visit check-in CRUD + live updates for a trip.
 *
 * A visit is an append-only "I was here" record (distinct from the live
 * `locations` doc). Any team member can read the trip's visits; only the author
 * can edit or delete their own. Mirrors the realtime pattern in `pois.ts`.
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
  type Visit,
  type VisitDoc,
} from '@sync/shared';

export interface NewVisitInput {
  tripId: string;
  teamId: string;
  lat: number;
  lng: number;
  placeName?: string | null;
  placeCategory?: string | null;
  address?: string | null;
  note?: string | null;
  /** Defaults to now if omitted. */
  visitedAt?: string;
}

/** Record a check-in. Team-readable; editable/deletable only by the author. */
export async function createVisit(input: NewVisitInput): Promise<VisitDoc> {
  const user = await account.get();
  const now = new Date().toISOString();

  const visit: Visit = {
    tripId: input.tripId,
    userId: user.$id,
    lat: input.lat,
    lng: input.lng,
    placeName: input.placeName || null,
    placeCategory: input.placeCategory || null,
    address: input.address || null,
    note: input.note || null,
    visitedAt: input.visitedAt || now,
    createdAt: now,
  };

  return databases.createDocument<VisitDoc>(DB_ID, COLLECTIONS.visits, ID.unique(), visit, [
    Permission.read(Role.team(input.teamId)),
    Permission.update(Role.user(user.$id)),
    Permission.delete(Role.user(user.$id)),
  ]);
}

/** All check-ins for a trip, newest first. */
export async function listVisits(tripId: string): Promise<VisitDoc[]> {
  const { documents } = await databases.listDocuments<VisitDoc>(DB_ID, COLLECTIONS.visits, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(200),
  ]);
  return documents;
}

export async function updateVisitNote(visitId: string, note: string): Promise<VisitDoc> {
  return databases.updateDocument<VisitDoc>(DB_ID, COLLECTIONS.visits, visitId, {
    note: note.trim() || null,
  });
}

export async function deleteVisit(visitId: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.visits, visitId);
}

/** Subscribe to this trip's visits; `onChange` gets the next list on any change. */
export function subscribeToVisits(
  tripId: string,
  getCurrent: () => VisitDoc[],
  onChange: (next: VisitDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.visits), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as VisitDoc;
    onChange(applyRealtimeChange(getCurrent(), action, doc, (v) => v.tripId === tripId));
  });
}
