'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { joinTripByCode } from '@/lib/join';
import { isValidInviteCode } from '@sync/shared';
import { ArrowRight } from '@/components/marketing/icons';

/**
 * Join-trip flow. Validates the invite code as it's typed, joins on submit, and
 * forwards to the trip board (handled by the caller's onJoined).
 */
export function JoinTripModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: (tripId: string) => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = isValidInviteCode(code);

  function close() {
    if (busy) return;
    setCode('');
    setError(null);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { tripId } = await joinTripByCode(code.trim());
      onJoined(tripId);
    } catch {
      setError("That code doesn't match a trip. Double-check and try again.");
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy="join-trip-title">
      <h2 id="join-trip-title" className="text-xl font-bold text-[color:var(--ink)]">
        Join a trip
      </h2>
      <p className="mt-1 text-sm text-[color:var(--faint)]">
        Enter the invite code someone shared with you.
      </p>

      <form onSubmit={submit} className="mt-6">
        <input
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="XXXXXX"
          maxLength={12}
          className={`w-full rounded-xl border bg-[#1b1b1e] px-4 py-4 text-center font-mono text-2xl tracking-[0.3em] text-[color:var(--ink)] outline-none placeholder:text-[color:var(--faint)]/50 ${
            error ? 'border-[color:var(--danger)]/60' : 'border-[color:var(--line)] focus:border-[color:var(--accent)]/50'
          }`}
        />
        {error ? (
          <p className="mt-2 text-xs text-[color:var(--danger)]">{error}</p>
        ) : (
          <p className="mt-2 text-[11px] text-[color:var(--faint)]">
            Codes skip 0, O, 1, I, and L — no need to worry about mixing them up.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={close} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={!ready || busy} className={primaryBtn}>
            {busy ? 'Joining…' : 'Join trip'}
            {!busy && <ArrowRight size={16} />}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const primaryBtn =
  'inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] px-5 py-2.5 text-sm font-medium text-black hover:shadow-[0_0_28px_rgba(52,211,153,0.3)] disabled:pointer-events-none disabled:opacity-50';
const ghostBtn =
  'rounded-full border border-[color:var(--line-strong)] px-5 py-2.5 text-sm font-medium text-[color:var(--ink)] hover:border-[color:var(--ink)]/40';
