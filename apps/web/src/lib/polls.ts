/**
 * Poll CRUD + voting with live updates.
 *
 * A poll is one `polls` doc plus one `poll_options` row per choice. Votes live
 * in `poll_votes`, one row per (poll, user) — enforced by a unique index — so a
 * member changing their mind *updates* their existing vote rather than stacking
 * a new one. Everything inherits the trip's Team permissions, so every member
 * sees polls, options, and the live tally (computed in `@sync/shared`).
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
  type Poll,
  type PollDoc,
  type PollOption,
  type PollOptionDoc,
  type PollStatus,
  type PollVote,
  type PollVoteDoc,
} from '@sync/shared';

export interface NewPollInput {
  tripId: string;
  teamId: string;
  question: string;
  /** Two or more option labels. Blank entries are dropped by the caller. */
  options: string[];
  /** Optional POI this poll is deciding between/about. */
  linkedPoiId?: string | null;
  closesAt?: string | null;
}

/**
 * Create a poll and its options. The poll doc is created first (for its id),
 * then each option references it. If any option fails to persist we roll back
 * the poll so a half-written poll never shows up with missing choices.
 *
 * Returns the poll plus its created option docs.
 */
export async function createPoll(
  input: NewPollInput,
): Promise<{ poll: PollDoc; options: PollOptionDoc[] }> {
  const user = await account.get();

  const labels = input.options.map((o) => o.trim()).filter(Boolean);
  if (labels.length < 2) {
    throw new Error('A poll needs at least two options.');
  }

  const teamRead = Permission.read(Role.team(input.teamId));
  const creatorWrite = [
    Permission.update(Role.user(user.$id)),
    Permission.delete(Role.user(user.$id)),
  ];

  const poll: Poll = {
    tripId: input.tripId,
    question: input.question.trim(),
    createdBy: user.$id,
    status: 'open',
    closesAt: input.closesAt || null,
    linkedPoiId: input.linkedPoiId || null,
    createdAt: new Date().toISOString(),
  };

  const pollDoc = await databases.createDocument<PollDoc>(
    DB_ID,
    COLLECTIONS.polls,
    ID.unique(),
    poll,
    [teamRead, ...creatorWrite],
  );

  try {
    const options = await Promise.all(
      labels.map((label) => {
        const option: PollOption = {
          pollId: pollDoc.$id,
          tripId: input.tripId,
          label,
          poiId: input.linkedPoiId || null,
        };
        return databases.createDocument<PollOptionDoc>(
          DB_ID,
          COLLECTIONS.pollOptions,
          ID.unique(),
          option,
          [teamRead, ...creatorWrite],
        );
      }),
    );
    return { poll: pollDoc, options };
  } catch (err) {
    // Roll back so we don't leave a poll with missing/partial options.
    await deletePoll(pollDoc.$id).catch(() => {});
    throw err;
  }
}

/** All polls for a trip, newest first. */
export async function listPolls(tripId: string): Promise<PollDoc[]> {
  const { documents } = await databases.listDocuments<PollDoc>(DB_ID, COLLECTIONS.polls, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(200),
  ]);
  return documents;
}

/** All options across a trip's polls. */
export async function listPollOptions(tripId: string): Promise<PollOptionDoc[]> {
  const { documents } = await databases.listDocuments<PollOptionDoc>(
    DB_ID,
    COLLECTIONS.pollOptions,
    [Query.equal('tripId', tripId), Query.limit(2000)],
  );
  return documents;
}

/** All votes across a trip's polls. */
export async function listPollVotes(tripId: string): Promise<PollVoteDoc[]> {
  const { documents } = await databases.listDocuments<PollVoteDoc>(DB_ID, COLLECTIONS.pollVotes, [
    Query.equal('tripId', tripId),
    Query.limit(5000),
  ]);
  return documents;
}

export interface CastVoteInput {
  tripId: string;
  teamId: string;
  pollId: string;
  optionId: string;
}

/**
 * Cast (or change) the current user's vote on a poll. One row per (poll, user):
 * if they've already voted we update that row's `optionId`; otherwise we create
 * it. The vote is team-readable and editable/removable only by the voter.
 */
