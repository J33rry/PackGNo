import Link from 'next/link';

const features = [
  {
    title: 'Map as command center',
    body: 'Search, tap, or drop a pin, then turn that moment into a saved place, check-in, or trip activity.',
  },
  {
    title: 'Money without side spreadsheets',
    body: 'Split shared costs live, see balances update instantly, and settle with UPI when the day is done.',
  },
  {
    title: 'Shared trip memory',
    body: 'Capture where the group actually went, what happened there, and what still needs a decision.',
  },
];

export default function Home() {
  return (
    <main className="shell flex min-h-screen flex-col px-4 py-4 sm:px-6">
      <section className="glass relative overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10">
        <div className="absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_top,rgba(15,141,168,0.18),transparent_42%),radial-gradient(circle_at_bottom,rgba(245,106,73,0.22),transparent_32%)] lg:block" />
        <nav className="relative z-10 flex items-center justify-between">
          <div>
            <div className="eyebrow">PackNGo</div>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Group travel, operationally calm.</p>
          </div>
          <Link
            href="/login"
            className="rounded-full border border-[color:var(--line-strong)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] hover:-translate-y-0.5 hover:bg-white"
          >
            Get started
          </Link>
        </nav>

        <div className="relative z-10 mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="max-w-3xl">
            <div className="eyebrow">Trip workspace for the messy middle</div>
            <h1 className="display mt-4 text-[clamp(3.5rem,9vw,6.75rem)] leading-[0.92] text-[color:var(--ink)]">
              Maps, money, and memory in one board.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[color:var(--muted)]">
              PackNGo is built for the stretch between booking and coming home: where plans drift,
              costs stack up, and nobody remembers which cafe was the good one.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-[color:var(--paper)] hover:-translate-y-0.5"
              >
                Open the workspace
              </Link>
              <Link
                href="/trips"
                className="rounded-full border border-[color:var(--line-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--panel-strong)]"
              >
                See trip board
              </Link>
            </div>
          </div>

          <div className="grid gap-4 self-end">
            <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-5">
              <div className="data-label">Today inside one trip</div>
              <div className="mt-4 grid gap-4">
                <div className="flex items-center justify-between rounded-[1.2rem] bg-white/80 px-4 py-3">
                  <span className="text-sm text-[color:var(--muted)]">Places saved</span>
                  <span className="display text-3xl text-[color:var(--ink)]">18</span>
                </div>
                <div className="flex items-center justify-between rounded-[1.2rem] bg-white/80 px-4 py-3">
                  <span className="text-sm text-[color:var(--muted)]">Open balances</span>
                  <span className="display text-3xl text-[color:var(--ink)]">3</span>
                </div>
                <div className="flex items-center justify-between rounded-[1.2rem] bg-white/80 px-4 py-3">
                  <span className="text-sm text-[color:var(--muted)]">Activity notes</span>
                  <span className="display text-3xl text-[color:var(--ink)]">7</span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-[linear-gradient(135deg,rgba(15,141,168,0.92),rgba(23,50,77,0.96))] p-5 text-[color:var(--paper)]">
              <div className="data-label text-white/70">Why it feels different</div>
              <p className="mt-3 text-base leading-7 text-white/86">
                Search for a place, save it, check in there, write the story, split the bill, move
                on. One flow, not six tabs from six apps.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="grid gap-4 px-1 py-8 lg:grid-cols-3">
        {features.map((f) => (
          <article key={f.title} className="glass rounded-[1.75rem] px-5 py-6">
            <div className="eyebrow">{f.title}</div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">{f.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
