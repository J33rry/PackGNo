/**
 * Trip members — the people an expense can be split across.
 *
 * Membership is defined by the trip's Appwrite Team. We read the team's
 * memberships for the roster, then enrich each one with its `profiles` doc so
 * the UI has a display name and (for settle-up) the member's UPI id. The
 * profile lookups run in parallel and degrade gracefully: a member whose
 * profile can't be read still appears, falling back to their team username.
 */

import { databases, teams, DB_ID, COLLECTIONS, Query } from './appwrite';
import type { ProfileDoc } from '@sync/shared';

export interface TripMemberView {
  userId: string;
  name: string;
  /** Payee VPA for settle-up; null when the member hasn't set one. */
  upiId: string | null;
}

/**
 * Roster for a trip: one entry per Team membership, ordered by name. Members
 * without a confirmed (joined) membership are skipped so pending invitees don't
 * show up as expense participants.
 */
export async function listTripMembers(teamId: string): Promise<TripMemberView[]> {
  const { memberships } = await teams.listMemberships(teamId, [Query.limit(200)]);

  const joined = memberships.filter((m) => m.confirm);
  const userIds = [...new Set(joined.map((m) => m.userId))];

  const profiles = await fetchProfiles(userIds);

  const members = joined.map<TripMemberView>((m) => {
    const profile = profiles.get(m.userId);
    return {
      userId: m.userId,
      name: profile?.name || m.userName || 'Traveller',
      upiId: profile?.upiId ?? null,
    };
  });

  return members.sort((a, b) => a.name.localeCompare(b.name));
}

/** Batch-load profiles into a userId → doc map (missing profiles are omitted). */
async function fetchProfiles(userIds: string[]): Promise<Map<string, ProfileDoc>> {
  const map = new Map<string, ProfileDoc>();
  if (userIds.length === 0) return map;

  // profiles are keyed by userId, so one indexed `equal` query fetches them all.
  const { documents } = await databases.listDocuments<ProfileDoc>(DB_ID, COLLECTIONS.profiles, [
    Query.equal('userId', userIds),
    Query.limit(userIds.length),
  ]);
  for (const doc of documents) map.set(doc.userId, doc);
  return map;
}
