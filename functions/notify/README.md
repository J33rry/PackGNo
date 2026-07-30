# `notify` — push notification dispatcher

An Appwrite Function that turns document events into push notifications,
delivered via Appwrite Messaging → FCM.

| Trigger collection | Notification | Who gets it |
| ------------------ | ------------ | ----------- |
| `sos_events`   | 🚨 Emergency alert   | Everyone on the trip except the sender |
| `expenses`     | New expense added    | Everyone except the payer |
| `settlements`  | Settle-up request    | Only the person being asked (`toUserId`) |
| `polls`        | New poll to vote on  | Everyone except the creator |
| `trip_members` | Someone joined       | Everyone except the new member |

Wording lives in `@sync/shared`'s `buildNotification`, so the copy is shared
and unit-tested rather than duplicated here.

## Build

The source imports `@sync/shared`, so it's bundled into a single file first:

```bash
pnpm --filter @sync/fn-notify build
```

That produces `main.js` (~6 KB) with the shared logic inlined and
`node-appwrite` left external (installed at deploy time from `package.json`).

## Deploy

Create the function in the Appwrite console (or via the CLI) with:

- **Runtime**: Node 18+
- **Entrypoint**: `main.js`
- **Build command**: `npm install`
- **Scopes**: `databases.read`, `documents.read`, `teams.read`, `users.read`,
  `messages.write`
- **Environment variable**: `APPWRITE_DATABASE_ID` = your database id
  (the endpoint, project id, and a dynamic API key are injected by Appwrite)
- **Events**:
  ```
  databases.*.collections.sos_events.documents.*.create
  databases.*.collections.expenses.documents.*.create
  databases.*.collections.settlements.documents.*.create
  databases.*.collections.polls.documents.*.create
  databases.*.collections.trip_members.documents.*.create
  ```

Using the CLI from this directory:

```bash
appwrite push function
```

## Behaviour notes

- Unrecognised events are ignored (returns `skipped: unhandled-event`), so it's
  safe to attach broader event patterns than listed above.
- A missing `tripId` returns 400 rather than throwing, keeping one bad document
  from failing the whole execution.
- Recipient lookup uses the trip's Appwrite **Team** membership, which is the
  same thing that grants document access — so notifications can never reach
  someone who couldn't already read the data.
