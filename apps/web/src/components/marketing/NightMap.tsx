/**
 * The product's signature illustration: a dark, stylised live map. A faint road
 * network sits under a glowing accent route that draws itself in, with member
 * pins that "ping" like a fresh live-location update. Pure SVG + CSS keyframes
 * (see globals.css), so it renders on the server and animates with no JS.
 *
 * `variant="hero"` is the large cinematic version; `variant="card"` is a compact
 * version for the Features grid.
 */
export function NightMap({ variant = 'hero' }: { variant?: 'hero' | 'card' }) {
  const pins =
    variant === 'hero'
      ? [
          { x: 150, y: 150, delay: 0.4, live: true },
          { x: 470, y: 110, delay: 1.1, live: false },
          { x: 640, y: 300, delay: 1.8, live: true },
          { x: 300, y: 360, delay: 2.4, live: false },
        ]
      : [
          { x: 120, y: 90, delay: 0.3, live: true },
          { x: 360, y: 210, delay: 1.2, live: false },
        ];

  return (
    <svg
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      role="img"
      aria-label="A live map with the group's route and member pins"
    >
      <defs>
        <radialGradient id="pngo-glow" cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor="#0e1512" />
          <stop offset="55%" stopColor="#0a0a0b" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>
        <linearGradient id="pngo-route" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <filter id="pngo-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width="800" height="500" fill="url(#pngo-glow)" />

      {/* map grid */}
      <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="500" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 100} x2="800" y2={i * 100} />
        ))}
      </g>

      {/* faint road network */}
      <g stroke="rgba(225,224,204,0.09)" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M-20 340 C 160 300, 240 380, 420 320 S 720 300, 840 360" />
        <path d="M120 -20 C 160 140, 300 180, 340 340 S 420 520, 460 540" />
        <path d="M-20 120 C 200 140, 360 60, 560 120 S 760 180, 840 140" />
        <path d="M640 -20 C 620 160, 700 260, 640 320 S 560 460, 600 540" />
      </g>

      {/* glowing route that draws itself */}
      <g fill="none" strokeLinecap="round">
        <path
          d="M150 150 C 280 90, 380 140, 470 110 S 620 240, 640 300 S 420 340, 300 360"
          stroke="url(#pngo-route)"
          strokeWidth="10"
          opacity="0.25"
          filter="url(#pngo-soft)"
          style={{ strokeDasharray: 1400, strokeDashoffset: 1400, animation: 'pngo-draw 3s ease 0.3s forwards' }}
        />
        <path
          d="M150 150 C 280 90, 380 140, 470 110 S 620 240, 640 300 S 420 340, 300 360"
          stroke="url(#pngo-route)"
          strokeWidth="3"
          style={{ strokeDasharray: 1400, strokeDashoffset: 1400, animation: 'pngo-draw 3s ease 0.3s forwards' }}
        />
      </g>

      {/* pins */}
      {pins.map((p, i) => (
        <g key={i}>
          {p.live && (
            <circle
              cx={p.x}
              cy={p.y}
              r="9"
              fill="#34d399"
              style={{ transformOrigin: `${p.x}px ${p.y}px`, animation: `pngo-ping 2.6s cubic-bezier(0,0,0.2,1) ${p.delay}s infinite` }}
            />
          )}
          <circle cx={p.x} cy={p.y} r="18" fill="#34d399" opacity="0.14" />
          <path
            d={`M${p.x} ${p.y - 16} c -7 0 -12 5 -12 12 c 0 8 12 20 12 20 s 12 -12 12 -20 c 0 -7 -5 -12 -12 -12 z`}
            fill={p.live ? '#34d399' : '#e1e0cc'}
            opacity={p.live ? 1 : 0.85}
          />
          <circle cx={p.x} cy={p.y - 4} r="4" fill="#0a0a0b" />
        </g>
      ))}
    </svg>
  );
}
