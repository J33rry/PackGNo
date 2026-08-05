'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TripMap, type TripMapHandle, type TappedPlace, type LiveLocation } from '@/components/TripMap';
import { PlaceSearch } from '@/components/PlaceSearch';
import { LiveLocationCard } from '@/components/LiveLocationCard';
import { PlaceInfoCard } from '@/components/PlaceInfoCard';
import { ExpensesPanel } from '@/components/ExpensesPanel';
import { ActivitiesPanel, type ActivityPrefill } from '@/components/ActivitiesPanel';
import { PollsPanel } from '@/components/PollsPanel';
import { SosPanel } from '@/components/SosPanel';
import { InviteMembersCard } from '@/components/InviteMembersCard';
import { useAuth } from '@/components/AuthProvider';
import { getTrip } from '@/lib/trips';
import { createPoi, deletePoi, listPois, setPoiVisitStatus, subscribeToPois } from '@/lib/pois';
import {
  createVisit,
  deleteVisit,
  listVisits,
  updateVisitNote,
  subscribeToVisits,
} from '@/lib/visits';
import { listSosEvents, subscribeToSos } from '@/lib/sos';
import { reverseGeocode, type Place } from '@/lib/places';
import { poiCategoryFromTags, type PoiCategory, type PoiDoc, type SosEventDoc, type TripDoc, type VisitDoc } from '@sync/shared';
import {
  ArrowRight,
  BarChart,
  Calendar,
  Compass,
  LifeBuoy,
  Locate,
  MapPin,
  Users,
  Wallet,
} from '@/components/marketing/icons';

type Tab = 'map' | 'activities' | 'expenses' | 'voting' | 'members' | 'sos';

const TABS: { id: Exclude<Tab, 'sos'>; label: string; icon: typeof Compass }[] = [
  { id: 'map', label: 'Map', icon: Compass },
  { id: 'activities', label: 'Activities', icon: Calendar },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'voting', label: 'Voting', icon: BarChart },
  { id: 'members', label: 'Members', icon: Users },
];

