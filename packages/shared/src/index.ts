/**
 * @sync/shared — cross-platform logic shared by the web (Next.js) and mobile
 * (Expo) apps. Contains NO UI and NO Appwrite SDK runtime dependency: just
 * types, ids/config, and pure business logic. Each app constructs its own
 * Appwrite client using the exported config + ids.
 */

export * from './types/index';
export * from './appwrite/config';
export * from './appwrite/ids';
export * from './upi/buildUpiLink';
export * from './balances/computeBalances';
export * from './expenses/computeShares';
export * from './polls/tallyVotes';
export * from './sos/sosEvent';
export * from './trips/inviteCode';
export * from './maps/config';
export * from './places/categoryMap';
export * from './notifications/payloads';
export * from './realtime/channels';
