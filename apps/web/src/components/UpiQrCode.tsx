'use client';

/**
 * Renders a `upi://pay?...` link as a scannable QR code.
 *
 * Desktop browsers can't open the `upi://` scheme directly, so on web the QR is
 * the primary settle-up affordance: the payer scans it with any UPI app on
 * their phone, which opens pre-filled with the payee, amount, and note.
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function UpiQrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (error) {
    return <p className="text-xs text-red-600 dark:text-red-400">Could not render QR code.</p>;
  }
  if (!dataUrl) {
    return (
      <div
        className="animate-pulse rounded-lg bg-black/5 dark:bg-white/10"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="UPI payment QR code"
      width={size}
      height={size}
      className="rounded-lg bg-white p-2"
    />
  );
}
