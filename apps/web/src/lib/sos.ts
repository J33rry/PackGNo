/**
 * SOS / emergency alerts — one `sos_events` doc per alert.
 *
 * Raising an alert is two independent side effects: dialing the emergency number
 * (handled in the UI via a `tel:` link so it fires even offline) and writing an
 * `sos_events` row that every member sees in realtime. This module owns the
 * write; the dial stays in the component.
 *
 * An alert is team-readable so the whole group is notified, and resolvable by
 * anyone on the trip (not just the raiser) — in an emergency, whoever reaches
 * safety first should be able to clear it.
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
  buildSosEvent,
  documentsChannel,
  type LastKnownLocation,
  type SosEventDoc,
} from '@sync/shared';

export interface RaiseSosInput {
  tripId: string;
  teamId: string;
  message?: string | null;
  location?: LastKnownLocation | null;
}

/**
 * Raise a new active SOS. Team-readable so everyone is alerted; updatable and
 * deletable by any member so any of them can resolve or clear it.
 */
export async function raiseSos(input: RaiseSosInput): Promise<SosEventDoc> {
  const user = await account.get();
  const body = buildSosEvent({
    tripId: input.tripId,
    userId: user.$id,
    location: input.location ?? null,
    message: input.message ?? null,
  });
  return databases.createDocument<SosEventDoc>(DB_ID, COLLECTIONS.sosEvents, ID.unique(), body, [
    Permission.read(Role.team(input.teamId)),
    Permission.update(Role.team(input.teamId)),
    Permission.delete(Role.team(input.teamId)),
  ]);
}

/** All SOS events for a trip, newest first (active ones surface at the top in the UI). */
export async function listSosEvents(tripId: string): Promise<SosEventDoc[]> {
  const { documents } = await databases.listDocuments<SosEventDoc>(DB_ID, COLLECTIONS.sosEvents, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]);
  return documents;
}

/** Mark an alert resolved, recording who cleared it and when. */
export async function resolveSos(eventId: string): Promise<SosEventDoc> {
  const user = await account.get();
  return databases.updateDocument<SosEventDoc>(DB_ID, COLLECTIONS.sosEvents, eventId, {
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: user.$id,
  });
}

/** Subscribe to a trip's SOS events so alerts appear the instant they're raised. */
export function subscribeToSos(
  tripId: string,
  getCurrent: () => SosEventDoc[],
  onChange: (next: SosEventDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.sosEvents), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as SosEventDoc;
    onChange(applyRealtimeChange(getCurrent(), action, doc, (e) => e.tripId === tripId));
  });
}