export default function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const { user } = useAuth();

  const [trip, setTrip] = useState<TripDoc | null>(null);
  const [pois, setPois] = useState<PoiDoc[]>([]);
  const [visits, setVisits] = useState<VisitDoc[]>([]);
  const [sosEvents, setSosEvents] = useState<SosEventDoc[]>([]);
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('map');

  // The place currently shown in the info card (tapped / searched / clicked).
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [placeBusy, setPlaceBusy] = useState(false);
  // A place handed to the Activities tab to draft an entry from.
  const [activityPrefill, setActivityPrefill] = useState<ActivityPrefill | null>(null);

  const mapHandle = useRef<TripMapHandle>(null);
  // Aborts an in-flight reverse-geocode when a new place is selected.
  const placeCtrlRef = useRef<AbortController | null>(null);

  // Realtime needs the current lists without re-subscribing on every change.
  const poisRef = useRef<PoiDoc[]>([]);
  const visitsRef = useRef<VisitDoc[]>([]);
  const sosRef = useRef<SosEventDoc[]>([]);
  useEffect(() => {
    poisRef.current = pois;
    visitsRef.current = visits;
    sosRef.current = sosEvents;
  }, [pois, visits, sosEvents]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [t, p, v, s] = await Promise.all([
          getTrip(tripId),
          listPois(tripId),
          listVisits(tripId),
          listSosEvents(tripId),
        ]);
        if (!active) return;
        setTrip(t);
        setPois(p);
        setVisits(v);
        setSosEvents(s);
      } catch (e) {
        if (active) setError(messageOf(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tripId]);

  // Live POI + visit + SOS updates from other members.
  useEffect(() => {
    const unsubPois = subscribeToPois(tripId, () => poisRef.current, setPois);
    const unsubVisits = subscribeToVisits(tripId, () => visitsRef.current, setVisits);
    const unsubSos = subscribeToSos(tripId, () => sosRef.current, setSosEvents);
    return () => {
      unsubPois();
      unsubVisits();
      unsubSos();
    };
  }, [tripId]);

  const activeSosCount = sosEvents.filter((e) => e.status === 'active').length;

  /**
   * Show a place in the info card and, when asked, enrich it with a
   * reverse-geocoded address. `preferBaseIdentity` keeps a tapped tile's own
   * name/category (more accurate than reverse geocode) while still adopting the
   * looked-up address.
   */
  const selectPlace = useCallback((base: Place, opts: { enrich: boolean; preferBaseIdentity?: boolean }) => {
    placeCtrlRef.current?.abort();
    setSelectedPlace(base);
    if (!opts.enrich) {
      setDetailsLoading(false);
      return;
    }
    const ctrl = new AbortController();
    placeCtrlRef.current = ctrl;
    setDetailsLoading(true);
    (async () => {
      try {
        const enriched = await reverseGeocode(base.lat, base.lng, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (enriched) {
          setSelectedPlace(
            opts.preferBaseIdentity
              ? { ...enriched, name: base.name, category: base.category, rawType: base.rawType }
              : enriched,
          );
        }
      } catch {
        // Keep the provisional place; address just stays unknown.
      } finally {
        if (!ctrl.signal.aborted) setDetailsLoading(false);
      }
    })();
  }, []);

  const handlePlaceTap = useCallback(
    (tapped: TappedPlace) => {
      selectPlace(
        {
          name: tapped.name,
          category: poiCategoryFromTags(tapped.rawType),
          rawType: tapped.rawType,
          address: null,
          lat: tapped.lat,
          lng: tapped.lng,
        },
        { enrich: true, preferBaseIdentity: true },
      );
    },
    [selectPlace],
  );

  const handleMapClick = useCallback(
    (coords: { lat: number; lng: number }) => {
      selectPlace(
        {
          name: 'Dropped pin',
          category: 'other',
          rawType: null,
          address: null,
          lat: coords.lat,
          lng: coords.lng,
        },
        { enrich: true, preferBaseIdentity: false },
      );
    },
    [selectPlace],
  );

  const handleSearchSelect = useCallback(
    (place: Place) => {
      mapHandle.current?.flyTo(place.lat, place.lng);
      selectPlace(place, { enrich: false });
    },
    [selectPlace],
  );

  const closePlace = useCallback(() => {
    placeCtrlRef.current?.abort();
    setSelectedPlace(null);
    setDetailsLoading(false);
  }, []);

  const createActivityFromPlace = useCallback((place: Place) => {
    setActivityPrefill({ place, nonce: Date.now() });
    setTab('activities');
    placeCtrlRef.current?.abort();
    setSelectedPlace(null);
    setDetailsLoading(false);
  }, []);

  async function addToPlaces(name: string, category: PoiCategory) {
    if (!trip || !selectedPlace) return;
    setPlaceBusy(true);
    setError(null);
    try {
      const created = await createPoi({
        tripId,
        teamId: trip.teamId,
        name,
        category,
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
      });
      setPois((prev) => (prev.some((p) => p.$id === created.$id) ? prev : [created, ...prev]));
      closePlace();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setPlaceBusy(false);
    }
  }

  async function logVisitAt(place: Place) {
    if (!trip) return;
    setPlaceBusy(true);
    setError(null);
    try {
      const created = await createVisit({
        tripId,
        teamId: trip.teamId,
        lat: place.lat,
        lng: place.lng,
        placeName: place.name === 'Dropped pin' ? null : place.name,
        placeCategory: place.rawType ?? place.category,
        address: place.address,
      });
      setVisits((prev) => (prev.some((v) => v.$id === created.$id) ? prev : [created, ...prev]));
      closePlace();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setPlaceBusy(false);
    }
  }

  /** "Log where I am now" — browser geolocation → reverse-geocode → check-in. */
  async function logCurrentLocation() {
    if (!trip) return;
    setError(null);
    try {
      const pos = await getCurrentPosition();
      const { latitude: lat, longitude: lng } = pos.coords;
      const place = await reverseGeocode(lat, lng).catch(() => null);
      const created = await createVisit({
        tripId,
        teamId: trip.teamId,
        lat,
        lng,
        placeName: place?.name ?? null,
        placeCategory: place?.rawType ?? place?.category ?? null,
        address: place?.address ?? null,
      });
      setVisits((prev) => (prev.some((v) => v.$id === created.$id) ? prev : [created, ...prev]));
      mapHandle.current?.flyTo(lat, lng);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function toggleVisited(poi: PoiDoc) {
    setError(null);
    try {
      await setPoiVisitStatus(poi.$id, poi.visitStatus === 'visited' ? 'planned' : 'visited');
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function removePoi(poi: PoiDoc) {
    setError(null);
    try {
      await deletePoi(poi.$id);
      setPois((prev) => prev.filter((p) => p.$id !== poi.$id));
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function removeVisit(visit: VisitDoc) {
    setError(null);
    try {
      await deleteVisit(visit.$id);
      setVisits((prev) => prev.filter((v) => v.$id !== visit.$id));
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function saveVisitNote(visit: VisitDoc, note: string) {
    setError(null);
    try {
      const updated = await updateVisitNote(visit.$id, note);
      setVisits((prev) => prev.map((v) => (v.$id === updated.$id ? updated : v)));
    } catch (e) {
      setError(messageOf(e));
    }
  }

  if (loading) {
    return <p className="px-4 py-10 text-sm text-[color:var(--muted)]">Loading trip…</p>;
  }
  if (!trip) {
    return (
      <div className="board-card px-6 py-8">
        <p className="text-sm text-[color:var(--danger)]">{error ?? 'Trip not found.'}</p>
        <Link href="/trips" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--accent)]">
          Back to trips <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      {/* header */}
      <section className="board-card px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link href="/trips" className="eyebrow inline-flex items-center gap-1.5 hover:opacity-80">
              <ArrowRight size={12} className="rotate-180" /> All trips
            </Link>
            <h1 className="display mt-2 truncate text-2xl text-[color:var(--ink)] sm:text-3xl">
              {trip.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[color:var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} className="text-[color:var(--faint)]" />
                {trip.destination || 'Destination flexible'}
              </span>
              <Dot />
              <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
              <Dot />
              <span>{pois.length} places</span>
              <Dot />
              <span>{visits.length} check-ins</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/8 px-3 py-1.5">
            <span className="live-dot h-1.5 w-1.5" aria-hidden="true" />
            <span className="text-xs font-medium text-[color:var(--accent)]">Live · realtime</span>
          </div>
        </div>

        {/* tab bar */}
        <div className="mt-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-[color:var(--line)] bg-black/30 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabButton key={id} active={tab === id} onClick={() => setTab(id)}>
              <Icon size={16} />
              {label}
            </TabButton>
          ))}
          <button
            onClick={() => setTab('sos')}
            className={`ml-auto inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              tab === 'sos'
                ? 'bg-[color:var(--danger)] text-white'
                : 'text-[color:var(--danger)] hover:bg-[color:var(--danger)]/12'
            }`}
          >
            <LifeBuoy size={16} />
            SOS
            {activeSosCount > 0 && (
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                  tab === 'sos' ? 'bg-white text-[color:var(--danger)]' : 'bg-[color:var(--danger)] text-white'
                }`}
              >
                {activeSosCount}
              </span>
            )}
          </button>
        </div>
      </section>

      {activeSosCount > 0 && tab !== 'sos' && (
        <button
          onClick={() => setTab('sos')}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-left"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--danger)]">
            <LifeBuoy size={16} />
            {activeSosCount} active {activeSosCount === 1 ? 'alert' : 'alerts'} — someone needs help.
          </span>
          <span className="shrink-0 text-sm font-semibold text-[color:var(--danger)] underline">View</span>
        </button>
      )}

      {error && (
        <p className="rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </p>
      )}

      {tab === 'expenses' &&
        (user ? (
          <ExpensesPanel tripId={tripId} teamId={trip.teamId} currentUserId={user.$id} />
        ) : (
          <p className="p-6 text-sm text-foreground/60">Loading…</p>
        ))}

      {tab === 'activities' &&
        (user ? (
          <ActivitiesPanel
            tripId={tripId}
            teamId={trip.teamId}
            currentUserId={user.$id}
            prefill={activityPrefill}
            onClearPrefill={() => setActivityPrefill(null)}
          />
        ) : (
          <p className="p-6 text-sm text-foreground/60">Loading…</p>
        ))}

      {tab === 'voting' &&
        (user ? (
          <PollsPanel tripId={tripId} teamId={trip.teamId} currentUserId={user.$id} />
        ) : (
          <p className="p-6 text-sm text-foreground/60">Loading…</p>
        ))}

      {tab === 'members' &&
        (user ? (
          <InviteMembersCard trip={trip} currentUserId={user.$id} />
        ) : (
          <p className="p-6 text-sm text-foreground/60">Loading…</p>
        ))}

      {tab === 'sos' &&
        (user ? (
          <SosPanel
            tripId={tripId}
            teamId={trip.teamId}
            currentUserId={user.$id}
            emergencyNumber={trip.emergencyNumber}
            events={sosEvents}
          />
        ) : (
          <p className="p-6 text-sm text-foreground/60">Loading…</p>
        ))}

      {tab === 'map' && (
        <div className="workspace-grid flex-1">
          <div className="board-card flex flex-col gap-3 p-4 sm:p-5">
            <PlaceSearch
              getViewBox={() => mapHandle.current?.getViewBox()}
              onSelect={handleSearchSelect}
            />
            <div className="relative min-h-[520px] flex-1 overflow-hidden rounded-[1.4rem] border border-[color:var(--line)] bg-[#141416]">
              <TripMap
                ref={mapHandle}
                pois={pois}
                visits={visits}
                locations={liveLocations}
                onMapClick={handleMapClick}
                onPlaceTap={handlePlaceTap}
                className="absolute inset-0 h-full w-full"
              />
              {!selectedPlace && (
                <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--ink)] px-4 py-2 text-xs font-medium text-black shadow-[0_14px_26px_rgba(0,0,0,0.4)]">
                  Tap a place or drop a pin to start
                </p>
              )}
              {selectedPlace && (
                <PlaceInfoCard
                  key={`${selectedPlace.lat},${selectedPlace.lng}`}
                  place={selectedPlace}
                  loadingDetails={detailsLoading}
                  busy={placeBusy}
                  onAddToPlaces={addToPlaces}
                  onLogVisit={() => logVisitAt(selectedPlace)}
                  onCreateActivity={() => createActivityFromPlace(selectedPlace)}
                  onClose={closePlace}
                />
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            {user && (
              <LiveLocationCard
                tripId={tripId}
                teamId={trip.teamId}
                currentUserId={user.$id}
                onLocationsChange={setLiveLocations}
              />
            )}

            <section className="board-card px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <MapPin size={15} className="text-[color:var(--accent)]" />
                <h2 className="text-sm font-semibold text-[color:var(--ink)]">Places</h2>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-[color:var(--muted)]">{pois.length}</span>
              </div>
              {pois.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[color:var(--line-strong)] px-4 py-8 text-center text-sm text-[color:var(--muted)]">
                  No places yet. Search or tap the map to add one.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pois.map((poi) => (
                    <li
                      key={poi.$id}
                      className="rounded-xl border border-[color:var(--line)] bg-[#17171a] p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className={poi.visitStatus === 'visited' ? 'text-[color:var(--muted)] line-through opacity-70' : 'text-[color:var(--ink)]'}>
                            {poi.name}
                          </div>
                          <div className="mt-1 text-xs capitalize text-[color:var(--faint)]">{poi.category}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => toggleVisited(poi)}
                            title={poi.visitStatus === 'visited' ? 'Mark planned' : 'Mark visited'}
                            className="rounded-lg border border-[color:var(--line)] px-2.5 py-1 text-xs text-[color:var(--ink)] hover:bg-white/10"
                          >
                            {poi.visitStatus === 'visited' ? '↩' : '✓'}
                          </button>
                          <button
                            onClick={() => removePoi(poi)}
                            title="Remove"
                            className="rounded-lg border border-[color:var(--line)] px-2.5 py-1 text-xs text-[color:var(--ink)] hover:bg-white/10"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="board-card px-5 py-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Locate size={15} className="text-[color:var(--accent)]" />
                  <h2 className="text-sm font-semibold text-[color:var(--ink)]">Check-ins</h2>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-[color:var(--muted)]">{visits.length}</span>
                </div>
                <button
                  onClick={logCurrentLocation}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent)]/15 px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)] hover:bg-[color:var(--accent)]/25"
                >
                  <Locate size={13} />
                  Log location
                </button>
              </div>
              {visits.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-[color:var(--line-strong)] px-4 py-8 text-center text-sm text-[color:var(--muted)]">
                  No check-ins yet.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {visits.map((visit) => (
                    <VisitRow
                      key={visit.$id}
                      visit={visit}
                      onSaveNote={(note) => saveVisitNote(visit, note)}
                      onDelete={() => removeVisit(visit)}
                    />
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-[color:var(--line-strong)]" />;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
        active
          ? 'bg-[color:var(--ink)] text-black'
          : 'text-[color:var(--muted)] hover:bg-white/5 hover:text-[color:var(--ink)]'
      }`}
    >
      {children}
    </button>
  );
}

function VisitRow({
  visit,
  onSaveNote,
  onDelete,
}: {
  visit: VisitDoc;
  onSaveNote: (note: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(visit.note ?? '');

  return (
    <li className="rounded-xl border border-[color:var(--line)] bg-[#17171a] p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-[color:var(--ink)]">{visit.placeName || 'Visited spot'}</div>
          <div className="mt-1 text-xs text-[color:var(--faint)]">{new Date(visit.visitedAt).toLocaleString()}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => setEditing((v) => !v)}
            title="Edit note"
            className="rounded-lg border border-[color:var(--line)] px-2.5 py-1 text-xs text-[color:var(--ink)] hover:bg-white/10"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            title="Delete check-in"
            className="rounded-lg border border-[color:var(--line)] px-2.5 py-1 text-xs text-[color:var(--ink)] hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note"
            className="flex-1 rounded-lg border border-[color:var(--line)] bg-[#1b1b1e] px-3 py-2 text-xs text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)]/50"
          />
          <button
            onClick={() => {
              onSaveNote(note);
              setEditing(false);
            }}
            className="rounded-lg bg-[color:var(--ink)] px-3 py-1.5 text-xs font-medium text-black"
          >
            Save
          </button>
        </div>
      ) : (
        visit.note && <p className="mt-2 text-xs text-[color:var(--muted)]">{visit.note}</p>
      )}
    </li>
  );
}

/** Promise wrapper around the callback-based geolocation API. */
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => reject(new Error(err.message)), {
      enableHighAccuracy: true,
      timeout: 10_000,
    });
  });
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Dates still open';
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (start && end) return `${fmt(start)} to ${fmt(end)}`;
  return fmt((start || end)!);
}
