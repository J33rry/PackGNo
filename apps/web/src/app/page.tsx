import Link from 'next/link';

const features = [
  {
    title: 'Shared map',
    body: 'Drop points of interest and see them update live for everyone on the trip.',
  },
  {
    title: 'Split expenses',
    body: 'Track who paid for what, see who owes whom, and settle up with a UPI link.',
  },
  {
    title: 'Vote on plans',
    body: 'Propose activities and let the group vote — decisions without the group-chat chaos.',
  },
  {
    title: 'Live location',
    body: 'Opt in to share your location with the group so nobody gets lost.',
  },
  {
    title: 'Works offline',
    body: 'View trip details and queue changes even with no signal; syncs when you reconnect.',
  },
  {
    title: 'SOS',
    body: 'One tap to call for help and alert the group with your last known location.',
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
      <section className="flex flex-col items-start gap-6">
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-foreground/60 dark:border-white/15">
          Group travel, in sync
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Plan and run trips with your group — without the chaos.
        </h1>
        <p className="max-w-2xl text-lg text-foreground/70">
          PackNGo brings the map, the money, the plans, and everyone&apos;s location into one place.
          Built for the messy middle of a group trip.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
          <a
            href="#features"
            className="rounded-lg border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            See features
          </a>
        </div>
      </section>

      <section id="features" className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-black/10 p-5 dark:border-white/10"
          >
            <h2 className="text-base font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-foreground/70">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
