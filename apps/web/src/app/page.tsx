import Link from 'next/link';
import { NightMap } from '@/components/marketing/NightMap';
import { PullWords } from '@/components/marketing/PullWords';
import { Reveal } from '@/components/marketing/Reveal';
import { ScrollRevealText } from '@/components/marketing/ScrollRevealText';
import { ArrowRight, BarChart, Check, Shield, Wallet } from '@/components/marketing/icons';

const navItems = [
  { label: 'How it works', href: '#about' },
  { label: 'Map', href: '#features' },
  { label: 'Expenses', href: '#features' },
  { label: 'Voting', href: '#features' },
];

const featureCards = [
  {
    n: '01',
    title: 'Split expenses',
    icon: Wallet,
    items: [
      'Equal, exact, or percentage splits',
      'Balances computed live, no rounding drift',
      'Settle up with a UPI QR code',
    ],
  },
  {
    n: '02',
    title: 'Vote as a group',
    icon: BarChart,
    items: [
      'One vote each, change it anytime',
      'Live tallies with result bars',
      'Leaders and ties shown instantly',
    ],
  },
  {
    n: '03',
    title: 'Stay safe',
    icon: Shield,
    items: [
      'One-tap SOS with your last location',
      "Dials the trip's emergency number",
      'Any member can mark you safe',
    ],
  },
];

export default function Home() {
  return (
    <main className="bg-black text-[color:var(--ink)]">
      {/* ---------------- HERO ---------------- */}
      <section className="p-3 sm:p-5">
        <div className="relative h-[92vh] min-h-[560px] overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem]">
          <div className="absolute inset-0">
            <NightMap variant="hero" />
          </div>
          <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.5] mix-blend-overlay" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

          {/* nav pill */}
          <nav className="absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-b-2xl bg-black/85 px-4 py-2.5 backdrop-blur-md sm:px-8 md:rounded-b-3xl">
            <ul className="flex items-center gap-4 text-[11px] sm:gap-7 sm:text-xs md:gap-11 md:text-sm">
              {navItems.map((item) => (
                <li key={item.label} className="hidden sm:block">
                  <a
                    href={item.href}
                    className="text-[color:var(--ink)]/70 transition-colors hover:text-[color:var(--ink)]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  className="text-[color:var(--ink)]/70 transition-colors hover:text-[color:var(--ink)]"
                >
                  Sign in
                </Link>
              </li>
            </ul>
          </nav>

          {/* hero content */}
          <div className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-1 gap-6 p-6 sm:p-9 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <h1 className="display flex items-start text-[17vw] leading-[0.82] text-[color:var(--ink)] sm:text-[14vw] lg:text-[10.5vw] xl:text-[9.5vw]">
                <PullWords text="PackNGo" />
                <span
                  className="live-dot ml-[0.12em] mt-[0.22em] h-[0.13em] w-[0.13em] shrink-0"
                  aria-hidden="true"
                />
              </h1>
            </div>
            <div className="fade-up lg:col-span-4" style={{ ['--d' as string]: '0.5s' }}>
              <p className="max-w-md text-sm leading-relaxed text-[color:var(--ink)]/70 sm:text-base">
                One shared, realtime board for the whole trip — map, expenses, voting, live
                location, and SOS, updating instantly for everyone.
              </p>
              <Link
                href="/login"
                className="group mt-6 inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] py-1.5 pl-6 pr-1.5 text-sm font-medium text-black hover:gap-3 hover:shadow-[0_0_36px_rgba(52,211,153,0.35)] sm:text-base"
              >
                Start a trip
                <span className="grid h-10 w-10 place-items-center rounded-full bg-black text-[color:var(--ink)] transition-transform group-hover:scale-110">
                  <ArrowRight size={18} />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- ABOUT ---------------- */}
      <section id="about" className="px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[color:var(--line)] bg-[#0f0f11] px-6 py-16 text-center sm:px-12 sm:py-24">
          <Reveal>
            <div className="eyebrow">Group travel, in sync</div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mx-auto mt-6 max-w-3xl text-3xl leading-[0.98] sm:text-5xl lg:text-6xl">
              <span className="display">One board, </span>
              <span className="serif-accent text-[color:var(--ink)]">everyone in sync.</span>
              <span className="display"> Map, money, votes, and safety — live for the whole group.</span>
            </h2>
          </Reveal>
          <ScrollRevealText
            className="mx-auto mt-10 max-w-2xl text-base leading-relaxed text-[color:var(--ink)] sm:text-lg"
            text="Every check-in, expense, vote, and pin lands on the same live board, computed in real time with no refresh and no drift — so a trip planned by six people never falls out of sync."
          />
        </div>
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section id="features" className="relative overflow-hidden px-4 pb-24">
        <div className="bg-noise pointer-events-none absolute inset-0 opacity-[0.12]" />
        <div className="relative mx-auto max-w-6xl">
          <Reveal>
            <h2 className="max-w-2xl text-2xl leading-tight sm:text-3xl lg:text-4xl">
              <span className="display">Everything the group needs, on one board. </span>
              <span className="text-[color:var(--muted)]">Live. Shared. Zero refresh.</span>
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 lg:grid-cols-4 lg:grid-rows-1">
            {/* live map card */}
            <Reveal className="lg:col-span-1">
              <div className="relative h-full min-h-[300px] overflow-hidden rounded-[1.5rem] border border-[color:var(--line)]">
                <NightMap variant="card" />
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur">
                  <span className="live-dot h-2 w-2" aria-hidden="true" />
                  <span className="text-xs font-medium text-[color:var(--ink)]">Live</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5">
                  <p className="text-lg font-medium text-[color:var(--ink)]">Your trip, on the map.</p>
                </div>
              </div>
            </Reveal>

            {featureCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <Reveal key={card.n} delay={0.08 * (i + 1)} className="lg:col-span-1">
                  <article className="flex h-full flex-col rounded-[1.5rem] border border-[color:var(--line)] bg-[#1a1a1d] p-6">
                    <div className="flex items-center justify-between">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--accent)]/12 text-[color:var(--accent)]">
                        <Icon />
                      </span>
                      <span className="data-label text-[color:var(--faint)]">{card.n}</span>
                    </div>
                    <h3 className="mt-5 text-xl font-bold text-[color:var(--ink)]">{card.title}</h3>
                    <ul className="mt-4 space-y-3">
                      {card.items.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-[color:var(--muted)]">
                          <Check size={16} className="mt-0.5 shrink-0 text-[color:var(--accent)]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              );
            })}
          </div>

          {/* closing CTA */}
          <Reveal delay={0.1}>
            <div className="mt-16 flex flex-col items-center gap-6 rounded-[1.75rem] border border-[color:var(--line)] bg-[#0f0f11] px-6 py-14 text-center">
              <h3 className="display max-w-xl text-3xl leading-tight sm:text-4xl">
                Get the group moving together.
              </h3>
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] py-1.5 pl-6 pr-1.5 text-base font-medium text-black hover:gap-3 hover:shadow-[0_0_36px_rgba(52,211,153,0.35)]"
              >
                Start a trip
                <span className="grid h-10 w-10 place-items-center rounded-full bg-black text-[color:var(--ink)] transition-transform group-hover:scale-110">
                  <ArrowRight size={18} />
                </span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[color:var(--line)] px-6 py-8 text-center text-xs text-[color:var(--faint)]">
        PackNGo — one live board for the whole trip.
      </footer>
    </main>
  );
}
