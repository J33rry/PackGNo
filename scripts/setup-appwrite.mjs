/**
 * Idempotent Appwrite provisioning for PackNGo.
 *
 * Creates every collection, attribute, index, and storage bucket the app
 * expects, with a permission model built around Appwrite Teams:
 *   - Collections enable document-level security. Collection-level permissions
 *     only grant "create" to any authenticated user; the app stamps each new
 *     document with team-scoped read/update/delete (Role.team(trip.teamId)).
 *   - `profiles` additionally allows any authenticated user to read (so names /
 *     avatars show up across the app).
 *
 * Re-running is safe: anything that already exists is skipped (409 conflicts).
 *
 * Config is read from apps/web/.env (endpoint, project, database, API key).
 * Run with:  pnpm setup:appwrite
 *
 * NOTE: collection/bucket ids here mirror packages/shared/src/appwrite/ids.ts —
 * keep them in sync if you rename anything there.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
// node-appwrite v27 renamed the index-type enum to DatabasesIndexType.
import {
  Client,
  Databases,
  Storage,
  Permission,
  Role,
  DatabasesIndexType as IndexType,
} from 'node-appwrite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Load web app env (has endpoint, project, database id, and the server API key).
dotenv.config({ path: path.join(repoRoot, 'apps/web/.env') });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;

function requireEnv(name, value) {
  if (!value) {
    console.error(`\n✗ Missing ${name} in apps/web/.env — cannot provision.\n`);
    process.exit(1);
  }
}
requireEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', endpoint);
requireEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID', projectId);
requireEnv('NEXT_PUBLIC_APPWRITE_DATABASE_ID', databaseId);
requireEnv('APPWRITE_API_KEY', apiKey);

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

// --- helpers -------------------------------------------------------------

const S = (key, size, required, def) => ({ type: 'string', key, size, required, def });
const F = (key, required, def) => ({ type: 'float', key, required, def });
const B = (key, required, def) => ({ type: 'boolean', key, required, def });
const D = (key, required, def) => ({ type: 'datetime', key, required, def });
const E = (key, elements, required, def) => ({ type: 'enum', key, elements, required, def });

const KEY = (key, attributes) => ({ key, type: IndexType.Key, attributes });
const UNIQUE = (key, attributes) => ({ key, type: IndexType.Unique, attributes });

/** True when an error means "this already exists" — safe to skip. */
function isConflict(err) {
  return err?.code === 409 || /already exists/i.test(err?.message ?? '');
}

async function safe(label, fn) {
  try {
    await fn();
    console.log(`  + ${label}`);
  } catch (err) {
    if (isConflict(err)) {
      console.log(`  = ${label} (exists)`);
    } else {
      console.error(`  ✗ ${label}: ${err?.message ?? err}`);
      throw err;
    }
  }
}

async function createAttribute(colId, a) {
  const label = `${a.type} ${a.key}`;
  await safe(label, async () => {
    switch (a.type) {
      case 'string':
        return databases.createStringAttribute(databaseId, colId, a.key, a.size, a.required, a.def);
      case 'float':
        return databases.createFloatAttribute(
          databaseId, colId, a.key, a.required, undefined, undefined, a.def,
        );
      case 'boolean':
        return databases.createBooleanAttribute(databaseId, colId, a.key, a.required, a.def);
      case 'datetime':
        return databases.createDatetimeAttribute(databaseId, colId, a.key, a.required, a.def);
      case 'enum':
        return databases.createEnumAttribute(
          databaseId, colId, a.key, a.elements, a.required, a.def,
        );
      default:
        throw new Error(`Unknown attribute type: ${a.type}`);
    }
  });
}

