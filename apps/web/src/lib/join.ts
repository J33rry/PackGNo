/**
 * Client side of joining a trip by invite code.
 *
 * The actual membership write happens server-side (see /api/trips/join), which
 * needs to trust who's asking. We prove identity by minting a short-lived
 * Appwrite JWT in the browser and sending it as a bearer token — the server
 * verifies it, then adds us to the trip's Team with the admin key.
 */

import { account } from './appwrite';

export interface JoinResult {
  tripId: string;
  tripName: string;
}

/** Join the trip an invite code points to; resolves with the trip to open. */
export async function joinTripByCode(code: string): Promise<JoinResult> {
  const { jwt } = await account.createJWT();

  const res = await fetch('/api/trips/join', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ code }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<JoinResult> & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Could not join that trip.');
  }
  return { tripId: data.tripId!, tripName: data.tripName ?? 'trip' };
}
