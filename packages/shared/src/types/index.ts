/**
 * TypeScript interfaces mirroring the Appwrite collections.
 *
 * These describe the *application* shape of each document. Appwrite adds its
 * own system fields ($id, $createdAt, $updatedAt, $permissions, ...) to every
 * document; `AppwriteDocument` models the subset we rely on, and each entity
 * type is exported both "bare" (for writes) and wrapped in `WithDoc` (for reads).
 */

/**
 * System fields Appwrite attaches to every stored document. Mirrors the SDK's
 * `Models.Document` so our typed entities can parameterize SDK generics
 * (createDocument<T>, listDocuments<T>, ...).
 */
export interface AppwriteDocument {
  $id: string;
  $sequence: string;
  $collectionId: string;
  $databaseId: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
}

/** Wrap an app entity with Appwrite's system document fields. */
export type WithDoc<T> = T & AppwriteDocument;

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

export type TripMemberRole = 'owner' | 'member';

export type PoiCategory = 'food' | 'sight' | 'lodging' | 'activity' | 'transport' | 'other';
export type PoiVisitStatus = 'planned' | 'visited' | 'skipped';

export type ExpenseSplitType = 'equal' | 'exact' | 'percentage';

export type SettlementStatus = 'pending' | 'confirmed';

export type PollStatus = 'open' | 'closed';

export type SosStatus = 'active' | 'resolved';

/** How an activity's description was authored. */
export type ActivitySource = 'manual' | 'ai';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Profile {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  phone?: string | null;
  /** The user's own UPI VPA, used as the payee when others settle up with them. */
  upiId?: string | null;
  createdAt: string;
}

export interface Trip {
  name: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  coverImageId?: string | null;
  /** Appwrite Team id backing this trip's membership + permissions. */
  teamId: string;
  ownerId: string;
  /** Number dialed by the SOS button; falls back to a country default in the UI. */
  emergencyNumber?: string | null;
  createdAt: string;
}

export interface TripMember {
  tripId: string;
  userId: string;
  role: TripMemberRole;
  /** Opt-in toggle for live location sharing. Default false. */
  locationSharingEnabled: boolean;
  joinedAt: string;
}

export interface Poi {
  tripId: string;
  name: string;
  lat: number;
  lng: number;
  category: PoiCategory;
  notes?: string | null;
  addedBy: string;
  photoId?: string | null;
  visitStatus: PoiVisitStatus;
  createdAt: string;
}

export interface LocationPing {
  tripId: string;
  userId: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  /** ISO timestamp of the fix. */
  timestamp: string;
}

/**
 * An on-demand "I visited here" check-in. Append-only history (unlike
 * `LocationPing`, which is a single upserted current-position doc per user).
 * Place fields are filled by reverse-geocoding the coordinate when available.
 */
export interface Visit {
  tripId: string;
  userId: string;
  lat: number;
  lng: number;
  placeName?: string | null;
  placeCategory?: string | null;
  address?: string | null;
  note?: string | null;
  /** ISO timestamp of when the user was there (defaults to check-in time). */
  visitedAt: string;
  createdAt: string;
}

/**
 * A trip activity/journal entry. Either typed by hand (`source: 'manual'`) or
 * drafted by the LLM from a detected place (`source: 'ai'`); the user can edit
 * either before saving. Place/coords are optional so a note need not be pinned.
 */
export interface Activity {
  tripId: string;
  userId: string;
  title: string;
  description: string;
  placeName?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: string | null;
  source: ActivitySource;
  /** The `visits` doc this activity was generated from, if any. */
  visitId?: string | null;
  /** ISO timestamp of when the activity happened. */
  occurredAt: string;
  createdAt: string;
}

export interface Expense {
  tripId: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string;
  category?: string | null;
  splitType: ExpenseSplitType;
  createdAt: string;
  receiptId?: string | null;
}

export interface ExpenseSplit {
  expenseId: string;
  /** Denormalized from the parent expense for cheaper per-user queries + permissions. */
  tripId: string;
  userId: string;
  shareAmount: number;
  settled: boolean;
}

export interface Settlement {
  tripId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: SettlementStatus;
  /** The generated upi:// link, stored for audit / re-share. */
  upiLink?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
}

export interface Poll {
  tripId: string;
  question: string;
  createdBy: string;
  status: PollStatus;
  closesAt?: string | null;
  linkedPoiId?: string | null;
  createdAt: string;
}

export interface PollOption {
  pollId: string;
  tripId: string;
  label: string;
  poiId?: string | null;
}

export interface PollVote {
  pollId: string;
  optionId: string;
  userId: string;
  tripId: string;
  votedAt: string;
}

export interface SosEvent {
  tripId: string;
  userId: string;
  lat?: number | null;
  lng?: number | null;
  message?: string | null;
  status: SosStatus;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

// ---------------------------------------------------------------------------
// Read-shaped aliases (document + system fields)
// ---------------------------------------------------------------------------

export type ProfileDoc = WithDoc<Profile>;
export type TripDoc = WithDoc<Trip>;
export type TripMemberDoc = WithDoc<TripMember>;
export type PoiDoc = WithDoc<Poi>;
export type LocationPingDoc = WithDoc<LocationPing>;
export type VisitDoc = WithDoc<Visit>;
export type ActivityDoc = WithDoc<Activity>;
export type ExpenseDoc = WithDoc<Expense>;
export type ExpenseSplitDoc = WithDoc<ExpenseSplit>;
export type SettlementDoc = WithDoc<Settlement>;
export type PollDoc = WithDoc<Poll>;
export type PollOptionDoc = WithDoc<PollOption>;
export type PollVoteDoc = WithDoc<PollVote>;
export type SosEventDoc = WithDoc<SosEvent>;
