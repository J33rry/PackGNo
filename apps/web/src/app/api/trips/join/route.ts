/**
 * POST /api/trips/join — join a trip by invite code.
 *
 * Joining crosses a permission boundary the browser can't: a non-member can't
 * read a trip they're not on (to resolve the code) nor add themselves to its
 * Team. So this runs server-side with the admin API key, but only after
 * confirming *who* is asking via the caller's Appwrite JWT.
 *
 * Flow: verify the JWT → look up the trip by code (admin) → add the caller to
 * the trip's Team as a member (admin). Being on the Team is what grants access;
 * team-scoped document permissions do the rest.
 */

import { NextResponse } from 'next/server';
import { Query, type Models } from 'node-appwrite';
import { COLLECTIONS, normalizeInviteCode, type Trip } from '@sync/shared';
import { adminClient, isServerConfigured, SERVER_DB_ID, userClient } from '@/lib/appwrite-server';

type TripRow = Trip & Models.Document;

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json(
      { error: 'Joining is not configured on the server (missing APPWRITE_API_KEY).' },
      { status: 500 },
    );
  }

  // 1. Who is asking? The browser mints a short-lived JWT via account.createJWT().
  const jwt = bearerToken(request);
  if (!jwt) {
    return NextResponse.json({ error: 'You must be signed in to join a trip.' }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? normalizeInviteCode(body.code) : '';
  if (!code) {
    return NextResponse.json({ error: 'Enter a valid invite code.' }, { status: 400 });
  }

  let userId: string;
  try {
    const me = await userClient(jwt).account.get();
    userId = me.$id;
  } catch {
    return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
  }

  const { databases, teams } = adminClient();

  // 2. Resolve the code to a trip (admin read — the caller can't see it yet).
  let trip: TripRow;
  try {
    const { documents } = await databases.listDocuments<TripRow>(SERVER_DB_ID, COLLECTIONS.trips, [
      Query.equal('inviteCode', code),
      Query.limit(1),
    ]);
    if (documents.length === 0) {
      return NextResponse.json({ error: 'No trip matches that invite code.' }, { status: 404 });
    }
    trip = documents[0];
  } catch {
    return NextResponse.json({ error: 'Could not look up that invite code.' }, { status: 502 });
  }

  // 3. Add the caller to the trip's Team. If they're already a member, that's a
  //    success from the user's point of view — just send them in.
  try {
    await teams.createMembership(trip.teamId, ['member'], undefined, userId);
  } catch (err) {
    if (!isAlreadyMember(err)) {
      return NextResponse.json({ error: 'Could not add you to this trip.' }, { status: 502 });
    }
  }

  return NextResponse.json({ tripId: trip.$id, tripName: trip.name });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function isAlreadyMember(err: unknown): boolean {
  const e = err as { code?: number; type?: string; message?: string } | null;
  return (
    e?.code === 409 ||
    e?.type === 'team_invite_already_exists' ||
    /already/i.test(e?.message ?? '')
  );
}
