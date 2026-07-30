/**
 * PackNGo notification dispatcher — an Appwrite Function.
 *
 * Triggered by document-create events on the collections that matter to a
 * group, it works out who should hear about the change and sends them a push
 * through Appwrite Messaging (FCM provider).
 *
 * Configure these events on the function:
 *   databases.*.collections.sos_events.documents.*.create
 *   databases.*.collections.expenses.documents.*.create
 *   databases.*.collections.settlements.documents.*.create
 *   databases.*.collections.polls.documents.*.create
 *   databases.*.collections.trip_members.documents.*.create
 *
 * Required scopes: databases.read, documents.read, teams.read, users.read,
 * messages.write.
 */

import { Client, Databases, ID, Messaging, Teams } from 'node-appwrite';
import {
  buildNotification,
  COLLECTIONS,
  type NotificationType,
  type ProfileDoc,
  type TripDoc,
} from '@sync/shared';

/** Minimal shape of the Appwrite Functions runtime context we rely on. */
interface FunctionContext {
  req: {
    headers: Record<string, string>;
    bodyJson?: unknown;
    body?: unknown;
  };
  res: { json: (data: unknown, status?: number) => unknown };
  log: (msg: unknown) => void;
  error: (msg: unknown) => void;
}

/** Maps a triggering collection to the kind of notification it produces. */
const TYPE_BY_COLLECTION: Record<string, NotificationType> = {
  [COLLECTIONS.sosEvents]: 'sos',
  [COLLECTIONS.expenses]: 'expense',
  [COLLECTIONS.settlements]: 'settlement',
  [COLLECTIONS.polls]: 'poll',
  [COLLECTIONS.tripMembers]: 'trip_member',
};

/** Pull the collection id out of an event string. */
function collectionFromEvent(event: string): string | null {
  // databases.<db>.collections.<col>.documents.<doc>.<action>
  const match = /^databases\.[^.]+\.collections\.([^.]+)\.documents\./.exec(event);
  return match?.[1] ?? null;
}

export default async function main(context: FunctionContext) {
  const { req, res, log, error } = context;

  const event = req.headers['x-appwrite-event'] ?? '';
  const collectionId = collectionFromEvent(event);
  const type = collectionId ? TYPE_BY_COLLECTION[collectionId] : undefined;

  if (!type) {
    log(`Ignoring unhandled event: ${event || '(none)'}`);
    return res.json({ ok: true, skipped: 'unhandled-event' });
  }

  const doc = (req.bodyJson ??
    (typeof req.body === 'string' ? JSON.parse(req.body) : req.body)) as Record<string, unknown>;

  const tripId = typeof doc?.tripId === 'string' ? doc.tripId : null;
  if (!tripId) {
    error(`Event ${event} had no tripId; nothing to notify.`);
    return res.json({ ok: false, reason: 'missing-tripId' }, 400);
  }

  // Functions get a short-lived dynamic key; fall back to a configured secret.
  const apiKey = req.headers['x-appwrite-key'] || process.env.APPWRITE_API_KEY;
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const databaseId = process.env.APPWRITE_DATABASE_ID;

  if (!apiKey || !endpoint || !projectId || !databaseId) {
    error('Missing runtime configuration (endpoint/project/database/api key).');
    return res.json({ ok: false, reason: 'misconfigured' }, 500);
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);
  const teams = new Teams(client);
  const messaging = new Messaging(client);

  // --- who triggered it, and which trip ---
  const actorId = pickActor(type, doc);
  const trip = await databases.getDocument<TripDoc>(databaseId, COLLECTIONS.trips, tripId);
  const actorName = actorId ? await lookupName(databases, databaseId, actorId) : undefined;

  // --- who should be told ---
  let recipients: string[];
  if (type === 'settlement') {
    // Only the person being asked for money.
    const to = typeof doc.toUserId === 'string' ? doc.toUserId : null;
    recipients = to ? [to] : [];
  } else {
    const { memberships } = await teams.listMemberships(trip.teamId);
    recipients = memberships
      .map((m) => m.userId)
      .filter((id): id is string => Boolean(id) && id !== actorId);
  }

  if (recipients.length === 0) {
    log('No recipients for this event.');
    return res.json({ ok: true, skipped: 'no-recipients' });
  }

  const { title, body, data } = buildNotification({
    type,
    tripId,
    entityId: String(doc.$id ?? ''),
    tripName: trip.name,
    actorName,
    detail: pickDetail(type, doc),
    amount: typeof doc.amount === 'number' ? doc.amount : undefined,
    currency: typeof doc.currency === 'string' ? doc.currency : undefined,
  });

  await messaging.createPush(
    ID.unique(),
    title,
    body,
    [], // topics
    recipients, // users
    [], // targets
    data,
  );

  log(`Sent "${type}" push to ${recipients.length} user(s) for trip ${tripId}.`);
  return res.json({ ok: true, type, recipients: recipients.length });
}

/** The user whose action triggered the event — they shouldn't be notified. */
function pickActor(type: NotificationType, doc: Record<string, unknown>): string | undefined {
  const key =
    type === 'expense'
      ? 'paidBy'
      : type === 'poll'
        ? 'createdBy'
        : type === 'settlement'
          ? 'fromUserId'
          : 'userId';
  const value = doc[key];
  return typeof value === 'string' ? value : undefined;
}

/** Free-text detail used in the notification body, per event type. */
function pickDetail(type: NotificationType, doc: Record<string, unknown>): string | undefined {
  const key = type === 'expense' ? 'description' : type === 'poll' ? 'question' : 'message';
  const value = doc[key];
  return typeof value === 'string' ? value : undefined;
}

/** Look up a display name from the profiles collection; falls back gracefully. */
async function lookupName(
  databases: Databases,
  databaseId: string,
  userId: string,
): Promise<string | undefined> {
  try {
    const profile = await databases.getDocument<ProfileDoc>(
      databaseId,
      COLLECTIONS.profiles,
      userId,
    );
    return profile.name;
  } catch {
    return undefined;
  }
}
