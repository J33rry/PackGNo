PackNGo — App Screen Prompts (Login, Dashboard, Create Trip, Join Trip)
These extend the PackNGo landing page prompt and reuse its design system exactly: same fonts, same color tokens, same animation components. Treat packngo-landing-prompt.md as the source of truth for global tokens — don't redefine them per screen, just import/reuse.

SHARED DESIGN SYSTEM (reused across every screen below — do not restate per-prompt, just apply)

- Fonts: Almarai (300/400/700/800) global default; Instrument Serif italic for accent phrases only.
- Colors: bg-black global; #101010 for elevated cards; #212121 for nested/secondary cards; primary text #E1E0CC (inline style) / Tailwind primary #DEDBC8; accent #34D399 (live/success/CTA only); gray-400/gray-500 for secondary text.
- Utilities: reuse .noise-overlay and .bg-noise from index.css.
- Motion: framer-motion throughout — fade-up-from-y20 with ease [0.16, 1, 0.3, 1] is the default entrance for any block of text or card; stagger children at 0.08s (text) or 0.15s (cards).
- Icons: lucide-react only.
- Buttons: primary CTA = bg-primary rounded-full pill, black text, trailing black circle with cream icon, hover gap increase + circle scale-110 + accent glow. Secondary/ghost buttons = border border-primary/20, text-primary, hover border-primary/50.

---

PAGE: LOGIN (/login)

Full h-screen, single centered column — no navbar, no tabs. This is the one screen that should feel quiet rather than cinematic-busy, since its only job is one decision.

Layout:

- p-4 md:p-6 outer padding, inner container rounded-2xl md:rounded-[2rem] overflow-hidden, h-full, bg-black
- Background: a slow, subtle looping video [placeholder — muted overhead footage of a map with pins slowly appearing, very low motion] at 30–40% opacity under a bg-gradient-to-b from-black/60 via-black/80 to-black gradient — the video should read as texture, not content
- .noise-overlay at opacity-[0.5] mix-blend-overlay on top

Centered content (flex items-center justify-center h-full):

- Small kicker label above the wordmark: "Group travel, in sync" — text-primary/70 text-[10px] sm:text-xs, fade-up delay 0
- Wordmark "PackNGo" using the same WordsPullUp component from the landing page, but much smaller here: text-4xl sm:text-5xl md:text-6xl, font-medium, tracking-[-0.03em], color #E1E0CC, with the same pulsing accent live-dot after the final "o"
- One-line subcopy: "Sign in to see your trips." — text-gray-400 text-sm, fade-up delay 0.2s
- Google sign-in button (this is the ONLY sign-in method — do not add email/password fields):
  - White/cream pill button, bg-primary rounded-full px-6 py-3, flex items-center gap-3
  - Google "G" logo icon (use an inline SVG multi-color G mark, not lucide — lucide has no brand icons)
  - Text: "Continue with Google" — text-black font-medium text-sm
  - On click: triggers the Appwrite createOAuth2Session redirect flow
  - Hover: subtle accent-colored glow (shadow), scale-[1.02]
  - Loading state: button content swaps to a small spinning loader (Loader2 icon from lucide-react, animate-spin) with text "Redirecting…", button becomes non-interactive (opacity-70, pointer-events-none)
- Fine print below the button: "By continuing you agree to share your name and photo with your trip members." — text-gray-500 text-[10px] sm:text-xs, max-w-xs text-center, fade-up delay 0.4s

Invite redirect state (when arriving via /login?redirect=/join/<code>):

- Swap the subcopy line for: "Sign in to join the trip." — same styling, no other layout change
- After auth completes, redirect forward automatically — no extra UI needed for this, it's a routing behavior not a visual one

Do NOT include: a footer, additional nav links, marketing copy, or multiple sign-in options. This screen should take under 3 seconds to read.

---

PAGE: DASHBOARD / TRIPS LIBRARY (/trips)

This is the authenticated home screen — every trip the user belongs to, across all their teams. Unlike the landing page and login, this screen has real, denser UI (a header bar and a scrollable grid), so cinematic full-bleed video is dropped in favor of a calm dark background; keep the noise texture for continuity.

Top bar (sticky, not a floating pill like the landing navbar — this is a real app header now):

- Full-width, bg-black/90 backdrop-blur border-b border-white/5, px-4 md:px-8 py-4, flex items-center justify-between
- Left: small "PackNGo" wordmark, text-lg font-medium, color #E1E0CC, no animation (static — this isn't a hero anymore)
- Right: user avatar (circular, initials fallback if no Google photo) + name, text-sm text-primary/80, with a small chevron that opens a dropdown containing "Sign out" (ghost button style)

Page header block (below top bar, px-4 md:px-8 pt-8 pb-6):

- "Your trips" — text-2xl sm:text-3xl font-medium, color #E1E0CC, fade-up on mount
- Row of two actions, right-aligned on desktop / stacked full-width on mobile:
  - Primary CTA "Create a trip" (Plus icon from lucide-react, standard primary pill button)
  - Secondary "Join a trip" (ghost button, opens the Join Trip modal described below)

Trips grid:

