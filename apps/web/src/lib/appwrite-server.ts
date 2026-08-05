/**
 * Server-only Appwrite clients (node-appwrite).
 *
 * These run exclusively in Next.js route handlers — never in the browser — and
 * are the only place the secret `APPWRITE_API_KEY` is used. Two flavours:
 *   - `adminClient()` acts as the project (API key). Used for privileged reads
 *     and writes a member can't do themselves, e.g. resolving an invite code
 *     against a trip they can't yet read, and adding them to its Team.
 *   - `userClient(jwt)` acts as a specific signed-in user (short-lived JWT the
 *     browser mints via `account.createJWT()`), so we can trust *who* is asking.
 */

import { Account, Client, Databases, Teams } from 'node-appwrite';

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

export const SERVER_DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? '';

/** True when the server has what it needs to perform privileged actions. */
export function isServerConfigured(): boolean {
  return Boolean(endpoint && projectId && SERVER_DB_ID && process.env.APPWRITE_API_KEY);
}

function baseClient(): Client {
  if (!endpoint || !projectId) {
    throw new Error('Appwrite endpoint/project env vars are not set.');
  }
  return new Client().setEndpoint(endpoint).setProject(projectId);
}

/** Project-scoped admin client (uses the secret API key). */
export function adminClient(): { databases: Databases; teams: Teams } {
  const key = process.env.APPWRITE_API_KEY;
  if (!key) throw new Error('APPWRITE_API_KEY is not set.');
  const client = baseClient().setKey(key);
  return { databases: new Databases(client), teams: new Teams(client) };
}

/** User-scoped client for a given session JWT (identifies the caller). */
export function userClient(jwt: string): { account: Account } {
  const client = baseClient().setJWT(jwt);
  return { account: new Account(client) };
}
