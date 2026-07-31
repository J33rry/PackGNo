import { describe, expect, it } from 'vitest';
import { computeShares, InvalidSplitError } from './computeShares';

const sum = (shares: { shareAmount: number }[]) =>
  Math.round(shares.reduce((a, s) => a + s.shareAmount, 0) * 100) / 100;

const p = (userId: string, value?: number) => ({ userId, value });

describe('computeShares — equal', () => {
  it('splits evenly when it divides cleanly', () => {
    const shares = computeShares(90, 'equal', [p('a'), p('b'), p('c')]);
    expect(shares).toEqual([
      { userId: 'a', shareAmount: 30 },
      { userId: 'b', shareAmount: 30 },
      { userId: 'c', shareAmount: 30 },
    ]);
  });

  it('distributes leftover paise to the earliest participants', () => {
    const shares = computeShares(100, 'equal', [p('a'), p('b'), p('c')]);
    // 100 / 3 = 33.33, 33.33, 33.34 → but leftover paise go to the front
    expect(shares.map((s) => s.shareAmount)).toEqual([33.34, 33.33, 33.33]);
    expect(sum(shares)).toBe(100);
  });

  it('handles a single participant', () => {
    expect(computeShares(42.5, 'equal', [p('a')])).toEqual([{ userId: 'a', shareAmount: 42.5 }]);
  });
});

describe('computeShares — exact', () => {
  it('accepts exact amounts that reconcile to the total', () => {
    const shares = computeShares(100, 'exact', [p('a', 60), p('b', 40)]);
    expect(shares).toEqual([
      { userId: 'a', shareAmount: 60 },
      { userId: 'b', shareAmount: 40 },
    ]);
  });

  it('rejects exact amounts that do not sum to the total', () => {
    expect(() => computeShares(100, 'exact', [p('a', 60), p('b', 30)])).toThrow(InvalidSplitError);
  });

  it('rejects a missing exact amount', () => {
    expect(() => computeShares(100, 'exact', [p('a', 100), p('b')])).toThrow(InvalidSplitError);
  });
});

describe('computeShares — percentage', () => {
  it('splits by percentage exactly to the total', () => {
    const shares = computeShares(200, 'percentage', [p('a', 25), p('b', 75)]);
    expect(shares).toEqual([
      { userId: 'a', shareAmount: 50 },
      { userId: 'b', shareAmount: 150 },
    ]);
  });

  it('distributes leftover paise by largest fractional remainder', () => {
    // 100 across 33.33 / 33.33 / 33.34 percent
    const shares = computeShares(100, 'percentage', [p('a', 33.33), p('b', 33.33), p('c', 33.34)]);
    expect(sum(shares)).toBe(100);
  });

  it('rejects percentages that do not sum to 100', () => {
    expect(() => computeShares(100, 'percentage', [p('a', 30), p('b', 30)])).toThrow(
      InvalidSplitError,
    );
  });
});

describe('computeShares — guards', () => {
  it('rejects a non-positive amount', () => {
    expect(() => computeShares(0, 'equal', [p('a')])).toThrow(InvalidSplitError);
  });

  it('rejects an empty participant list', () => {
    expect(() => computeShares(100, 'equal', [])).toThrow(InvalidSplitError);
  });
});
