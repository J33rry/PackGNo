Create a React + Vite + TypeScript + Tailwind CSS landing page for a group-travel app called "PackNGo". The page has 3 sections: Hero, About, and Features. Use framer-motion for animations and lucide-react for icons. The design is dark, moody, and cinematic — but instead of the warm cream of a film-studio site, lean into a "night-map" palette: near-black backgrounds with a warm cream/off-white primary text color and a single accent color pulled from a map-pin/live-location motif.

FONTS

Load two Google Fonts in index.html:

Almarai (weights: 300, 400, 700, 800) — used as the global default font
Instrument Serif (italic only) — used for italic accent text in the About section
In index.css, set the global font family:

```
* { font-family: 'Almarai', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; }
```

In tailwind.config.js, extend:

- colors.primary: #DEDBC8 (warm cream, used for all primary text and accents)
- colors.accent: #34D399 (live/online green — echoes the "fresh ping" live-location signal in the product; used sparingly for CTAs and status dots)
- fontFamily.serif: ['"Instrument Serif"', 'serif']

COLOR SYSTEM

- Background: black (#000000) globally, #101010 for the About card, #212121 for Features cards
- Primary text color: #E1E0CC (applied via inline style, slightly different from Tailwind primary)
- Tailwind primary: #DEDBC8 (used for utility classes like text-primary, text-primary/70)
- Accent (live/action color): #34D399, used only for the CTA button glow, the "who's live" status dot in the Features map card, and hover states — never as a large fill
- Gray text: text-gray-400, text-gray-500
- Navbar link color: rgba(225, 224, 204, 0.8) with hover: #E1E0CC

CUSTOM CSS UTILITIES (index.css)

Two SVG noise texture utilities:

- .noise-overlay: fractal noise (baseFrequency: 0.85, numOctaves: 3) used as overlay on hero video
- .bg-noise: fractal noise (baseFrequency: 0.9, numOctaves: 4) used as subtle background in Features section

Both use inline SVG data URIs with feTurbulence filter.

SECTION 1: HERO

Full viewport height (h-screen). The entire section has p-4 md:p-6 padding creating an inset effect. Inside is a container with rounded-2xl md:rounded-[2rem] and overflow-hidden.

Background video:

- URL: [placeholder — replace with a looping clip of a shared trip: a phone/map view with pins dropping in, or overhead travel footage]
- autoPlay loop muted playsInline, object-cover, fills entire container
- Noise overlay on top: .noise-overlay with opacity-[0.7] mix-blend-overlay pointer-events-none
- Gradient overlay: bg-gradient-to-b from-black/30 via-transparent to-black/60

Navbar:

- Absolutely positioned at top center
- Black background pill that hangs from top edge: bg-black rounded-b-2xl md:rounded-b-3xl px-4 py-2 md:px-8
- 5 nav items: "How it works", "Map", "Expenses", "Voting", "Sign in"
- Text size: text-[10px] sm:text-xs md:text-sm
- Gap between items: gap-3 sm:gap-6 md:gap-12 lg:gap-14
- Link color: rgba(225, 224, 204, 0.8), hover: #E1E0CC (inline styles)

Hero Content (bottom-aligned):

- Absolutely positioned at bottom: absolute bottom-0 left-0 right-0
- 12-column grid: left 8 columns for heading, right 4 columns for text + button
- Giant heading "PackNGo" using WordsPullUp component:
  - Responsive sizes: text-[16vw] sm:text-[14vw] md:text-[12vw] lg:text-[10vw] xl:text-[9vw] 2xl:text-[9.5vw] (smaller than Prisma's since "PackNGo" is a longer word)
  - font-medium leading-[0.85] tracking-[-0.05em]
  - Color: #E1E0CC
  - Has a small live status dot (not an asterisk) after the final "o" of "Go": a pulsing accent-colored circle, positioned absolute top-[0.35em] -right-[0.5em] w-[0.12em] h-[0.12em] rounded-full bg-accent, with a framer-motion opacity pulse (0.4 → 1 → 0.4 loop) — echoes the "fresh ping = live" idea from the product
  - Pull-up animation: each word slides up from y:20 with staggered delay of 0.08s, triggered by useInView
- Description paragraph (right column):
  - "PackNGo is one shared, realtime board for the whole trip — map, expenses, voting, live location, and emergencies, updating instantly across everyone on the team."
  - text-primary/70 text-xs sm:text-sm md:text-base, line-height: 1.2
  - Framer motion: fade up from y:20, delay 0.5s, custom ease [0.16, 1, 0.3, 1]
- CTA Button "Start a trip":
  - Pill shape: bg-primary rounded-full
  - Black text, font-medium, text-sm sm:text-base
  - Right side has a black circle (bg-black rounded-full w-9 h-9 sm:w-10 sm:h-10) containing a cream ArrowRight icon
  - Hover: gap increases (hover:gap-3), circle scales up (group-hover:scale-110), subtle accent-colored glow (shadow) appears
  - Framer motion: fade up from y:20, delay 0.7s, same custom ease

SECTION 2: ABOUT

bg-black, padded section with centered content
Inner card: bg-[#101010], centered text, max-w-6xl

- Top: small label "Group travel, in sync" in text-primary, text-[10px] sm:text-xs
- Main heading uses WordsPullUpMultiStyle component with 3 segments:
  - "One board," — font-normal (Almarai)
  - "everyone in sync." — italic font-serif (Instrument Serif italic)
  - "Map, money, votes, and safety — realtime for the whole group." — font-normal
  - Container: text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl max-w-3xl mx-auto leading-[0.95] sm:leading-[0.9]
  - Each word animates in with pull-up effect (y:20 to y:0), staggered at 0.08s delay
- Body paragraph below with scroll-linked character opacity animation:
  - Text: "Every check-in, expense, vote, and pin drops onto the same live board, computed in real time with no refresh and no drift — so a trip planned by six people never falls out of sync."
  - text-[#DEDBC8], text-xs sm:text-sm md:text-base
  - Each character is individually wrapped in an AnimatedLetter component
  - Uses useScroll with target offset ['start 0.8', 'end 0.2']
  - Each character's opacity transitions from 0.2 to 1 based on scroll position, creating a progressive text reveal effect
  - Character staggering: charProgress = index / totalChars, range [charProgress - 0.1, charProgress + 0.05]

SECTION 3: FEATURES

min-h-screen bg-black, with subtle .bg-noise overlay at opacity-[0.15]

Header text uses WordsPullUpMultiStyle:

- Line 1: "Everything the group needs, on one board." in cream
- Line 2: "Live. Shared. Zero refresh." in text-gray-500
- Both: text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal

4-column card grid (lg:h-[480px], gap-3 sm:gap-2 md:gap-1):

Each card has staggered entrance animation: scale from 0.95 + fade in, triggered by useInView (once, margin "-100px"), staggered at 0.15s intervals with ease [0.22, 1, 0.36, 1].

- Card 1 — Video card: Full video background [placeholder — replace with footage of the live map, pins and person-markers moving], autoPlay loop muted playsInline, object-cover. Small pulsing accent dot in the corner labeled "Live" (echoing the "who's live" presence indicator). Bottom text: "Your trip, on the map." in #E1E0CC.

- Card 2 — "Split Expenses." (01): bg-[#212121], small icon at top (wallet/receipt icon, 10x10 sm:12x12 rounded), title with number, 4 checklist items with green Check icons: "Equal, exact, or percentage splits", "Balances computed live, zero rounding drift", "UPI QR settle-up", "Record and confirm settlements". "Learn more" link with rotated arrow (-45deg).

- Card 3 — "Vote as a Group." (02): Same layout as Card 2. Icon: poll/checkmark icon. 3 checklist items: "One vote per member, change anytime", "Live tallies with result bars", "Ties and leaders shown instantly".

- Card 4 — "Stay Safe." (03): Same layout. Icon: alert/shield icon. 3 checklist items: "One-tap SOS with your last-known location", "Dials the trip's emergency number instantly", "Any member can mark you safe".

All feature card checklist items use Check icon from lucide-react in text-primary color, with text-gray-400 description text. "Learn more" buttons use ArrowRight rotated -45deg.

SHARED ANIMATION COMPONENTS

WordsPullUp: Splits text by spaces, each word is a motion.span that slides up (y:20 to 0) with staggered delay. Uses useInView (once: true). Supports a showLiveDot prop (replaces Prisma's showAsterisk) that adds a small pulsing accent-colored dot after the last character of the final word.

WordsPullUpMultiStyle: Takes an array of {text, className} segments, splits all into individual words preserving per-word className. Same pull-up animation. Words are wrapped in inline-flex flex-wrap justify-center.

RESPONSIVE BREAKPOINTS

The page is fully responsive across mobile, tablet, and desktop. Cards in Features switch from 1-col (mobile) to 2-col (md) to 4-col (lg). Hero text scales from 16vw down to 9vw. Navbar items compress with smaller gaps on mobile. All padding, font sizes, and spacing use Tailwind responsive prefixes (sm/md/lg/xl/2xl).

TECH STACK

- Vite + React 18 + TypeScript
- Tailwind CSS 3
- framer-motion (for all animations: pull-up text, fade-in, scroll-linked opacity, card entrances, live-dot pulse)
- lucide-react (ArrowRight, Check, plus a wallet/receipt icon, a poll icon, and a shield/alert icon for the Features cards)

NOTES ON WHAT CHANGED FROM THE TEMPLATE

- Swapped "creative studio" copy for PackNGo's actual pitch (realtime shared trip board).
- Replaced the single decorative asterisk with a pulsing "live" dot — ties the hero visually to the product's real live-location/presence feature instead of being purely decorative.
- Added a thin accent color (#34D399) used only for live/status/CTA moments, since the product's core hook is realtime sync — the original template was monochrome cream/black with no status color.
- Features cards now map 1:1 to real PackNGo capabilities (map, expenses, voting, SOS) instead of generic studio services — copy and icons should be swapped accordingly if you build further cards for Activities or Check-ins.
- Video/image URLs are left as placeholders since they were creative-studio-specific stock footage; swap in real product screen recordings or map/travel b-roll.
