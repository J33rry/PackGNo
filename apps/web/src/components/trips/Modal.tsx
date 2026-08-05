'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from '@/components/marketing/icons';

/**
 * Centered modal shell used by the Create/Join trip flows. Handles the dim
 * backdrop, entrance animation, Escape-to-close, and body scroll lock.
 */
export function Modal({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ animation: 'pngo-fade-up 0.2s ease both' }}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative w-full max-w-md rounded-3xl border border-[color:var(--line)] bg-[#101012] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.7)] sm:p-8"
        style={{ animation: 'pngo-pull-up 0.28s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[color:var(--faint)] hover:bg-white/5 hover:text-[color:var(--ink)]"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
