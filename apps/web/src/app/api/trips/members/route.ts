/**
 * GET /api/trips/members?teamId=... — the trip's member roster.
 *
 * Why server-side: the browser's `teams.listMemberships` redacts other members'
 * `userId`/`userName` (PII isn't exposed to non-privileged callers), so a client
 * can't build a roster — it sees blank names and can't match profiles. The admin
 * key sees full membership data, so we assemble the roster here, but only after
 * confirming the caller is themselves a member of the team.
 */

import { NextResponse } from 'next/server';
import { Query, type Models } from 'node-appwrite';
import { COLLECTIONS, type Profile } from '@sync/shared';
import { adminClient, isServerConfigured, SERVER_DB_ID, userClient } from '@/lib/appwrite-server';

export const dynamic = 'force-dynamic';

type ProfileRow = Profile & Models.Document;

export async function GET(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json(
      { error: 'Member lookup is not configured on the server (missing APPWRITE_API_KEY).' },
      { status: 500 },
    );
  }

  const jwt = bearerToken(request);
  if (!jwt) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  const teamId = new URL(request.url).searchParams.get('teamId');
  if (!teamId) {
    return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });
  }

  let callerId: string;
  try {
    callerId = (await userClient(jwt).account.get()).$id;
  } catch {
    return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
  }

  const { teams, databases } = adminClient();

  let memberships: Models.Membership[];
  try {
    memberships = (await teams.listMemberships(teamId, [Query.limit(200)])).memberships;
  } catch {
    return NextResponse.json({ error: 'Could not load members.' }, { status: 502 });
  }

  // Authorize: only members of the team may see its roster.
  const confirmed = memberships.filter((m) => m.confirm && m.userId);
  if (!confirmed.some((m) => m.userId === callerId)) {
    return NextResponse.json({ error: 'You are not a member of this trip.' }, { status: 403 });
  }

  // One entry per user (a person can have more than one membership row).
  const byUser = new Map<string, Models.Membership>();
  for (const m of confirmed) if (!byUser.has(m.userId)) byUser.set(m.userId, m);
  const userIds = [...byUser.keys()];

  // Enrich with profiles for display name + UPI id.
  const profiles = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    try {
      const { documents } = await databases.listDocuments<ProfileRow>(SERVER_DB_ID, COLLECTIONS.profiles, [
        Query.equal('userId', userIds),
        Query.limit(userIds.length),
      ]);
      for (const doc of documents) profiles.set(doc.userId, doc);
    } catch {
      // Names just fall back to the membership username below.
    }
  }

  const members = [...byUser.values()]
    .map((m) => {
      const profile = profiles.get(m.userId);
      return {
        userId: m.userId,
        name: profile?.name || m.userName || 'Traveller',
        upiId: profile?.upiId ?? null,
        role: m.roles?.includes('owner') ? 'owner' : 'member',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ members });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
