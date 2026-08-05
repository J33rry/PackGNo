/**
 * Small inline icon set (stroke-based, 24px grid) used across the redesigned
 * surfaces so we don't pull in an icon dependency. Every icon inherits
 * `currentColor` and accepts a size + className.
 */
type IconProps = { size?: number; className?: string };

function base(size: number, className: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
}

export function ArrowRight({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function Check({ size = 18, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

export function MapPin({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function Wallet({ size = 22, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v1" />
      <path d="M3 7.5V17a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" />
      <path d="M20 10v4h-4a2 2 0 0 1 0-4Z" />
    </svg>
  );
}

export function BarChart({ size = 22, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function Shield({ size = 22, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3 5 6v5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </svg>
  );
}

export function Plus({ size = 18, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Calendar({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function Phone({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 5c0 8.3 6.7 15 15 15a1.5 1.5 0 0 0 1.5-1.5v-2.6a1 1 0 0 0-.8-1l-3-.6a1 1 0 0 0-1 .4l-.8 1.1a12 12 0 0 1-5.4-5.4l1.1-.8a1 1 0 0 0 .4-1l-.6-3a1 1 0 0 0-1-.8H5.5A1.5 1.5 0 0 0 4 5Z" />
    </svg>
  );
}

export function Copy({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

export function X({ size = 18, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

export function CheckCircle({ size = 40, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.4 2.4L16 9" />
    </svg>
  );
}

export function ChevronDown({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function MapPinned({ size = 48, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 18.5S18 13 18 8.5a6 6 0 0 0-12 0C6 13 12 18.5 12 18.5Z" />
      <circle cx="12" cy="8.5" r="2" />
      <path d="M5 18.5c-1.8.5-3 1.3-3 2.2C2 22 6.5 23 12 23s10-1 10-2.3c0-.9-1.2-1.7-3-2.2" />
    </svg>
  );
}

export function Compass({ size = 18, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </svg>
  );
}

export function Users({ size = 18, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
      <path d="M17 14.2a5.5 5.5 0 0 1 3.5 4.8" />
    </svg>
  );
}

export function LifeBuoy({ size = 18, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m5 5 3.4 3.4M15.6 15.6 19 19M19 5l-3.4 3.4M8.4 15.6 5 19" />
    </svg>
  );
}

export function Locate({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function Search({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function GoogleG({ size = 18, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
