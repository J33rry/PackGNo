/**
 * Build a UPI deep link (`upi://pay?...`) from settlement details.
 *
 * This constructs the link ONLY — it does not move money. The link opens the
 * payer's own UPI app (GPay/PhonePe/Paytm/etc.) with the fields pre-filled;
 * the actual transfer happens entirely inside that app, initiated by the user.
 *
 * Spec reference: NPCI UPI Linking Specification (`pa`, `pn`, `am`, `cu`, `tn`, `tr`).
 * Dependency-free so it runs identically in the browser, Hermes, and Node tests.
 */

export interface UpiPaymentParams {
  /** Payee VPA / UPI id, e.g. "alice@okhdfcbank". Maps to `pa`. */
  payeeVpa: string;
  /** Payee display name. Maps to `pn`. */
  payeeName: string;
  /** Amount in major currency units (rupees). Maps to `am`, always 2 decimals. */
  amount: number;
  /** ISO 4217 currency code. Maps to `cu`. UPI only supports INR today. */
  currency?: string;
  /** Free-text note shown in the payer's app. Maps to `tn`. */
  note?: string;
  /** Optional reference id to correlate with a settlement record. Maps to `tr`. */
  transactionRefId?: string;
}

export class InvalidUpiParamsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUpiParamsError';
  }
}

// A UPI VPA looks like `handle@provider`; we validate loosely, not exhaustively.
const VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{1,64}$/;

/**
 * Returns a `upi://pay?...` URI. Throws {@link InvalidUpiParamsError} for a
 * malformed VPA or a non-positive / non-finite amount, so callers can surface
 * a clear message instead of generating a link that silently fails to open.
 */
export function buildUpiLink(params: UpiPaymentParams): string {
  const { payeeVpa, payeeName, amount, currency = 'INR', note, transactionRefId } = params;

  if (!VPA_PATTERN.test(payeeVpa.trim())) {
    throw new InvalidUpiParamsError(`Invalid UPI id: "${payeeVpa}"`);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new InvalidUpiParamsError(`Amount must be a positive number, got: ${amount}`);
  }
  if (!payeeName.trim()) {
    throw new InvalidUpiParamsError('Payee name is required');
  }

  const query = new URLSearchParams({
    pa: payeeVpa.trim(),
    pn: payeeName.trim(),
    am: amount.toFixed(2),
    cu: currency,
  });
  if (note?.trim()) query.set('tn', note.trim());
  if (transactionRefId?.trim()) query.set('tr', transactionRefId.trim());

  return `upi://pay?${query.toString()}`;
}