export async function castVote(input: CastVoteInput): Promise<PollVoteDoc> {
  const user = await account.get();

  const { documents: existing } = await databases.listDocuments<PollVoteDoc>(
    DB_ID,
    COLLECTIONS.pollVotes,
    [Query.equal('pollId', input.pollId), Query.equal('userId', user.$id), Query.limit(1)],
  );

  const mine = existing[0];
  if (mine) {
    if (mine.optionId === input.optionId) return mine; // no-op: same choice
    return databases.updateDocument<PollVoteDoc>(DB_ID, COLLECTIONS.pollVotes, mine.$id, {
      optionId: input.optionId,
      votedAt: new Date().toISOString(),
    });
  }

  const voteBody: PollVote = {
    pollId: input.pollId,
    optionId: input.optionId,
    userId: user.$id,
    tripId: input.tripId,
    votedAt: new Date().toISOString(),
  };
  return databases.createDocument<PollVoteDoc>(DB_ID, COLLECTIONS.pollVotes, ID.unique(), voteBody, [
    Permission.read(Role.team(input.teamId)),
    Permission.update(Role.user(user.$id)),
    Permission.delete(Role.user(user.$id)),
  ]);
}

/** Retract the current user's vote on a poll, if any. */
export async function retractVote(pollId: string): Promise<void> {
  const user = await account.get();
  const { documents } = await databases.listDocuments<PollVoteDoc>(DB_ID, COLLECTIONS.pollVotes, [
    Query.equal('pollId', pollId),
    Query.equal('userId', user.$id),
    Query.limit(1),
  ]);
  const mine = documents[0];
  if (mine) await databases.deleteDocument(DB_ID, COLLECTIONS.pollVotes, mine.$id);
}

/** Flip a poll open/closed (creator only, via document permissions). */
export async function setPollStatus(pollId: string, status: PollStatus): Promise<PollDoc> {
  return databases.updateDocument<PollDoc>(DB_ID, COLLECTIONS.polls, pollId, { status });
}

/** Delete a poll along with all of its options and votes. */
export async function deletePoll(pollId: string): Promise<void> {
  const [{ documents: options }, { documents: votes }] = await Promise.all([
    databases.listDocuments<PollOptionDoc>(DB_ID, COLLECTIONS.pollOptions, [
      Query.equal('pollId', pollId),
      Query.limit(2000),
    ]),
    databases.listDocuments<PollVoteDoc>(DB_ID, COLLECTIONS.pollVotes, [
      Query.equal('pollId', pollId),
      Query.limit(5000),
    ]),
  ]);

  await Promise.all([
    ...options.map((o) =>
      databases.deleteDocument(DB_ID, COLLECTIONS.pollOptions, o.$id).catch(() => {}),
    ),
    ...votes.map((v) =>
      databases.deleteDocument(DB_ID, COLLECTIONS.pollVotes, v.$id).catch(() => {}),
    ),
  ]);
  await databases.deleteDocument(DB_ID, COLLECTIONS.polls, pollId);
}

/** Subscribe to a trip's polls (created/closed/deleted by members). */
export function subscribeToPolls(
  tripId: string,
  getCurrent: () => PollDoc[],
  onChange: (next: PollDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.polls), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as PollDoc;
    onChange(applyRealtimeChange(getCurrent(), action, doc, (p) => p.tripId === tripId));
  });
}

/** Subscribe to a trip's poll options. */
export function subscribeToPollOptions(
  tripId: string,
  getCurrent: () => PollOptionDoc[],
  onChange: (next: PollOptionDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.pollOptions), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as PollOptionDoc;
    onChange(applyRealtimeChange(getCurrent(), action, doc, (o) => o.tripId === tripId));
  });
}

/** Subscribe to a trip's votes so tallies recompute live. */
export function subscribeToPollVotes(
  tripId: string,
  getCurrent: () => PollVoteDoc[],
  onChange: (next: PollVoteDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.pollVotes), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as PollVoteDoc;
    onChange(applyRealtimeChange(getCurrent(), action, doc, (v) => v.tripId === tripId));
  });
}
