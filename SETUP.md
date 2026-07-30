# Setup

This scaffold ships with **placeholder** Appwrite config. To make the apps talk
to a real backend you'll do a few things in the Appwrite and Google consoles,
then fill in the env files. None of this is wired to a live project yet.

## 1. Appwrite project

1. In the [Appwrite Cloud console](https://cloud.appwrite.io), open (or create)
   your project. From **Settings**, copy the **API Endpoint** and **Project ID**.
2. Create a **Database** (the apps default to id `sync_main`). Note its id.
3. Register your **platforms** so the SDKs are allowed to connect:
   - **Web**: add a Web platform with hostname `localhost` (and later your
     deployed domain).
   - **Mobile**: add an **Android** and/or **Apple** platform using the bundle
     id / package name you set in `EXPO_PUBLIC_APP_BUNDLE_ID` (default
     `com.packngo.app`).

## 2. Environment files

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in the values you copied above:

| Web (`apps/web/.env.local`)          | Mobile (`apps/mobile/.env`)             |
| ------------------------------------ | --------------------------------------- |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT`      | `EXPO_PUBLIC_APPWRITE_ENDPOINT`         |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID`    | `EXPO_PUBLIC_APPWRITE_PROJECT_ID`       |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID`   | `EXPO_PUBLIC_APPWRITE_DATABASE_ID`      |
| `APPWRITE_API_KEY` (server-only)     | `EXPO_PUBLIC_APP_BUNDLE_ID`             |

The config resolver in `@sync/shared` throws a clear error at startup if any
required value is missing, so you'll know immediately if something's unset.

**Maps** use MapLibre + OpenFreeMap vector tiles — free, no API key and no
billing account. Nothing to configure; the default style lives in
[`packages/shared/src/maps/config.ts`](./packages/shared/src/maps/config.ts).
To use a different provider later (e.g. MapTiler for different styling), set
`NEXT_PUBLIC_MAP_STYLE_URL` / `EXPO_PUBLIC_MAP_STYLE_URL` to its style URL.

## 3. Google OAuth (needed for Phase 1 — Auth)

1. In the [Google Cloud Console](https://console.cloud.google.com), create an
   **OAuth 2.0 Client** (Web application) under **APIs & Services → Credentials**.
2. In the Appwrite console, go to **Auth → Settings → OAuth2 Providers →
   Google** and paste the client id + secret. Appwrite shows the exact redirect
   URI to authorize back in Google.
3. Redirect targets used by the apps:
   - Web: an app route (e.g. `http://localhost:3000/auth/callback`).
   - Mobile: the `packngo://` scheme (already set in `app.json`) via
     `expo-web-browser` / `expo-auth-session`.

## 4. Collections — ✅ already provisioned

The collection and bucket ids the apps expect are defined once in
[`packages/shared/src/appwrite/ids.ts`](./packages/shared/src/appwrite/ids.ts).
They were created by running:

```bash
pnpm setup:appwrite
```

This is **idempotent** — re-run it any time (after a schema change, or against a
fresh project) and it skips whatever already exists. It needs `APPWRITE_API_KEY`
in `apps/web/.env` with databases/collections/attributes/indexes/buckets
read+write scopes.

## 5. Push notifications (FCM)

Push is **Android-only** for now and requires a **development build** — Expo Go
cannot receive FCM messages.

**a. Firebase**

1. Create a project at the [Firebase console](https://console.firebase.google.com).
2. Add an **Android app** with package name `com.packngo.app` (must match
   `android.package` in `app.json`).
3. Download **`google-services.json`** and save it to `apps/mobile/google-services.json`.
4. In **Project settings → Service accounts**, generate a new **private key**
   (a JSON file) — Appwrite needs this to send on your behalf.

**b. Appwrite**

5. Go to **Messaging → Providers → Add provider → Push → FCM**, upload the
   service-account JSON from step 4, and enable it.
6. Copy the provider's **ID** into `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_APPWRITE_FCM_PROVIDER_ID=<provider id>
   ```
   Until this is set the app runs fine but skips push registration (it logs a
   warning explaining why).

**c. Dispatch function**

7. Build and deploy the notifier — see
   [`functions/notify/README.md`](./functions/notify/README.md) for the exact
   runtime, scopes, and event triggers.

**d. Development build**

8. Push only works in a dev/production build:
   ```bash
   cd apps/mobile && npx expo run:android
   ```
   (or build with EAS). The first launch prompts for notification permission and
   registers this device as an Appwrite push target automatically.

## Verify

```bash
pnpm install
pnpm typecheck                          # all workspaces
pnpm --filter @sync/shared test         # shared-logic unit tests
pnpm --filter @sync/web build           # production web build
pnpm --filter @sync/fn-notify build     # bundle the notification function
```