- Responsive grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4
- Each trip is a card: bg-[#101010] rounded-2xl p-5, border border-white/5, hover:border-primary/20 transition, cursor-pointer (navigates to /trips/[tripId])
- Card entrance: same stagger pattern as the Features cards on the landing page — scale from 0.95 + fade in, useInView once, 0.08s stagger (faster than the landing page's 0.15s since there may be many cards)
- Card contents, top to bottom:
  - Small category-less thumbnail strip at top: a muted static map preview (or a solid gradient placeholder if no destination coords yet) — h-28 rounded-xl overflow-hidden mb-4, bg-[#212121]
  - Trip name — text-lg font-medium, color #E1E0CC, truncate
  - Destination — text-sm text-gray-400, flex items-center gap-1.5 with a MapPin icon (lucide-react, size 14)
  - Date range (if set) — text-xs text-gray-500, flex items-center gap-1.5 with a Calendar icon; if no dates set, omit this line entirely rather than showing a placeholder
  - Bottom row: place count badge ("12 places" — text-xs text-primary/70 bg-primary/10 rounded-full px-2.5 py-1) + a small "Owner" badge (accent-colored dot + text-[10px] text-accent) shown only if the current user owns the trip

Empty state (no trips yet):

- Centered, py-24, replaces the grid entirely
- Muted illustration or icon (MapPinned from lucide-react, size 48, text-gray-600)
- "No trips yet" — text-lg text-primary/80
- "Create your first trip or join one with an invite code." — text-sm text-gray-500
- Same two CTA buttons as the header, centered

---

MODAL: CREATE TRIP

Triggered from the Dashboard "Create a trip" button. Standard centered modal, not a full page.

Overlay: fixed inset-0 bg-black/70 backdrop-blur-sm, fade-in on mount (framer-motion opacity 0→1)

Modal panel:

- max-w-md w-full, bg-[#101010] rounded-2xl p-6 sm:p-8, border border-white/5
- Entrance: scale from 0.96 + fade in, ease [0.22, 1, 0.36, 1], ~0.25s
- Close button (X icon, lucide-react) top-right, ghost, text-gray-500 hover:text-primary

Header:

- "Create a trip" — text-xl font-medium, color #E1E0CC
- "You'll get a shareable code to invite the group." — text-sm text-gray-500, mt-1

Form fields (stacked, gap-4, mt-6):

- Trip name — required. Label text-xs text-gray-400 mb-1.5, input: bg-[#212121] rounded-xl px-4 py-3 text-sm text-primary placeholder:text-gray-600, border border-white/5 focus:border-primary/40 outline-none
- Destination — required, same input styling, with a MapPin icon (lucide-react) inline on the left of the input
- Dates — optional, two side-by-side date inputs (Start / End) in a grid-cols-2 gap-3, same input styling; label above says "Dates (optional)"
- Emergency number — optional, same input styling, Phone icon (lucide-react) inline left, label "Emergency number (optional)", helper text below in text-[11px] text-gray-600: "Falls back to 112 if left blank."

Footer actions (mt-8, flex justify-end gap-3):

- Ghost "Cancel" button — closes modal, no action
- Primary pill "Create trip" button — on submit, shows a small inline spinner in place of the ArrowRight icon while the trip/team/invite-code are being provisioned; disabled until name + destination are filled

Success state (after creation, replaces the form inside the same modal — do not close and reopen):

- Small accent-colored checkmark in a circle (CheckCircle2 from lucide-react, text-accent), fade-scale in
- "Trip created" — text-lg text-primary
- Invite code shown large and monospace: text-2xl tracking-[0.2em] font-mono text-primary bg-[#212121] rounded-xl px-4 py-3 text-center, with a small "Copy" ghost button (Copy icon) beside it that briefly swaps to a Check icon + "Copied" on click
- Shareable link shown below in a smaller, truncated row with its own copy button
- Primary pill CTA "Go to trip" — closes modal and navigates to the new /trips/[tripId]

---

MODAL: JOIN TRIP

Triggered from the Dashboard "Join a trip" button (or auto-triggered contextually when landing on /join/<code> mid-flow — but in that case skip straight to the loading state below, no form needed).

Same overlay and panel treatment as Create Trip modal (bg-[#101010], rounded-2xl, scale+fade entrance).

Header:

- "Join a trip" — text-xl font-medium, color #E1E0CC
- "Enter the invite code someone shared with you." — text-sm text-gray-500

Form:

- Single large input, centered text, monospace, uppercase-as-typed: text-2xl tracking-[0.3em] font-mono text-center bg-[#212121] rounded-xl px-4 py-4 text-primary placeholder:text-gray-700, placeholder "XXXXXX"
- Helper text below in text-[11px] text-gray-600: "Codes don't use 0, O, 1, I, or L — no need to worry about mixing them up."
- Inline error state (invalid/expired code): input border turns a muted red (border-red-500/50), small text-xs text-red-400 message appears below: "That code doesn't match a trip. Double-check and try again."

Footer:

- Ghost "Cancel" + primary pill "Join trip" (disabled until code length is valid), same spinner-on-submit pattern as Create Trip

Success: brief accent checkmark + "Joined [trip name]" text, auto-redirects to the trip board after ~600ms (no "Go to trip" button needed here since the action is lightweight — don't make the user click twice).

---

NOTES / WHAT'S NOT COVERED YET

This prompt set covers the auth + trip-selection layer. Not written yet, but following the exact same design-system rules above:

- Trip Board shell (/trips/[tripId]) — the tabbed workspace itself (Map · Activities · Expenses · Voting · Members · SOS) and its tab-bar treatment
- Individual tab content prompts (Map + place search, Expenses/settle-up, Voting/polls, Members/roster, SOS panel)

Say the word and I'll write those next in the same format — they'll reuse the shared design-system block above rather than repeating it.
