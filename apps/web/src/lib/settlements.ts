/**
 * Settlement records — the audit trail of "settle up via UPI" actions.
 *
 * A settlement is *not* the computed balance (that's derived live from expense
 * splits and never stored). It's a deliberate record that one member initiated
 * a UPI transfer to another. Because there's no payment webhook to trust, the
 * payee confirms receipt manually, flipping the status pending → confirmed.
 */

import {
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
  type Settlement,
  type SettlementDoc,
} from '@sync/shared';

export interface NewSettlementInput {
  tripId: string;
  teamId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  upiLink: string;
}

/**
 * Record a pending settlement. Team members can read it; the payee can confirm
 * it (update) and the payer who created it can delete it if raised in error.
 */
export async function createSettlement(input: NewSettlementInput): Promise<SettlementDoc> {
  const settlement: Settlement = {
    tripId: input.tripId,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    amount: input.amount,
    status: 'pending',
    upiLink: input.upiLink,
    createdAt: new Date().toISOString(),
    confirmedAt: null,
  };

  return databases.createDocument<SettlementDoc>(
    DB_ID,
    COLLECTIONS.settlements,
    ID.unique(),
    settlement,
    [
      Permission.read(Role.team(input.teamId)),
      // The payee marks it received; the payer can retract their own record.
      Permission.update(Role.user(input.toUserId)),
      Permission.delete(Role.user(input.fromUserId)),
    ],
  );
}

/** Settlements for a trip, newest first. */
export async function listSettlements(tripId: string): Promise<SettlementDoc[]> {
  const { documents } = await databases.listDocuments<SettlementDoc>(
    DB_ID,
    COLLECTIONS.settlements,
    [Query.equal('tripId', tripId), Query.orderDesc('$createdAt'), Query.limit(500)],
  );
  return documents;
}

/** Payee confirms a settlement was received. */
export async function confirmSettlement(settlementId: string): Promise<SettlementDoc> {
  return databases.updateDocument<SettlementDoc>(DB_ID, COLLECTIONS.settlements, settlementId, {
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
  });
}

/** Subscribe to a trip's settlements for live status updates. */
export function subscribeToSettlements(
  tripId: string,
  getCurrent: () => SettlementDoc[],
  onChange: (next: SettlementDoc[]) => void,
): () => void {
  return client.subscribe(documentsChannel(DB_ID, COLLECTIONS.settlements), (message) => {
    const action = actionFromEvents(message.events);
    if (!action) return;
    const doc = message.payload as SettlementDoc;
    onChange(applyRealtimeChange(getCurrent(), action, doc, (s) => s.tripId === tripId));
  });
}
