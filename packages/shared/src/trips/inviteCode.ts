/**
 * Invite codes — the short token that lets someone join a trip.
 *
 * A code is shared two ways: embedded in a link (`/join/<code>`) or typed by
 * hand on a "join a trip" screen. Both resolve to the same trip, so the code
 * must be easy to read aloud and retype: we use a Crockford-style alphabet with
 * the visually ambiguous characters (0/O, 1/I/L) removed, and normalize input
 * so lowercase or spaced-out entry still matches.
 */

/** Unambiguous uppercase alphabet — no 0, O, 1, I, L. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;

/** Generate a fresh random invite code (uniqueness is enforced by the DB index). */
export function generateInviteCode(length: number = CODE_LENGTH): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const byte = bytes[i] ?? 0;
    out += ALPHABET.charAt(byte % ALPHABET.length);
  }
  return out;
}

/**
 * Normalize user-entered code text: uppercase, and drop anything not in the
 * alphabet (spaces, dashes, and the ambiguous characters people might type by
 * mistake). Returns a comparable canonical form — not a validity guarantee.
 */
export function normalizeInviteCode(raw: string): string {
  const upper = raw.trim().toUpperCase();
  let out = '';
  for (const ch of upper) {
    if (ALPHABET.includes(ch)) out += ch;
  }
  return out;
}

/** True when a normalized code is the right length and fully in-alphabet. */
export function isValidInviteCode(raw: string): boolean {
  const normalized = normalizeInviteCode(raw);
  return normalized.length === CODE_LENGTH;
}

/** Crypto-backed random bytes, falling back to Math.random where crypto is absent. */
function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(buf);
    return buf;
  }
  for (let i = 0; i < n; i += 1) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}
