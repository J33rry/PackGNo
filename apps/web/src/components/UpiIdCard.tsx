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
      className="mt-6 flex flex-col gap-2 rounded-xl border border-black/10 p-4 sm:flex-row sm:items-center dark:border-white/10"
    >
      <div className="flex-1">
        <label className="text-sm font-medium">Your UPI id</label>
        <p className="text-xs text-foreground/50">
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
        className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 sm:w-64 dark:border-white/15"
      />
      <button
        type="submit"
        disabled={!dirty || status === 'saving'}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' && !dirty ? 'Saved ✓' : 'Save'}
      </button>
      {message && <span className="text-xs text-red-600 dark:text-red-400">{message}</span>}
    </form>
  );
}
