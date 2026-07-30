import { describe, expect, it } from 'vitest';
import {
  computeNetBalances,
  minimizeSettlements,
  netForUser,
  type NetBalance,
} from './computeBalances';
import type { Expense, ExpenseSplit } from '../types/index';

// Helper to build a doc-shaped expense with an $id the splits can reference.
function expense(id: string, paidBy: string, amount: number): Expense {
  return {
    $id: id,
    paidBy,
    amount,
    tripId: 't1',
    description: 'x',
    currency: 'INR',
    splitType: 'equal',
    createdAt: '2026-01-01T00:00:00.000Z',
  } as unknown as Expense;
}

function split(expenseId: string, userId: string, shareAmount: number): ExpenseSplit {
  return { expenseId, userId, shareAmount, tripId: 't1', settled: false };
}

describe('computeNetBalances', () => {
  it('credits the payer and debits participants their share', () => {
    // Alice pays 300 for a dinner split equally among alice/bob/carol (100 each).
    const expenses = [expense('e1', 'alice', 300)];
    const splits = [
      split('e1', 'alice', 100),
      split('e1', 'bob', 100),
      split('e1', 'carol', 100),
    ];

    const balances = computeNetBalances(expenses, splits);

    expect(netForUser(balances, 'alice')).toBe(200); // paid 300, owes 100
    expect(netForUser(balances, 'bob')).toBe(-100);
    expect(netForUser(balances, 'carol')).toBe(-100);
    // Net across everyone must be zero.
    expect(balances.reduce((s, b) => s + b.amount, 0)).toBe(0);
  });

  it('ignores expenses that have no splits', () => {
    const balances = computeNetBalances([expense('e1', 'alice', 300)], []);
    expect(balances).toEqual([]);
  });

  it('handles multiple expenses with different payers', () => {
    const expenses = [expense('e1', 'alice', 300), expense('e2', 'bob', 90)];
    const splits = [
      split('e1', 'alice', 100),
      split('e1', 'bob', 100),
      split('e1', 'carol', 100),
      split('e2', 'alice', 30),
      split('e2', 'bob', 30),
      split('e2', 'carol', 30),
    ];

    const balances = computeNetBalances(expenses, splits);

    expect(netForUser(balances, 'alice')).toBe(170); // 300-100-30
    expect(netForUser(balances, 'bob')).toBe(-40); // 90-100-30
    expect(netForUser(balances, 'carol')).toBe(-130); // -100-30
    expect(balances.reduce((s, b) => s + b.amount, 0)).toBe(0);
  });
});

describe('minimizeSettlements', () => {
  it('produces transfers that clear every balance', () => {
    const balances: NetBalance[] = [
      { userId: 'alice', amount: 200 },
      { userId: 'bob', amount: -100 },
      { userId: 'carol', amount: -100 },
    ];

    const settlements = minimizeSettlements(balances);
    const total = settlements.reduce((s, t) => s + t.amount, 0);

    expect(total).toBe(200);
    // Everyone ends at zero after applying the transfers.
    const after = new Map(balances.map((b) => [b.userId, b.amount]));
    for (const t of settlements) {
      after.set(t.fromUserId, (after.get(t.fromUserId) ?? 0) + t.amount);
      after.set(t.toUserId, (after.get(t.toUserId) ?? 0) - t.amount);
    }
    for (const v of after.values()) expect(v).toBe(0);
  });

  it('returns no transfers when everyone is settled', () => {
    expect(minimizeSettlements([{ userId: 'a', amount: 0 }])).toEqual([]);
  });
});
