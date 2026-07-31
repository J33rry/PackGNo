/**
 * Activity CRUD + live updates, plus the LLM draft helper.
 *
 * An activity is a journal entry for the trip — typed by hand or drafted by the
 * AI route from a detected place. Same permission/realtime shape as `pois.ts`
 * and `visits.ts`: team-readable, author-editable.
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
  type Activity,
  type ActivityDoc,
  type ActivitySource,
} from '@sync/shared';
import type { Place } from './places';

export interface NewActivityInput {
  tripId: string;
  teamId: string;
  title: string;
  description: string;
  source: ActivitySource;
  placeName?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: string | null;
  visitId?: string | null;
  occurredAt?: string;
}

/** Create an activity. Team-readable; editable/deletable only by the author. */
export async function createActivity(input: NewActivityInput): Promise<ActivityDoc> {
  const user = await account.get();
  const now = new Date().toISOString();

  const activity: Activity = {
    tripId: input.tripId,
    userId: user.$id,
    title: input.title,
    description: input.description,
    placeName: input.placeName || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    category: input.category || null,
    source: input.source,
    visitId: input.visitId || null,
    occurredAt: input.occurredAt || now,
    createdAt: now,
  };

  return databases.createDocument<ActivityDoc>(DB_ID, COLLECTIONS.activities, ID.unique(), activity, [
    Permission.read(Role.team(input.teamId)),
    Permission.update(Role.user(user.$id)),
    Permission.delete(Role.user(user.$id)),
  ]);
}

/** All activities for a trip, newest first. */
export async function listActivities(tripId: string): Promise<ActivityDoc[]> {
  const { documents } = await databases.listDocuments<ActivityDoc>(DB_ID, COLLECTIONS.activities, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(200),
  ]);
  return documents;
}

export async function updateActivity(
  activityId: string,
  patch: { title?: string; description?: string },
): Promise<ActivityDoc> {
  return databases.updateDocument<ActivityDoc>(DB_ID, COLLECTIONS.activities, activityId, patch);
}

export async function deleteActivity(activityId: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.activities, activityId);
}

/** Subscribe to this trip's activities; `onChange` gets the next list on change. */
export function subscribeToActivities(
  tripId: string,
  getCurrent: () => ActivityDoc[],
  onChange: (next: ActivityDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.activities), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as ActivityDoc;
    onChange(applyRealtimeChange(getCurrent(), action, doc, (a) => a.tripId === tripId));
  });
}

/**
 * Ask the server LLM route to draft a title + description for a place. The API
 * key lives only on the server (see app/api/activities/describe/route.ts).
 * Throws with the server's message on failure (e.g. AI not configured).
 */
export async function generateActivityDraft(
  place: Pick<Place, 'name' | 'category' | 'rawType' | 'address' | 'lat' | 'lng'>,
  note?: string,
): Promise<{ title: string; description: string }> {
  const res = await fetch('/api/activities/describe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      placeName: place.name,
      category: place.rawType ?? place.category,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      note: note ?? null,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { title?: string; description?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate a description.');
  }
  return { title: data.title ?? '', description: data.description ?? '' };
}
