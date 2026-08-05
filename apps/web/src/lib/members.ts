/**
 * Trip members — the people an expense can be split across.
 *
 * Membership is defined by the trip's Appwrite Team, but the browser's
 * `teams.listMemberships` redacts other members' userId/userName, so a roster
 * can't be built client-side. We instead call our own server route, which uses
 * the admin key to read full membership data (and enrich it with profiles) after
 * verifying the caller is a member. See `app/api/trips/members`.
 */

import { account } from './appwrite';

export interface TripMemberView {
  userId: string;
  name: string;
  /** Payee VPA for settle-up; null when the member hasn't set one. */
  upiId: string | null;
  role: 'owner' | 'member';
}

/** Roster for a trip's team: one entry per member, ordered by name. */
export async function listTripMembers(teamId: string): Promise<TripMemberView[]> {
  const { jwt } = await account.createJWT();

  const res = await fetch(`/api/trips/members?teamId=${encodeURIComponent(teamId)}`, {
    headers: { authorization: `Bearer ${jwt}` },
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => ({}))) as {
    members?: TripMemberView[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Could not load members.');
  }
  return data.members ?? [];
}
