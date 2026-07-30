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
import { memberScopedId, type Trip, type TripDoc, type TripMember } from '@sync/shared';

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

  // 2. Trip document.
  const trip: Trip = {
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

  const tripDoc = await databases.createDocument<TripDoc>(
    DB_ID,
    COLLECTIONS.trips,
    ID.unique(),
    trip,
    [teamRead, ...ownerWrite],
  );

  // 3. Owner's membership row (holds per-trip state like location sharing).
  const member: TripMember = {
    tripId: tripDoc.$id,
    userId: user.$id,
    role: 'owner',
    locationSharingEnabled: false,
    joinedAt: new Date().toISOString(),
  };

  await databases.createDocument(
    DB_ID,
    COLLECTIONS.tripMembers,
    memberScopedId(tripDoc.$id, user.$id),
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
