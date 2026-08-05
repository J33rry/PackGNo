# PackNGo — group travel companion

Plan and run group trips together: a shared map of points of interest, live
opt-in location sharing, Splitwise-style expense splitting with UPI settle-up
links, activity voting, offline support, and an SOS/emergency feature.

Backed by **Appwrite Cloud**. Web is **Next.js**, mobile is **Expo / React
Native**, and cross-platform logic lives in a shared package.

## Monorepo layout

```
sync/
├── apps/
│   ├── web/        @sync/web       — Next.js (App Router, Tailwind v4)
│   └── mobile/     @sync/mobile    — Expo (expo-router, React Native)
├── functions/
│   └── notify/     @sync/fn-notify — Appwrite Function: push notifications
└── packages/
    └── shared/     @sync/shared    — types, Appwrite config/ids, pure logic
                                      (balances, UPI, SOS, notification copy)
```

Tooling: **pnpm workspaces** + **Turborepo**. `@sync/shared` ships raw
TypeScript that each app transpiles (Next via `transpilePackages`, Expo via
Metro), so there's no build step for shared code.

## Getting started

```bash
pnpm install
```

Then copy the env examples and fill in your Appwrite values (see [SETUP.md](./SETUP.md)):

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Run everything, or one app:

```bash
pnpm dev            # web + mobile in parallel (Turborepo)
pnpm dev:web        # Next.js only  → http://localhost:3000
pnpm dev:mobile     # Expo only     → scan the QR with Expo Go
```

## Scripts (root)

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `pnpm dev`        | Run all apps in dev (parallel)                |
| `pnpm build`      | Build all apps                                |
| `pnpm lint`       | Lint all workspaces                           |
| `pnpm typecheck`  | Type-check all workspaces                     |
| `pnpm --filter @sync/shared test` | Run shared-logic unit tests   |

## Status

**Phases 0 and 1 are built**, and the Appwrite backend is **live** — all 12
collections, their indexes, and 4 storage buckets are provisioned (re-runnable
via `pnpm setup:appwrite`).

Remaining before you can sign in and receive pushes end-to-end: enable **Google
OAuth** in the Appwrite console, and complete the **Firebase/FCM** steps — both
in [SETUP.md](./SETUP.md).

> **Upgrading an existing project?** The trip-invite feature adds an `inviteCode`
> attribute + unique index to the `trips` collection. Re-run `pnpm setup:appwrite`
> (it's idempotent) to provision them, and set `APPWRITE_API_KEY` (scopes:
> `teams.read`, `teams.write`, `databases.read`) — the server routes use it both
> to add invitees to a trip's Team and to build the member roster, since the
> browser can't read other members' identities from a Team.

## Roadmap

0. ✅ **Scaffold** — monorepo, apps, shared package, Appwrite client wiring.
1. ✅ **Auth + Trips** — Google OAuth, profile sync, trips backed by Appwrite Teams.
   ✅ **Invites** (web) — shareable `/join/<code>` link + manual invite-code entry; joining adds the user to the trip's Team via a server route (needs `APPWRITE_API_KEY`).
   ✅ **Push notifications** — FCM via Appwrite Messaging, dispatched by `functions/notify`.
2. ✅ **Map + POIs** — MapLibre + OpenFreeMap tiles (free, no key) on both platforms, realtime POI updates.
3. ✅ **Expenses + UPI** (web) — expense splitting, live balances, UPI settle-up links + QR.
4. ✅ **Voting** (web) — polls with realtime, one-vote-per-member tallies (`tallyPollResults` in `@sync/shared`).
5. ✅ **Live location** (web) — foreground opt-in sharing, live member pins on the map.
6. **Offline sync (mobile)** — SQLite cache + mutation outbox.
7. ✅ **SOS** (web) — emergency dial (`tel:`) + realtime group alert with location, resolvable by any member.
