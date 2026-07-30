/**
 * Splitwise-style balance + settlement math.
 *
 * Pure and dependency-free so it produces identical results in the browser,
 * in Hermes (React Native), and in Node tests — and so it works offline from
 * the local cache without any server round-trip.
 *
 * Money is handled in integer minor units (paise) internally to avoid floating
 * point drift, then converted back to major units at the boundary.
 */

import type { Expense, ExpenseSplit } from '../types/index';

/** Net position of one user: positive = is owed money, negative = owes money. */
export interface NetBalance {
  userId: string;
  /** Signed amount in major units (rupees), rounded to 2 decimals. */
  amount: number;
}

/**
 * A single suggested transfer that reduces outstanding debt.
 * (Distinct from the `Settlement` DB entity, which records a real settle action.)
 */
export interface SettlementTransfer {
  fromUserId: string;
  toUserId: string;
  /** Amount in major units (rupees), rounded to 2 decimals. */
  amount: number;
}

const MINOR_UNITS = 100;

function toMinor(amount: number): number {
  return Math.round(amount * MINOR_UNITS);
}

function toMajor(minor: number): number {
  return Math.round(minor) / MINOR_UNITS;
}

/**
 * Compute each user's net balance across a trip's expenses.
 *
 * For every expense, the payer is credited the full amount and each split
 * participant is debited their share. The returned array is sorted by userId
 * for deterministic output and includes every user that appears as a payer or
 * a split participant (users with a net of exactly zero are included too).
 *
 * @param expenses All expenses for the trip.
 * @param splits   All expense_splits for the trip (child rows of the expenses).
 */
export function computeNetBalances(expenses: Expense[], splits: ExpenseSplit[]): NetBalance[] {
  // userId -> net in minor units
  const net = new Map<string, number>();
  const bump = (userId: string, deltaMinor: number) => {
    net.set(userId, (net.get(userId) ?? 0) + deltaMinor);
  };

  // Index splits by expense so an expense with no splits contributes nothing
  // rather than silently crediting the payer with an unsplit amount.
  const splitsByExpense = new Map<string, ExpenseSplit[]>();
  for (const split of splits) {
    const list = splitsByExpense.get(split.expenseId);
    if (list) list.push(split);
    else splitsByExpense.set(split.expenseId, [split]);
  }

  for (const expense of expenses) {
    const expenseId = (expense as { $id?: string }).$id ?? expenseIdOf(expense);
    const expenseSplits = expenseId ? splitsByExpense.get(expenseId) : undefined;
    if (!expenseSplits || expenseSplits.length === 0) continue;

    // Payer fronted the whole amount → credited.
    bump(expense.paidBy, toMinor(expense.amount));
    // Each participant owes their share → debited.
    for (const split of expenseSplits) {
      bump(split.userId, -toMinor(split.shareAmount));
    }
  }

  return [...net.entries()]
    .map(([userId, minor]) => ({ userId, amount: toMajor(minor) }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
}

/**
 * Fallback expense id extraction for expenses that are the bare (write-shaped)
 * type without Appwrite's `$id`. In practice reads always carry `$id`; this
 * keeps the function total for unit tests that pass synthetic data with an
 * `expenseId`-less shape.
 */
function expenseIdOf(expense: Expense): string | undefined {
  return (expense as unknown as { id?: string }).id;
}

/**
 * Reduce a set of net balances to a near-minimal list of transfers that clears
 * every debt (greedy max-debtor / max-creditor matching).
 *
 * This is the classic "cash flow minimization" heuristic: repeatedly settle
 * the largest debtor against the largest creditor. It does not always produce
 * the theoretical minimum number of transactions (that problem is NP-hard),
 * but it is fast, deterministic, and produces intuitive results for the small
 * groups this app targets.
 *
 * Amounts are matched in minor units so the transfers always sum exactly back
 * to zero with no rounding residue.
 */
export function minimizeSettlements(balances: NetBalance[]): SettlementTransfer[] {
  const debtors: { userId: string; minor: number }[] = []; // owe money (negative)
  const creditors: { userId: string; minor: number }[] = []; // are owed (positive)

  for (const { userId, amount } of balances) {
    const minor = toMinor(amount);
    if (minor < 0) debtors.push({ userId, minor: -minor });
    else if (minor > 0) creditors.push({ userId, minor });
  }

  // Largest first, tie-broken by userId for deterministic output.
  const byAmountThenId = (a: { userId: string; minor: number }, b: { userId: string; minor: number }) =>
    b.minor - a.minor || a.userId.localeCompare(b.userId);
  debtors.sort(byAmountThenId);
  creditors.sort(byAmountThenId);

  const settlements: SettlementTransfer[] = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di]!;
    const creditor = creditors[ci]!;
    const transfer = Math.min(debtor.minor, creditor.minor);

    if (transfer > 0) {
      settlements.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: toMajor(transfer),
      });
    }

    debtor.minor -= transfer;
    creditor.minor -= transfer;
    if (debtor.minor === 0) di++;
    if (creditor.minor === 0) ci++;
  }

  return settlements;
}

/**
 * Convenience: what a single user nets across the trip. Positive = they are
 * owed, negative = they owe. Returns 0 if the user has no activity.
 */
export function netForUser(balances: NetBalance[], userId: string): number {
  return balances.find((b) => b.userId === userId)?.amount ?? 0;
}
