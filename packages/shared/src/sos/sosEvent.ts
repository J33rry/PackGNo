/**
 * Helpers for the SOS / emergency feature.
 *
 * These are pure builders only. The actual side effects — dialing `tel:` via
 * platform Linking and writing the sos_events document via the Appwrite SDK —
 * happen in each app, because they differ per platform and must not be coupled
 * to network availability (the dial must fire even with no connectivity).
 */

import type { SosEvent } from '../types/index';

export interface LastKnownLocation {
  lat: number;
  lng: number;
}

export interface BuildSosEventInput {
  tripId: string;
  userId: string;
  location?: LastKnownLocation | null;
  message?: string | null;
  /** Injectable for deterministic tests; defaults to now. */
  now?: Date;
}

/**
 * Build the sos_events document body for a new, active alert. The caller passes
 * the result straight to `databases.createDocument`.
 */
export function buildSosEvent(input: BuildSosEventInput): SosEvent {
  const now = input.now ?? new Date();
  return {
    tripId: input.tripId,
    userId: input.userId,
    lat: input.location?.lat ?? null,
    lng: input.location?.lng ?? null,
    message: input.message?.trim() || null,
    status: 'active',
    createdAt: now.toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
}

/** Digits (and a single leading +) only — strip anything a dialer would choke on. */
export function sanitizeEmergencyNumber(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^0-9]/g, '');
}

/** Build the `tel:` URI for the SOS dial action. */
export function buildTelLink(emergencyNumber: string): string {
  return `tel:${sanitizeEmergencyNumber(emergencyNumber)}`;
}
