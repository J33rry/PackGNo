/**
 * Expense + split CRUD with live updates.
 *
 * An expense is stored as one `expenses` doc plus one `expense_splits` child
 * row per participant (shares computed in `@sync/shared`). Both inherit the
 * trip's Team permissions so every member sees them and balances stay live.
 *
 * Balances themselves are never stored — the UI derives them from these rows
 * via `computeNetBalances` / `minimizeSettlements`, so there's no cache to go
 * stale when an expense is added or removed.
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
  computeShares,
  documentsChannel,
  type Expense,
  type ExpenseDoc,
  type ExpenseSplit,
  type ExpenseSplitDoc,
  type ExpenseSplitType,
  type ShareParticipant,
} from '@sync/shared';

export interface NewExpenseInput {
  tripId: string;
  teamId: string;
  description: string;
  amount: number;
  currency?: string;
  /** Who fronted the money. Defaults to the current user. */
  paidBy: string;
  category?: string;
  splitType: ExpenseSplitType;
  /** Participants + (for exact/percentage) their raw value. */
  participants: ShareParticipant[];
}

/**
 * Record an expense and its per-participant splits.
 *
 * The expense doc is created first (so we have its id), then each split row
 * references it. If any split fails to persist we roll back the expense so a
 * half-written expense never pollutes the balance math.
 */
export async function createExpense(input: NewExpenseInput): Promise<ExpenseDoc> {
  const user = await account.get();

  // Compute + validate shares up front so a bad split never creates a doc.
  const shares = computeShares(input.amount, input.splitType, input.participants);

  const teamRead = Permission.read(Role.team(input.teamId));
  const creatorWrite = [
    Permission.update(Role.user(user.$id)),
    Permission.delete(Role.user(user.$id)),
  ];

  const expense: Expense = {
    tripId: input.tripId,
    description: input.description,
    amount: input.amount,
    currency: input.currency ?? 'INR',
    paidBy: input.paidBy,
    category: input.category || null,
    splitType: input.splitType,
    createdAt: new Date().toISOString(),
    receiptId: null,
  };

  const expenseDoc = await databases.createDocument<ExpenseDoc>(
    DB_ID,
    COLLECTIONS.expenses,
    ID.unique(),
    expense,
    [teamRead, ...creatorWrite],
  );

  try {
    await Promise.all(
      shares.map((share) => {
        const split: ExpenseSplit = {
          expenseId: expenseDoc.$id,
          tripId: input.tripId,
          userId: share.userId,
          shareAmount: share.shareAmount,
          settled: false,
        };
        return databases.createDocument(DB_ID, COLLECTIONS.expenseSplits, ID.unique(), split, [
          teamRead,
          ...creatorWrite,
        ]);
      }),
    );
  } catch (err) {
    // Roll back so we don't leave an expense with missing/partial splits.
    await deleteExpense(expenseDoc.$id).catch(() => {});
    throw err;
  }

  return expenseDoc;
}

/** All expenses for a trip, newest first. */
export async function listExpenses(tripId: string): Promise<ExpenseDoc[]> {
  const { documents } = await databases.listDocuments<ExpenseDoc>(DB_ID, COLLECTIONS.expenses, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(500),
  ]);
  return documents;
}

/** All split rows for a trip (across every expense). */
export async function listSplits(tripId: string): Promise<ExpenseSplitDoc[]> {
  const { documents } = await databases.listDocuments<ExpenseSplitDoc>(
    DB_ID,
    COLLECTIONS.expenseSplits,
    [Query.equal('tripId', tripId), Query.limit(2000)],
  );
  return documents;
}

/** Delete an expense and all of its split rows. */
export async function deleteExpense(expenseId: string): Promise<void> {
  const { documents: splits } = await databases.listDocuments<ExpenseSplitDoc>(
    DB_ID,
    COLLECTIONS.expenseSplits,
    [Query.equal('expenseId', expenseId), Query.limit(2000)],
  );
  await Promise.all(
    splits.map((s) =>
      databases.deleteDocument(DB_ID, COLLECTIONS.expenseSplits, s.$id).catch(() => {}),
    ),
  );
  await databases.deleteDocument(DB_ID, COLLECTIONS.expenses, expenseId);
}

/**
 * Subscribe to a trip's expenses. Fires `onChange` with the next list whenever
 * a member adds or removes one. Splits are subscribed separately below.
 */
export function subscribeToExpenses(
  tripId: string,
  getCurrent: () => ExpenseDoc[],
  onChange: (next: ExpenseDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.expenses), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as ExpenseDoc;
    onChange(applyRealtimeChange(getCurrent(), action, doc, (e) => e.tripId === tripId));
  });
}

/** Subscribe to a trip's split rows so balances recompute live. */
export function subscribeToSplits(
  tripId: string,
  getCurrent: () => ExpenseSplitDoc[],
  onChange: (next: ExpenseSplitDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.expenseSplits), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as ExpenseSplitDoc;
    onChange(applyRealtimeChange(getCurrent(), action, doc, (s) => s.tripId === tripId));
  });
}
