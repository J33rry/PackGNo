'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { createTrip } from '@/lib/trips';
import type { TripDoc } from '@sync/shared';
import { ArrowRight, Calendar, CheckCircle, Copy, Check, MapPin, Phone } from '@/components/marketing/icons';

/**
 * Create-trip flow. Collects the trip basics, provisions the trip, then swaps
 * the form for a success panel showing the shareable invite code — without
 * closing and reopening the modal.
 */
export function CreateTripModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (trip: TripDoc) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [emergency, setEmergency] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<TripDoc | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const ready = name.trim().length > 0 && destination.trim().length > 0;
  const inviteLink =
    created && typeof window !== 'undefined'
      ? `${window.location.origin}/join/${created.inviteCode}`
      : '';

  function reset() {
    setName('');
    setDestination('');
    setStartDate('');
    setEndDate('');
    setEmergency('');
    setCreated(null);
    setCopied(null);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      const trip = await createTrip({
        name: name.trim(),
        destination: destination.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        emergencyNumber: emergency.trim() || undefined,
      });
      setCreated(trip);
      onCreated(trip);
    } catch (err) {
      onError(messageOf(err));
      close();
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, which: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy="create-trip-title">
      {!created ? (
        <>
          <h2 id="create-trip-title" className="text-xl font-bold text-[color:var(--ink)]">
            Create a trip
          </h2>
          <p className="mt-1 text-sm text-[color:var(--faint)]">
            You&apos;ll get a shareable code to invite the group.
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-4">
            <Field label="Trip name">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Goa 2026"
                className={inputClass}
              />
            </Field>

            <Field label="Destination">
              <div className="relative">
                <MapPin size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--faint)]" />
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Anchor city or place"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>

            <Field label="Dates (optional)">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Calendar size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--faint)]" />
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputClass} pl-9`} />
                </div>
                <div className="relative">
                  <Calendar size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--faint)]" />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputClass} pl-9`} />
                </div>
              </div>
            </Field>

            <Field label="Emergency number (optional)">
              <div className="relative">
                <Phone size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--faint)]" />
                <input
                  value={emergency}
                  onChange={(e) => setEmergency(e.target.value)}
                  placeholder="e.g. 100"
                  inputMode="tel"
                  className={`${inputClass} pl-10`}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[color:var(--faint)]">Falls back to 112 if left blank.</p>
            </Field>

            <div className="mt-2 flex justify-end gap-3">
              <button type="button" onClick={close} className={ghostBtn}>
                Cancel
              </button>
              <button type="submit" disabled={!ready || busy} className={primaryBtn}>
                {busy ? 'Creating…' : 'Create trip'}
                {!busy && <ArrowRight size={16} />}
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[color:var(--accent)]/12 text-[color:var(--accent)]" style={{ animation: 'pngo-pull-up 0.4s ease both' }}>
            <CheckCircle size={30} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[color:var(--ink)]">Trip created</h2>
          <p className="mt-1 text-sm text-[color:var(--faint)]">Share the code so the group can join.</p>

          <div className="mt-6 flex items-center gap-2">
            <div className="flex-1 rounded-xl bg-[#1b1b1e] px-4 py-3 text-center font-mono text-2xl tracking-[0.25em] text-[color:var(--ink)]">
              {created.inviteCode}
            </div>
            <button onClick={() => copy(created.inviteCode ?? '', 'code')} className={iconBtn} aria-label="Copy code">
              {copied === 'code' ? <Check size={16} className="text-[color:var(--accent)]" /> : <Copy size={16} />}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate rounded-xl bg-[#1b1b1e] px-4 py-2.5 text-left text-xs text-[color:var(--muted)]">
              {inviteLink}
            </div>
            <button onClick={() => copy(inviteLink, 'link')} className={iconBtn} aria-label="Copy link">
              {copied === 'link' ? <Check size={16} className="text-[color:var(--accent)]" /> : <Copy size={16} />}
            </button>
          </div>

          <button
            onClick={() => {
              const id = created.$id;
              reset();
              onClose();
              window.location.assign(`/trips/${id}`);
            }}
            className={`${primaryBtn} mt-6 w-full justify-center`}
          >
            Go to trip
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-[color:var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Could not create the trip. Try again.';
}

const inputClass =
  'w-full rounded-xl border border-[color:var(--line)] bg-[#1b1b1e] px-4 py-3 text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--faint)] focus:border-[color:var(--accent)]/50 [color-scheme:dark]';
const primaryBtn =
  'inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] px-5 py-2.5 text-sm font-medium text-black hover:shadow-[0_0_28px_rgba(52,211,153,0.3)] disabled:pointer-events-none disabled:opacity-50';
const ghostBtn =
  'rounded-full border border-[color:var(--line-strong)] px-5 py-2.5 text-sm font-medium text-[color:var(--ink)] hover:border-[color:var(--ink)]/40';
const iconBtn =
  'grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[color:var(--line)] text-[color:var(--muted)] hover:text-[color:var(--ink)]';
