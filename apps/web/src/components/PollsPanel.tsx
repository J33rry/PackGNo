'use client';

/**
 * The Voting tab for a trip: propose a question with a few options, let every
 * member vote, and watch the tally update live. One vote per member per poll
 * (changeable). Poll authors can close a poll to freeze the result, reopen it,
 * or delete it.
 *
 * Counting lives in `@sync/shared` (`tallyPollResults`) so it's identical to the
 * mobile app and unit-tested; this component is wiring + presentation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  tallyPollResults,
  type PollDoc,
  type PollOptionDoc,
  type PollVoteDoc,
} from '@sync/shared';
import {
  castVote,
  createPoll,
  deletePoll,
  listPollOptions,
  listPolls,
  listPollVotes,
  retractVote,
  setPollStatus,
  subscribeToPollOptions,
  subscribeToPollVotes,
  subscribeToPolls,
} from '@/lib/polls';
import { listTripMembers, type TripMemberView } from '@/lib/members';

export function PollsPanel({
  tripId,
  teamId,
  currentUserId,
}: {
  tripId: string;
  teamId: string;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<TripMemberView[]>([]);
  const [polls, setPolls] = useState<PollDoc[]>([]);
  const [options, setOptions] = useState<PollOptionDoc[]>([]);
  const [votes, setVotes] = useState<PollVoteDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const pollsRef = useRef<PollDoc[]>([]);
  const optionsRef = useRef<PollOptionDoc[]>([]);
  const votesRef = useRef<PollVoteDoc[]>([]);
  useEffect(() => {
    pollsRef.current = polls;
    optionsRef.current = options;
    votesRef.current = votes;
  }, [polls, options, votes]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [m, p, o, v] = await Promise.all([
          listTripMembers(teamId),
          listPolls(tripId),
          listPollOptions(tripId),
          listPollVotes(tripId),
        ]);
        if (!active) return;
        setMembers(m);
        setPolls(p);
        setOptions(o);
        setVotes(v);
      } catch (e) {
        if (active) setError(messageOf(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tripId, teamId]);

  useEffect(() => {
    const unsubs = [
      subscribeToPolls(tripId, () => pollsRef.current, setPolls),
      subscribeToPollOptions(tripId, () => optionsRef.current, setOptions),
      subscribeToPollVotes(tripId, () => votesRef.current, setVotes),
    ];
    return () => unsubs.forEach((u) => u());
  }, [tripId]);

  const nameOf = useCallback(
    (userId: string) =>
      userId === currentUserId ? 'You' : members.find((m) => m.userId === userId)?.name ?? 'Someone',
    [members, currentUserId],
  );

  const optionsByPoll = useMemo(() => {
    const map = new Map<string, PollOptionDoc[]>();
    for (const o of options) {
      const list = map.get(o.pollId);
      if (list) list.push(o);
      else map.set(o.pollId, [o]);
    }
    return map;
  }, [options]);

  const votesByPoll = useMemo(() => {
    const map = new Map<string, PollVoteDoc[]>();
    for (const v of votes) {
      const list = map.get(v.pollId);
      if (list) list.push(v);
      else map.set(v.pollId, [v]);
    }
    return map;
  }, [votes]);

  async function vote(poll: PollDoc, optionId: string) {
    setError(null);
    try {
      await castVote({ tripId, teamId, pollId: poll.$id, optionId });
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function clearMyVote(poll: PollDoc) {
    setError(null);
    try {
      await retractVote(poll.$id);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function toggleStatus(poll: PollDoc) {
    setError(null);
    try {
      await setPollStatus(poll.$id, poll.status === 'open' ? 'closed' : 'open');
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function remove(poll: PollDoc) {
    setError(null);
    try {
      await deletePoll(poll.$id);
      setPolls((prev) => prev.filter((p) => p.$id !== poll.$id));
      setOptions((prev) => prev.filter((o) => o.pollId !== poll.$id));
      setVotes((prev) => prev.filter((v) => v.pollId !== poll.$id));
    } catch (e) {
      setError(messageOf(e));
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-foreground/60">Loading polls…</p>;
  }

  return (
    <div className="board-card mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-5 sm:p-6">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <NewPollForm
        creating={creating}
        onError={setError}
        onCreate={async (input) => {
          setCreating(true);
          setError(null);
          try {
            await createPoll({ tripId, teamId, ...input });
          } catch (e) {
            setError(messageOf(e));
            throw e;
          } finally {
            setCreating(false);
          }
        }}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/70">Polls ({polls.length})</h2>
        {polls.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-sm text-foreground/60 dark:border-white/15">
            No polls yet. Ask the group something above — “Where to for dinner?”
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {polls.map((poll) => (
              <PollCard
                key={poll.$id}
                poll={poll}
                options={optionsByPoll.get(poll.$id) ?? []}
                votes={votesByPoll.get(poll.$id) ?? []}
                currentUserId={currentUserId}
                nameOf={nameOf}
                onVote={(optionId) => vote(poll, optionId)}
                onClearVote={() => clearMyVote(poll)}
                onToggleStatus={() => toggleStatus(poll)}
                onDelete={() => remove(poll)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Poll card
// ---------------------------------------------------------------------------

function PollCard({
  poll,
  options,
  votes,
  currentUserId,
  nameOf,
  onVote,
  onClearVote,
  onToggleStatus,
  onDelete,
}: {
  poll: PollDoc;
  options: PollOptionDoc[];
  votes: PollVoteDoc[];
  currentUserId: string;
  nameOf: (userId: string) => string;
  onVote: (optionId: string) => void;
  onClearVote: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const results = useMemo(() => tallyPollResults(options, votes), [options, votes]);
  const myVote = votes.find((v) => v.userId === currentUserId);
  const isCreator = poll.createdBy === currentUserId;
  const closed = poll.status === 'closed';
  const leaders = new Set(results.leadingOptionIds);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{poll.question}</h3>
            {closed && (
              <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground/50 dark:bg-white/10">
                Closed
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-foreground/50">
            {results.totalVotes} {results.totalVotes === 1 ? 'vote' : 'votes'} · by{' '}
            {nameOf(poll.createdBy)}
          </p>
        </div>
        {isCreator && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={onToggleStatus}
              className="rounded border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              {closed ? 'Reopen' : 'Close'}
            </button>
            <button
              onClick={onDelete}
              title="Delete poll"
              className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {results.options.map((opt) => {
          const mine = myVote?.optionId === opt.optionId;
          const leading = leaders.has(opt.optionId) && results.totalVotes > 0;
          const clickable = !closed;
          return (
            <li key={opt.optionId}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onVote(opt.optionId)}
                aria-pressed={mine}
                className={[
                  'relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition',
                  mine
                    ? 'border-foreground/60'
                    : 'border-black/10 dark:border-white/15',
                  clickable ? 'hover:border-foreground/40' : 'cursor-default opacity-90',
                ].join(' ')}
              >
                {/* Result bar */}
                <span
                  aria-hidden
                  className={[
                    'absolute inset-y-0 left-0 rounded-lg transition-all',
                    mine ? 'bg-foreground/15' : 'bg-black/5 dark:bg-white/10',
                  ].join(' ')}
                  style={{ width: `${opt.percentage}%` }}
                />
                <span className="relative flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className={mine ? 'font-medium' : ''}>{opt.label}</span>
                    {mine && <span className="text-xs text-foreground/50">✓ your vote</span>}
                    {leading && <span title="Leading">🏆</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-foreground/60">
                    {opt.count} · {opt.percentage}%
                  </span>
                </span>
              </button>
              {opt.voterIds.length > 0 && (
                <p className="mt-0.5 px-1 text-[11px] text-foreground/40">
                  {opt.voterIds.map(nameOf).join(', ')}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {!closed && myVote && (
        <button
          onClick={onClearVote}
          className="self-start text-xs text-foreground/50 underline hover:text-foreground/70"
        >
          Retract my vote
        </button>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// New-poll form
// ---------------------------------------------------------------------------

interface NewPollPayload {
  question: string;
  options: string[];
}

function NewPollForm({
  creating,
  onCreate,
  onError,
}: {
  creating: boolean;
  onCreate: (input: NewPollPayload) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  function reset() {
    setQuestion('');
    setOptions(['', '']);
    setOpen(false);
  }

  function setOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) {
      onError('Enter a question.');
      return;
    }
    if (filled.length < 2) {
      onError('Add at least two options.');
      return;
    }
    try {
      await onCreate({ question: question.trim(), options: filled });
      reset();
    } catch {
      // error already surfaced by the caller
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background"
      >
        New poll
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
    >
      <h2 className="text-sm font-semibold text-foreground/70">New poll</h2>

      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask the group something…"
        className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
      />

      <div className="flex flex-col gap-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                title="Remove option"
                className="rounded px-2 py-1 text-xs text-foreground/50 hover:bg-black/5 dark:hover:bg-white/10"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setOptions((prev) => [...prev, ''])}
          className="self-start text-xs text-foreground/60 underline hover:text-foreground/80"
        >
          + Add option
        </button>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg px-3 py-1.5 text-sm text-foreground/60 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create poll'}
        </button>
      </div>
    </form>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}
