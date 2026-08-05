/**
 * Trip CRUD backed by Appwrite Teams.
 *
 * Each trip owns a Team (one per trip). Membership in that Team is what grants
 * access to the trip and all its child data, via `Role.team(teamId)` document
 * permissions. Creating a trip therefore creates: a Team, the trip document,
 * and the creator's `trip_members` row.
 */

import {
  account,
  databases,
  teams,
  DB_ID,
  COLLECTIONS,
  ID,
  Permission,
  Query,
  Role,
} from './appwrite';
import { generateInviteCode, type Trip, type TripDoc, type TripMember } from '@sync/shared';

export interface NewTripInput {
  name: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  emergencyNumber?: string;
}

/**
 * Create a trip: its Team, the trip document (team-scoped permissions), and the
 * owner's membership row. Returns the created trip document.
 */
export async function createTrip(input: NewTripInput): Promise<TripDoc> {
  const user = await account.get();

  // 1. Team backing this trip; the creator becomes an `owner` member.
  const team = await teams.create(ID.unique(), input.name, ['owner']);

  const teamRead = Permission.read(Role.team(team.$id));
  const ownerWrite = [
    Permission.update(Role.team(team.$id, 'owner')),
    Permission.delete(Role.team(team.$id, 'owner')),
  ];

  // 2. Trip document, stamped with a shareable invite code. The unique index on
  //    `inviteCode` can reject a rare collision, so retry with a fresh code.
  const baseTrip: Omit<Trip, 'inviteCode'> = {
    name: input.name,
    destination: input.destination || null,
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    coverImageId: null,
    teamId: team.$id,
    ownerId: user.$id,
    emergencyNumber: input.emergencyNumber || null,
    createdAt: new Date().toISOString(),
  };

  const tripDoc = await createWithUniqueCode((inviteCode) =>
    databases.createDocument<TripDoc>(
      DB_ID,
      COLLECTIONS.trips,
      ID.unique(),
      { ...baseTrip, inviteCode },
      [teamRead, ...ownerWrite],
    ),
  );

  // 3. Owner's membership row (holds per-trip state like location sharing).
  const member: TripMember = {
    tripId: tripDoc.$id,
    userId: user.$id,
    role: 'owner',
    locationSharingEnabled: false,
    joinedAt: new Date().toISOString(),
  };

  // A composite `${tripId}_${userId}` id would exceed Appwrite's 36-char
  // documentId limit (two ~20-char ids), so use a generated id. The collection's
  // unique index on (tripId, userId) is what actually enforces one row per
  // member — no deterministic id needed for that guarantee.
  await databases.createDocument(
    DB_ID,
    COLLECTIONS.tripMembers,
    ID.unique(),
    member,
    [teamRead, Permission.update(Role.user(user.$id))],
  );

  return tripDoc;
}

/** List every trip the current user belongs to (via their Team memberships). */
export async function listMyTrips(): Promise<TripDoc[]> {
  const { teams: myTeams } = await teams.list();
  const teamIds = myTeams.map((t) => t.$id);
  if (teamIds.length === 0) return [];

  const { documents } = await databases.listDocuments<TripDoc>(DB_ID, COLLECTIONS.trips, [
    Query.equal('teamId', teamIds),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]);
  return documents;
}

/** Fetch a single trip by id (requires the user to be a member). */
export async function getTrip(tripId: string): Promise<TripDoc> {
  return databases.getDocument<TripDoc>(DB_ID, COLLECTIONS.trips, tripId);
}

/**
 * Ensure a trip has an invite code, generating and saving one if missing (for
 * trips created before invite codes existed). Requires trip-doc update
 * permission, i.e. the caller is the trip's team owner. Returns the code.
 */
export async function ensureInviteCode(trip: TripDoc): Promise<string> {
  if (trip.inviteCode) return trip.inviteCode;
  const updated = await updateWithUniqueCode((inviteCode) =>
    databases.updateDocument<TripDoc>(DB_ID, COLLECTIONS.trips, trip.$id, { inviteCode }),
  );
  return updated.inviteCode!;
}

/** True when an error is a unique-constraint violation (Appwrite 409 / "already exists"). */
function isDuplicate(err: unknown): boolean {
  const e = err as { code?: number; type?: string; message?: string } | null;
  return (
    e?.code === 409 ||
    e?.type === 'document_already_exists' ||
    /already exists|unique/i.test(e?.message ?? '')
  );
}

/** Run a create keyed by a fresh invite code, retrying on the rare code collision. */
async function createWithUniqueCode(
  create: (code: string) => Promise<TripDoc>,
): Promise<TripDoc> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await create(generateInviteCode());
    } catch (err) {
      if (!isDuplicate(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

/** Same retry-on-collision loop for an update that assigns a new invite code. */
async function updateWithUniqueCode(
  update: (code: string) => Promise<TripDoc>,
): Promise<TripDoc> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await update(generateInviteCode());
    } catch (err) {
      if (!isDuplicate(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}
