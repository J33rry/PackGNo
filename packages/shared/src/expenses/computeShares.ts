/**
 * Turn an expense's total into each participant's share.
 *
 * This is the write-side companion to `computeBalances` (which is the read
 * side): when someone records an expense, we split the total across the chosen
 * participants and persist one `expense_splits` row per person. The three split
 * modes mirror Splitwise — equal, exact amounts, and percentages.
 *
 * Pure and dependency-free (runs identically in the browser, Hermes, and Node
 * tests). All arithmetic goes through integer minor units (paise) so shares
 * always sum back to the total with zero rounding drift — the last paise of a
 * ₹100 / 3 split lands on a real person instead of vanishing.
 */

import type { ExpenseSplitType } from '../types/index';

/** One participant's computed share, in major units (rupees), 2 decimals. */
export interface ComputedShare {
  userId: string;
  shareAmount: number;
}

/** A participant plus the raw input a split mode needs from them. */
export interface ShareParticipant {
  userId: string;
  /**
   * For `exact`: this user's amount in major units.
   * For `percentage`: this user's percentage (0–100).
   * Ignored for `equal`.
   */
  value?: number;
}

export class InvalidSplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSplitError';
  }
}

const MINOR_UNITS = 100;
const toMinor = (amount: number) => Math.round(amount * MINOR_UNITS);
const toMajor = (minor: number) => minor / MINOR_UNITS;

/**
 * Split `amount` across `participants` according to `splitType`.
 *
 * - `equal`: ignores each participant's `value`; divides evenly and hands the
 *   leftover paise, one each, to the earliest participants so the shares still
 *   sum exactly to the total.
 * - `exact`: uses each participant's `value` as their rupee share; the values
 *   must sum to `amount` (within a paise) or it throws.
 * - `percentage`: uses each participant's `value` as a percent; the percents
 *   must sum to 100 (within a rounding tolerance). Shares are computed in paise
 *   with the same leftover-distribution so they sum exactly to the total.
 *
 * Always returns one entry per participant, in the input order.
 */
export function computeShares(
  amount: number,
  splitType: ExpenseSplitType,
  participants: ShareParticipant[],
): ComputedShare[] {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new InvalidSplitError(`Amount must be a positive number, got: ${amount}`);
  }
  if (participants.length === 0) {
    throw new InvalidSplitError('At least one participant is required');
  }

  const totalMinor = toMinor(amount);

  switch (splitType) {
    case 'equal':
      return distributeEvenly(totalMinor, participants);
    case 'exact':
      return fromExact(totalMinor, participants);
    case 'percentage':
      return fromPercentage(totalMinor, participants);
    default: {
      // Exhaustiveness guard — a new ExpenseSplitType must be handled here.
      const never: never = splitType;
      throw new InvalidSplitError(`Unsupported split type: ${String(never)}`);
    }
  }
}

/** Even split with the leftover paise spread across the first N participants. */
function distributeEvenly(totalMinor: number, participants: ShareParticipant[]): ComputedShare[] {
  const n = participants.length;
  const base = Math.floor(totalMinor / n);
  let remainder = totalMinor - base * n; // 0 .. n-1 leftover paise

  return participants.map((p) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { userId: p.userId, shareAmount: toMajor(base + extra) };
  });
}

/** Exact per-person amounts that must reconcile to the total. */
function fromExact(totalMinor: number, participants: ShareParticipant[]): ComputedShare[] {
  const shares = participants.map((p) => {
    if (!Number.isFinite(p.value)) {
      throw new InvalidSplitError(`Missing exact amount for ${p.userId}`);
    }
    return { userId: p.userId, minor: toMinor(p.value as number) };
  });

  const sum = shares.reduce((acc, s) => acc + s.minor, 0);
  if (sum !== totalMinor) {
    throw new InvalidSplitError(
      `Exact amounts (${toMajor(sum)}) must sum to the total (${toMajor(totalMinor)})`,
    );
  }
  return shares.map((s) => ({ userId: s.userId, shareAmount: toMajor(s.minor) }));
}

/** Percentages that must sum to 100; leftover paise spread by largest remainder. */
function fromPercentage(totalMinor: number, participants: ShareParticipant[]): ComputedShare[] {
  const percents = participants.map((p) => {
    if (!Number.isFinite(p.value) || (p.value as number) < 0) {
      throw new InvalidSplitError(`Invalid percentage for ${p.userId}`);
    }
    return p.value as number;
  });

  const totalPct = percents.reduce((acc, v) => acc + v, 0);
  // Allow tiny FP noise (e.g. three 33.33s) but reject genuinely wrong inputs.
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new InvalidSplitError(`Percentages must sum to 100, got ${totalPct}`);
  }

  // Floor each share, then hand the remaining paise to the largest fractional
  // parts — this keeps the result closest to the true proportional split.
  const raw = percents.map((pct, i) => {
    const exact = (totalMinor * pct) / 100;
    const floor = Math.floor(exact);
    return { index: i, floor, frac: exact - floor };
  });

  let allocated = raw.reduce((acc, r) => acc + r.floor, 0);
  let leftover = totalMinor - allocated;

  const byFracDesc = [...raw].sort((a, b) => b.frac - a.frac || a.index - b.index);
  const bonus = new Set<number>();
  for (const r of byFracDesc) {
    if (leftover <= 0) break;
    bonus.add(r.index);
    leftover--;
  }

  return participants.map((p, i) => ({
    userId: p.userId,
    shareAmount: toMajor(raw[i]!.floor + (bonus.has(i) ? 1 : 0)),
  }));
}
