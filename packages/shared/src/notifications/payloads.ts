/**
 * Push notification contract shared by the sender (the Appwrite dispatch
 * function) and the receiver (the Expo app).
 *
 * Appwrite Messaging delivers `data` as string key/values, so every field here
 * is a string. The app reads `type` + `tripId` to decide where to navigate when
 * a notification is tapped.
 */

export type NotificationType =
  | 'sos'
  | 'expense'
  | 'settlement'
  | 'poll'
  | 'trip_member';

/** Data payload attached to every PackNGo push. */
export interface NotificationData extends Record<string, string> {
  type: NotificationType;
  tripId: string;
  /** Id of the document that triggered the notification. */
  entityId: string;
}

export interface NotificationContent {
  title: string;
  body: string;
  data: NotificationData;
}

/** Format an amount for display inside a notification body. */
function money(amount: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}

export interface BuildNotificationInput {
  type: NotificationType;
  tripId: string;
  entityId: string;
  /** Trip name, used to give the notification context. */
  tripName?: string;
  /** Display name of the person who triggered it. */
  actorName?: string;
  /** Free-text detail (expense description, poll question, SOS message). */
  detail?: string;
  amount?: number;
  currency?: string;
}

/**
 * Build the title/body/data for a push. Kept here (rather than in the function)
 * so wording stays consistent and is unit-testable without a server.
 */
export function buildNotification(input: BuildNotificationInput): NotificationContent {
  const { type, tripId, entityId, tripName, actorName, detail, amount, currency } = input;
  const who = actorName?.trim() || 'Someone';
  const trip = tripName?.trim();
  const inTrip = trip ? ` in ${trip}` : '';

  const data: NotificationData = { type, tripId, entityId };

  switch (type) {
    case 'sos':
      return {
        title: `🚨 ${who} needs help`,
        body: detail?.trim() || `Emergency alert${inTrip}. Tap to see their location.`,
        data,
      };
    case 'expense':
      return {
        title: `New expense${inTrip}`,
        body:
          amount != null
            ? `${who} added ${money(amount, currency)}${detail ? ` for ${detail}` : ''}.`
            : `${who} added an expense${detail ? ` for ${detail}` : ''}.`,
        data,
      };
    case 'settlement':
      return {
        title: `Settle up${inTrip}`,
        body:
          amount != null
            ? `${who} sent you a request for ${money(amount, currency)}.`
            : `${who} sent you a settlement request.`,
        data,
      };
    case 'poll':
      return {
        title: `New poll${inTrip}`,
        body: detail?.trim() ? `${who} asked: ${detail}` : `${who} started a poll. Cast your vote.`,
        data,
      };
    case 'trip_member':
      return {
        title: trip ? `${trip}` : 'Trip update',
        body: `${who} joined the trip.`,
        data,
      };
  }
}
