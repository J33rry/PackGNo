'use client';

/**
 * The Expenses tab for a trip: record shared costs, see who owes whom (computed
 * live from the split rows, never stored), and settle up via a UPI QR code.
 *
 * All the money logic — per-participant shares on write, net balances and the
 * minimal set of transfers on read — lives in `@sync/shared` so it's identical
 * to the mobile app and unit-tested. This component is wiring + presentation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeNetBalances,
  minimizeSettlements,
  buildUpiLink,
  type ExpenseDoc,
  type ExpenseSplitDoc,
  type ExpenseSplitType,
  type SettlementDoc,
  type SettlementTransfer,
} from '@sync/shared';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  listSplits,
  subscribeToExpenses,
  subscribeToSplits,
} from '@/lib/expenses';
import { listTripMembers, type TripMemberView } from '@/lib/members';
import {
  confirmSettlement,
  createSettlement,
  listSettlements,
  subscribeToSettlements,
} from '@/lib/settlements';
import { UpiQrCode } from './UpiQrCode';

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const money = (n: number) => INR.format(n);

export function ExpensesPanel({
  tripId,
  teamId,
  currentUserId,
}: {
  tripId: string;
  teamId: string;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<TripMemberView[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [splits, setSplits] = useState<ExpenseSplitDoc[]>([]);
  const [settlements, setSettlements] = useState<SettlementDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settleFor, setSettleFor] = useState<SettlementTransfer | null>(null);

  // Live subscriptions read the latest lists without re-subscribing each change.
  const expensesRef = useRef<ExpenseDoc[]>([]);
  const splitsRef = useRef<ExpenseSplitDoc[]>([]);
  const settlementsRef = useRef<SettlementDoc[]>([]);
  useEffect(() => {
    expensesRef.current = expenses;
    splitsRef.current = splits;
    settlementsRef.current = settlements;
  }, [expenses, splits, settlements]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [m, e, s, st] = await Promise.all([
          listTripMembers(teamId),
          listExpenses(tripId),
          listSplits(tripId),
          listSettlements(tripId),
        ]);
        if (!active) return;
        setMembers(m);
        setExpenses(e);
        setSplits(s);
        setSettlements(st);
      } catch (err) {
        if (active) setError(messageOf(err));
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
      subscribeToExpenses(tripId, () => expensesRef.current, setExpenses),
      subscribeToSplits(tripId, () => splitsRef.current, setSplits),
      subscribeToSettlements(tripId, () => settlementsRef.current, setSettlements),
    ];
    return () => unsubs.forEach((u) => u());
  }, [tripId]);

  const nameOf = useCallback(
    (userId: string) => members.find((m) => m.userId === userId)?.name ?? 'Someone',
    [members],
  );

  const balances = useMemo(() => computeNetBalances(expenses, splits), [expenses, splits]);
  const transfers = useMemo(() => minimizeSettlements(balances), [balances]);
  const myTransfers = useMemo(
    () => transfers.filter((t) => t.fromUserId === currentUserId),
    [transfers, currentUserId],
  );

  async function removeExpense(id: string) {
    setError(null);
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.$id !== id));
      setSplits((prev) => prev.filter((s) => s.expenseId !== id));
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function markReceived(s: SettlementDoc) {
    setError(null);
    try {
      await confirmSettlement(s.$id);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-foreground/60">Loading expenses…</p>;
  }

  return (
    <div className="board-card grid flex-1 gap-4 p-5 sm:p-6 lg:grid-cols-[1fr_1fr]">
      {error && (
        <p className="lg:col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Left column: add + expense list */}
      <div className="flex flex-col gap-4">
        <AddExpenseForm
          members={members}
          currentUserId={currentUserId}
          onError={setError}
          onAdd={async (input) => {
            await createExpense({ tripId, teamId, ...input });
          }}
        />

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground/70">
            Expenses ({expenses.length})
          </h2>
          {expenses.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-foreground/60 dark:border-white/15">
              No expenses yet. Add the first shared cost above.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {expenses.map((e) => (
                <li
                  key={e.$id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10"
                >
                  <div>
                    <div className="font-medium">{e.description}</div>
                    <div className="text-xs text-foreground/50">
                      {money(e.amount)} · paid by {nameOf(e.paidBy)}
                      {e.category ? ` · ${e.category}` : ''}
                    </div>
                  </div>
                  {e.paidBy === currentUserId && (
                    <button
                      onClick={() => removeExpense(e.$id)}
                      title="Delete expense"
                      className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Right column: balances + settle up */}
      <div className="flex flex-col gap-4">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground/70">Balances</h2>
          {balances.every((b) => b.amount === 0) ? (
            <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-foreground/60 dark:border-white/15">
              All square.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {balances
                .filter((b) => b.amount !== 0)
                .map((b) => (
                  <li
                    key={b.userId}
                    className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                  >
                    <span>{nameOf(b.userId)}</span>
                    <span
                      className={
                        b.amount > 0
                          ? 'font-medium text-green-600 dark:text-green-400'
                          : 'font-medium text-red-600 dark:text-red-400'
                      }
                    >
                      {b.amount > 0 ? `is owed ${money(b.amount)}` : `owes ${money(-b.amount)}`}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground/70">Settle up</h2>
          {transfers.length === 0 ? (
            <p className="text-sm text-foreground/50">Nothing to settle.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {transfers.map((t, i) => {
                const mine = t.fromUserId === currentUserId;
                return (
                  <li
                    key={`${t.fromUserId}-${t.toUserId}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                  >
                    <span>
                      {nameOf(t.fromUserId)} → {nameOf(t.toUserId)}{' '}
                      <span className="text-foreground/50">{money(t.amount)}</span>
                    </span>
                    {mine && (
                      <button
                        onClick={() => setSettleFor(t)}
                        className="rounded-lg bg-foreground px-3 py-1 text-xs font-medium text-background"
                      >
                        Pay via UPI
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {myTransfers.length === 0 && transfers.length > 0 && (
            <p className="mt-1 text-xs text-foreground/50">You&apos;re all settled up.</p>
          )}
        </section>

        {settlements.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground/70">Settlement history</h2>
            <ul className="flex flex-col gap-1">
              {settlements.map((s) => (
                <li
                  key={s.$id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2 text-xs dark:border-white/10"
                >
                  <span>
                    {nameOf(s.fromUserId)} → {nameOf(s.toUserId)} · {money(s.amount)}
                  </span>
                  {s.status === 'confirmed' ? (
                    <span className="text-green-600 dark:text-green-400">confirmed</span>
                  ) : s.toUserId === currentUserId ? (
                    <button
                      onClick={() => markReceived(s)}
                      className="rounded border border-black/15 px-2 py-0.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                    >
                      Mark received
                    </button>
                  ) : (
                    <span className="text-foreground/50">pending</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {settleFor && (
        <SettleModal
          transfer={settleFor}
          payee={members.find((m) => m.userId === settleFor.toUserId) ?? null}
          payerName={nameOf(currentUserId)}
          onClose={() => setSettleFor(null)}
          onRecord={async (upiLink) => {
            await createSettlement({
              tripId,
              teamId,
              fromUserId: settleFor.fromUserId,
              toUserId: settleFor.toUserId,
              amount: settleFor.amount,
              upiLink,
            });
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-expense form
// ---------------------------------------------------------------------------

interface AddExpensePayload {
  description: string;
  amount: number;
  paidBy: string;
  splitType: ExpenseSplitType;
  participants: { userId: string; value?: number }[];
}

function AddExpenseForm({
  members,
  currentUserId,
  onAdd,
  onError,
}: {
  members: TripMemberView[];
  currentUserId: string;
  onAdd: (input: AddExpensePayload) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitType, setSplitType] = useState<ExpenseSplitType>('equal');
  // `null` = the default "everyone"; a Set once the user narrows it down. This
  // avoids seeding state from `members` in an effect (which the roster loads
  // asynchronously) — the default just tracks the current roster for free.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const isSelected = (userId: string) => (selected ? selected.has(userId) : true);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev ?? members.map((m) => m.userId));
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!description.trim() || !Number.isFinite(amt) || amt <= 0) {
      onError('Enter a description and a positive amount.');
      return;
    }
    const chosen = members.filter((m) => isSelected(m.userId));
    if (chosen.length === 0) {
      onError('Select at least one participant to split across.');
      return;
    }

    const participants = chosen.map((m) => ({
      userId: m.userId,
      value: splitType === 'equal' ? undefined : Number(values[m.userId]),
    }));

    setSubmitting(true);
    try {
      await onAdd({ description: description.trim(), amount: amt, paidBy, splitType, participants });
      setDescription('');
      setAmount('');
      setValues({});
      setSplitType('equal');
      setSelected(null);
    } catch (err) {
      onError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  }

  const valueLabel = splitType === 'percentage' ? '%' : '₹';

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
    >
      <h2 className="text-sm font-semibold text-foreground/70">Add an expense</h2>

      <div className="flex gap-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was it for?"
          className="flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="₹ Amount"
          className="w-28 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="text-foreground/60">Paid by</label>
        <select
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          className="rounded-lg border border-black/10 bg-transparent px-2 py-1.5 outline-none dark:border-white/15"
        >
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.userId === currentUserId ? 'You' : m.name}
            </option>
          ))}
        </select>

        <label className="ml-auto text-foreground/60">Split</label>
        <select
          value={splitType}
          onChange={(e) => setSplitType(e.target.value as ExpenseSplitType)}
          className="rounded-lg border border-black/10 bg-transparent px-2 py-1.5 capitalize outline-none dark:border-white/15"
        >
          <option value="equal">Equally</option>
          <option value="exact">Exact ₹</option>
          <option value="percentage">Percentage</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-foreground/50">Split across</span>
        {members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isSelected(m.userId)}
                onChange={() => toggle(m.userId)}
              />
              {m.userId === currentUserId ? 'You' : m.name}
            </label>
            {splitType !== 'equal' && isSelected(m.userId) && (
              <div className="flex items-center gap-1">
                <input
                  value={values[m.userId] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [m.userId]: e.target.value }))}
                  inputMode="decimal"
                  className="w-20 rounded border border-black/10 bg-transparent px-2 py-1 text-right text-xs outline-none dark:border-white/15"
                />
                <span className="text-xs text-foreground/50">{valueLabel}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="self-end rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? 'Adding…' : 'Add expense'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Settle-up modal (UPI QR)
// ---------------------------------------------------------------------------

function SettleModal({
  transfer,
  payee,
  payerName,
  onClose,
  onRecord,
  onError,
}: {
  transfer: SettlementTransfer;
  payee: TripMemberView | null;
  payerName: string;
  onClose: () => void;
  onRecord: (upiLink: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [recorded, setRecorded] = useState(false);

  let upiLink: string | null = null;
  let buildError: string | null = null;
  if (payee?.upiId) {
    try {
      upiLink = buildUpiLink({
        payeeVpa: payee.upiId,
        payeeName: payee.name,
        amount: transfer.amount,
        note: `PackNGo settle-up from ${payerName}`,
      });
    } catch (err) {
      buildError = messageOf(err);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-[min(360px,100%)] rounded-2xl border border-black/10 bg-background p-5 text-center shadow-xl dark:border-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Pay {payee?.name ?? 'member'}</h3>
        <p className="mt-1 text-2xl font-semibold">{money(transfer.amount)}</p>

        {!payee?.upiId ? (
          <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-3 text-sm text-amber-700 dark:text-amber-400">
            {payee?.name ?? 'This member'} hasn&apos;t added a UPI id yet, so there&apos;s nothing to
            scan. Ask them to set one in their profile.
          </p>
        ) : buildError ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{buildError}</p>
        ) : (
          <>
            <div className="mt-4 flex justify-center">
              <UpiQrCode value={upiLink!} />
            </div>
            <p className="mt-2 text-xs text-foreground/50">
              Scan with any UPI app to pay {payee.upiId}
            </p>
          </>
        )}

        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm text-foreground/60 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Close
          </button>
          {upiLink && (
            <button
              disabled={recorded}
              onClick={async () => {
                try {
                  await onRecord(upiLink!);
                  setRecorded(true);
                } catch (err) {
                  onError(messageOf(err));
                }
              }}
              className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {recorded ? 'Recorded ✓' : "I've paid"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}