/** Appwrite builds attributes asynchronously; indexes need them "available". */
async function waitForAttributes(colId, expectedKeys) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const { attributes } = await databases.listAttributes(databaseId, colId);
    const byKey = new Map(attributes.map((x) => [x.key, x.status]));
    const pending = expectedKeys.filter((k) => byKey.get(k) !== 'available');
    if (pending.length === 0) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Timed out waiting for attributes on ${colId} to become available`);
}

// --- schema --------------------------------------------------------------

const usersCreate = [Permission.create(Role.users())];
const usersReadCreate = [Permission.read(Role.users()), Permission.create(Role.users())];

const collections = [
  {
    id: 'profiles',
    name: 'Profiles',
    permissions: usersReadCreate,
    attributes: [
      S('userId', 64, true), S('name', 255, true), S('avatarUrl', 2048, false),
      S('phone', 32, false), S('upiId', 256, false), D('createdAt', true),
    ],
    indexes: [UNIQUE('userId_unique', ['userId'])],
  },
  {
    id: 'trips',
    name: 'Trips',
    permissions: usersCreate,
    attributes: [
      S('name', 255, true), S('destination', 255, false), D('startDate', false),
      D('endDate', false), S('coverImageId', 128, false), S('teamId', 64, true),
      S('ownerId', 64, true), S('emergencyNumber', 32, false), D('createdAt', true),
    ],
    indexes: [KEY('teamId_idx', ['teamId']), KEY('ownerId_idx', ['ownerId'])],
  },
  {
    id: 'trip_members',
    name: 'Trip members',
    permissions: usersCreate,
    attributes: [
      S('tripId', 64, true), S('userId', 64, true),
      E('role', ['owner', 'member'], true),
      B('locationSharingEnabled', false, false), D('joinedAt', true),
    ],
    indexes: [KEY('tripId_idx', ['tripId']), UNIQUE('trip_user_unique', ['tripId', 'userId'])],
  },
  {
    id: 'pois',
    name: 'Points of interest',
    permissions: usersCreate,
    attributes: [
      S('tripId', 64, true), S('name', 255, true), F('lat', true), F('lng', true),
      E('category', ['food', 'sight', 'lodging', 'activity', 'transport', 'other'], true),
      S('notes', 2000, false), S('addedBy', 64, true), S('photoId', 128, false),
      E('visitStatus', ['planned', 'visited', 'skipped'], false, 'planned'),
      D('createdAt', true),
    ],
    indexes: [KEY('tripId_idx', ['tripId'])],
  },
  {
    id: 'locations',
    name: 'Live locations',
    permissions: usersCreate,
    attributes: [
      S('tripId', 64, true), S('userId', 64, true), F('lat', true), F('lng', true),
      F('accuracy', false), F('heading', false), D('timestamp', true),
    ],
    indexes: [KEY('tripId_idx', ['tripId']), UNIQUE('trip_user_unique', ['tripId', 'userId'])],
  },
  {
    id: 'visits',
    name: 'Visit check-ins',
    permissions: usersCreate,
    attributes: [
      S('tripId', 64, true), S('userId', 64, true), F('lat', true), F('lng', true),
      S('placeName', 255, false), S('placeCategory', 64, false), S('address', 512, false),
      S('note', 1000, false), D('visitedAt', true), D('createdAt', true),
    ],
    indexes: [KEY('tripId_idx', ['tripId']), KEY('trip_user_idx', ['tripId', 'userId'])],
  },
  {
    id: 'activities',
    name: 'Activities',
    permissions: usersCreate,
    attributes: [
      S('tripId', 64, true), S('userId', 64, true), S('title', 255, true),
      S('description', 4000, true), S('placeName', 255, false), F('lat', false), F('lng', false),
      S('category', 64, false), E('source', ['manual', 'ai'], false, 'manual'),
      S('visitId', 64, false), D('occurredAt', true), D('createdAt', true),
    ],
    indexes: [KEY('tripId_idx', ['tripId']), KEY('trip_user_idx', ['tripId', 'userId'])],
  },
  {
    id: 'expenses',
    name: 'Expenses',
    permissions: usersCreate,
    attributes: [
      S('tripId', 64, true), S('description', 500, true), F('amount', true),
      S('currency', 8, false, 'INR'), S('paidBy', 64, true), S('category', 64, false),
      E('splitType', ['equal', 'exact', 'percentage'], false, 'equal'),
      D('createdAt', true), S('receiptId', 128, false),
    ],
    indexes: [KEY('tripId_idx', ['tripId']), KEY('paidBy_idx', ['paidBy'])],
  },
  {
    id: 'expense_splits',
    name: 'Expense splits',
    permissions: usersCreate,
    attributes: [
      S('expenseId', 64, true), S('tripId', 64, true), S('userId', 64, true),
      F('shareAmount', true), B('settled', false, false),
    ],
    indexes: [KEY('expenseId_idx', ['expenseId']), KEY('trip_user_idx', ['tripId', 'userId'])],
  },
  {
    id: 'settlements',
    name: 'Settlements',
    permissions: usersCreate,
    attributes: [
      S('tripId', 64, true), S('fromUserId', 64, true), S('toUserId', 64, true),
      F('amount', true), E('status', ['pending', 'confirmed'], false, 'pending'),
      S('upiLink', 2048, false), D('createdAt', true), D('confirmedAt', false),
    ],
    indexes: [KEY('tripId_idx', ['tripId'])],
  },
  {
    id: 'polls',
    name: 'Polls',
    permissions: usersCreate,
    attributes: [
      S('tripId', 64, true), S('question', 500, true), S('createdBy', 64, true),
      E('status', ['open', 'closed'], false, 'open'), D('closesAt', false),
      S('linkedPoiId', 64, false), D('createdAt', true),
    ],
    indexes: [KEY('tripId_idx', ['tripId'])],
  },
  {
    id: 'poll_options',
    name: 'Poll options',
    permissions: usersCreate,
    attributes: [
      S('pollId', 64, true), S('tripId', 64, true), S('label', 255, true),
      S('poiId', 64, false),
    ],
    indexes: [KEY('pollId_idx', ['pollId'])],
  },
  {
    id: 'poll_votes',
    name: 'Poll votes',
    permissions: usersCreate,
    attributes: [
      S('pollId', 64, true), S('optionId', 64, true), S('userId', 64, true),
      S('tripId', 64, true), D('votedAt', true),
    ],
    indexes: [KEY('pollId_idx', ['pollId']), UNIQUE('poll_user_unique', ['pollId', 'userId'])],
  },
  {
    id: 'sos_events',
    name: 'SOS events',
    permissions: usersCreate,
    attributes: [
      S('tripId', 64, true), S('userId', 64, true), F('lat', false), F('lng', false),
      S('message', 1000, false), E('status', ['active', 'resolved'], false, 'active'),
      D('createdAt', true), D('resolvedAt', false), S('resolvedBy', 64, false),
    ],
    indexes: [KEY('trip_status_idx', ['tripId', 'status'])],
  },
];

const buckets = [
  { id: 'trip-covers', name: 'Trip covers' },
  { id: 'poi-photos', name: 'POI photos' },
  { id: 'receipts', name: 'Receipts' },
  { id: 'avatars', name: 'Avatars' },
];

// --- run -----------------------------------------------------------------

async function ensureDatabase() {
  try {
    await databases.get(databaseId);
    console.log(`Database "${databaseId}" exists.`);
  } catch (err) {
    if (err?.code === 404) {
      await databases.create(databaseId, 'PackNGo');
      console.log(`Database "${databaseId}" created.`);
    } else {
      throw err;
    }
  }
}

async function run() {
  console.log(`\nProvisioning Appwrite → ${endpoint} (project ${projectId})\n`);
  await ensureDatabase();

  for (const col of collections) {
    console.log(`\n▸ ${col.id}`);
    await safe(`collection ${col.id}`, () =>
      // documentSecurity = true so per-document team permissions are honored.
      databases.createCollection(databaseId, col.id, col.name, col.permissions, true, true),
    );
    for (const a of col.attributes) await createAttribute(col.id, a);
    await waitForAttributes(col.id, col.attributes.map((a) => a.key));
    for (const idx of col.indexes) {
      await safe(`index ${idx.key}`, () =>
        databases.createIndex(databaseId, col.id, idx.key, idx.type, idx.attributes),
      );
    }
  }

  console.log('\n▸ storage buckets');
  for (const b of buckets) {
    await safe(`bucket ${b.id}`, () =>
      // fileSecurity = true so per-file team permissions are honored.
      storage.createBucket(b.id, b.name, [Permission.create(Role.users())], true),
    );
  }

  console.log('\n✓ Done.\n');
}

run().catch((err) => {
  console.error('\n✗ Provisioning failed:', err?.message ?? err);
  if (err?.code === 401) {
    console.error(
      '\n  → 401 means your APPWRITE_API_KEY is valid but missing scopes.\n' +
        '    In the Appwrite console: Overview → Integrations → API Keys → (your key),\n' +
        '    and enable at least: databases.read, databases.write, collections.read,\n' +
        '    collections.write, attributes.read, attributes.write, indexes.read,\n' +
        '    indexes.write, buckets.read, buckets.write (granting all scopes is fine too).\n' +
        '    Then update APPWRITE_API_KEY in apps/web/.env and re-run `pnpm setup:appwrite`.\n',
    );
  }
  process.exit(1);
});
