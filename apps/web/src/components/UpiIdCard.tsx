'use client';

/**
 * Lets the signed-in user set the UPI id others use to pay them back.
 *
 * Without a UPI id on a member's profile, settle-up has no payee to build a
 * `upi://` link for — so this is surfaced up front on the trips list. Saving
 * writes straight to the user's own `profiles` doc.
 */

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { getProfile, updateMyUpiId } from '@/lib/profiles';

export function UpiIdCard() {
  const { user } = useAuth();
  const [value, setValue] = useState('');
  const [initial, setInitial] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) return;
    getProfile(user.$id).then((p) => {
      if (!active) return;
      const upi = p?.upiId ?? '';
      setValue(upi);
      setInitial(upi);
    });
    return () => {
      active = false;
    };
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setMessage(null);
    try {
      await updateMyUpiId(value);
      setInitial(value.trim());
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      setMessage(err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Could not save.');
    }
  }

  const dirty = value.trim() !== initial;

  return (
    <form
      onSubmit={save}
      className="glass flex flex-col gap-4 rounded-[2rem] px-6 py-5 sm:flex-row sm:items-center"
    >
      <div className="flex-1">
        <div className="data-label">Settle-up destination</div>
        <label className="mt-2 block text-base font-semibold text-[color:var(--ink)]">Your UPI id</label>
        <p className="mt-1 text-xs leading-6 text-[color:var(--muted)]">
          Others use this to settle up with you (e.g. yourname@okhdfcbank).
        </p>
      </div>
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus('idle');
        }}
        placeholder="yourname@bank"
        className="rounded-full border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)] sm:w-72"
      />
      <button
        type="submit"
        disabled={!dirty || status === 'saving'}
        className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-[color:var(--paper)] disabled:opacity-50"
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' && !dirty ? 'Saved ✓' : 'Save'}
      </button>
      {message && <span className="text-xs text-[color:var(--danger)]">{message}</span>}
    </form>
  );
}
