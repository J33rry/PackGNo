import { describe, expect, it } from 'vitest';
import { tallyPollResults, type TallyableOption, type TallyableVote } from './tallyVotes';

const opt = (id: string, label = id): TallyableOption => ({ $id: id, label });
const vote = (optionId: string, userId: string): TallyableVote => ({ optionId, userId });

describe('tallyPollResults', () => {
  it('counts votes per option and computes percentages', () => {
    const options = [opt('a', 'Beach'), opt('b', 'Museum')];
    const votes = [vote('a', 'u1'), vote('a', 'u2'), vote('b', 'u3')];

    const result = tallyPollResults(options, votes);

    expect(result.totalVotes).toBe(3);
    expect(result.options.map((o) => [o.optionId, o.count, o.percentage])).toEqual([
      ['a', 2, 67],
      ['b', 1, 33],
    ]);
    expect(result.leadingOptionIds).toEqual(['a']);
  });

  it('preserves input option order and includes zero-vote options', () => {
    const options = [opt('a'), opt('b'), opt('c')];
    const votes = [vote('b', 'u1')];

    const result = tallyPollResults(options, votes);

    expect(result.options.map((o) => o.optionId)).toEqual(['a', 'b', 'c']);
    expect(result.options[0]).toMatchObject({ count: 0, percentage: 0, voterIds: [] });
    expect(result.leadingOptionIds).toEqual(['b']);
  });

  it('reports every tied option as leading', () => {
    const options = [opt('a'), opt('b')];
    const votes = [vote('a', 'u1'), vote('b', 'u2')];

    const result = tallyPollResults(options, votes);

    expect(result.leadingOptionIds).toEqual(['a', 'b']);
  });

  it('returns no leader and zero percentages when there are no votes', () => {
    const result = tallyPollResults([opt('a'), opt('b')], []);

    expect(result.totalVotes).toBe(0);
    expect(result.leadingOptionIds).toEqual([]);
    expect(result.options.every((o) => o.percentage === 0 && o.count === 0)).toBe(true);
  });

  it('ignores votes cast for options not in the poll', () => {
    const result = tallyPollResults([opt('a')], [vote('a', 'u1'), vote('ghost', 'u2')]);

    expect(result.totalVotes).toBe(1);
    expect(result.options).toHaveLength(1);
    expect(result.options[0]!.count).toBe(1);
  });

  it('counts a user at most once per option even if a duplicate row slips in', () => {
    const result = tallyPollResults([opt('a')], [vote('a', 'u1'), vote('a', 'u1')]);

    expect(result.totalVotes).toBe(1);
    expect(result.options[0]!.count).toBe(1);
    expect(result.options[0]!.voterIds).toEqual(['u1']);
  });

  it('accepts options carrying a plain `id` instead of `$id`', () => {
    const options: TallyableOption[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const result = tallyPollResults(options, [vote('a', 'u1')]);

    expect(result.options.map((o) => o.optionId)).toEqual(['a', 'b']);
    expect(result.leadingOptionIds).toEqual(['a']);
  });
});
