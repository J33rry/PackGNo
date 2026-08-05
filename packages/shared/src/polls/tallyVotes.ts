/**
 * Poll vote tallying — pure, dependency-free counting of a poll's votes.
 *
 * The read-side companion to the polls feature: given a poll's options and the
 * votes cast on it, produce per-option counts, percentages, and the current
 * leader(s). Balances-style, this is never stored — the UI derives it live from
 * the option + vote rows so realtime updates recompute for free.
 *
 * Pure and framework-agnostic (runs identically in the browser, Hermes, and
 * Node tests), so web and mobile show the same numbers.
 */

/** Minimal shape of an option we can tally (accepts Appwrite `$id` or a plain `id`). */
export interface TallyableOption {
  $id?: string;
  id?: string;
  label: string;
}

/** Minimal shape of a vote we can tally. */
export interface TallyableVote {
  optionId: string;
  userId: string;
}

/** Result for a single option. */
export interface OptionTally {
  optionId: string;
  label: string;
  count: number;
  /** Share of the total, 0–100, rounded to a whole percent (0 when no votes). */
  percentage: number;
  /** Ids of the users who picked this option, in first-seen order. */
  voterIds: string[];
}

/** Full tally for a poll. */
export interface PollResults {
  totalVotes: number;
  /** One entry per option, in the order the options were passed in. */
  options: OptionTally[];
  /** Option id(s) with the highest count — more than one when tied. Empty with no votes. */
  leadingOptionIds: string[];
}

/** Pull an option's id whether it carries Appwrite's `$id` or a plain `id`. */
function optionIdOf(option: TallyableOption): string | undefined {
  return option.$id ?? option.id;
}

/**
 * Tally `votes` across `options`.
 *
 * - Only votes whose `optionId` matches one of the given options are counted;
 *   a vote for an unknown/removed option is ignored (not double-counted, and it
 *   doesn't inflate the total).
 * - A user id is counted at most once per option (dedup guards against a
 *   duplicated row slipping past the unique index).
 * - Percentages are computed against the counted total and rounded; they may not
 *   sum to exactly 100 after rounding, which is expected.
 */
export function tallyPollResults(
  options: TallyableOption[],
  votes: TallyableVote[],
): PollResults {
  const order: string[] = [];
  const voters = new Map<string, Set<string>>();
  for (const option of options) {
    const id = optionIdOf(option);
    if (!id || voters.has(id)) continue;
    order.push(id);
    voters.set(id, new Set());
  }

  for (const vote of votes) {
    const set = voters.get(vote.optionId);
    if (!set) continue; // vote for an option not in this poll — ignore
    set.add(vote.userId);
  }

  let totalVotes = 0;
  for (const id of order) totalVotes += voters.get(id)!.size;

  const tallies: OptionTally[] = options
    .map((option) => {
      const id = optionIdOf(option);
      if (!id) return null;
      const set = voters.get(id)!;
      const count = set.size;
      return {
        optionId: id,
        label: option.label,
        count,
        percentage: totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100),
        voterIds: [...set],
      };
    })
    // De-duplicate options that shared an id (kept only the first above).
    .filter((t, i, arr): t is OptionTally => t !== null && arr.findIndex((o) => o?.optionId === t.optionId) === i);

  const max = tallies.reduce((m, t) => Math.max(m, t.count), 0);
  const leadingOptionIds = max === 0 ? [] : tallies.filter((t) => t.count === max).map((t) => t.optionId);

  return { totalVotes, options: tallies, leadingOptionIds };
}
