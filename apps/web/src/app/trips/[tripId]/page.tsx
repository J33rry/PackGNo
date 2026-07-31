'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TripMap, type TripMapHandle, type TappedPlace } from '@/components/TripMap';
import { PlaceSearch } from '@/components/PlaceSearch';
import { PlaceInfoCard } from '@/components/PlaceInfoCard';
import { ExpensesPanel } from '@/components/ExpensesPanel';
import { ActivitiesPanel, type ActivityPrefill } from '@/components/ActivitiesPanel';
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
import { reverseGeocode, type Place } from '@/lib/places';
import { poiCategoryFromTags, type PoiCategory, type PoiDoc, type TripDoc, type VisitDoc } from '@sync/shared';

type Tab = 'map' | 'activities' | 'expenses';

export default function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const { user } = useAuth();

  const [trip, setTrip] = useState<TripDoc | null>(null);
  const [pois, setPois] = useState<PoiDoc[]>([]);
  const [visits, setVisits] = useState<VisitDoc[]>([]);
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
  useEffect(() => {
    poisRef.current = pois;
    visitsRef.current = visits;
  }, [pois, visits]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [t, p, v] = await Promise.all([getTrip(tripId), listPois(tripId), listVisits(tripId)]);
        if (!active) return;
        setTrip(t);
        setPois(p);
        setVisits(v);
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

  // Live POI + visit updates from other members.
  useEffect(() => {
    const unsubPois = subscribeToPois(tripId, () => poisRef.current, setPois);
    const unsubVisits = subscribeToVisits(tripId, () => visitsRef.current, setVisits);
    return () => {
      unsubPois();
      unsubVisits();
    };
  }, [tripId]);

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
      <div className="glass rounded-[2rem] px-6 py-8">
        <p className="text-sm text-[color:var(--danger)]">{error ?? 'Trip not found.'}</p>
        <Link href="/trips" className="mt-3 inline-block text-sm text-[color:var(--accent)] underline">
          Back to trips
        </Link>
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      <section className="glass rounded-[2rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Trip board</div>
            <h1 className="display mt-3 text-[clamp(2.6rem,5vw,4.4rem)] leading-[0.96] text-[color:var(--ink)]">
              {trip.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[color:var(--muted)]">
              <span>{trip.destination || 'Destination still flexible'}</span>
              <span className="h-1 w-1 rounded-full bg-[color:var(--line-strong)]" />
              <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
              <span className="h-1 w-1 rounded-full bg-[color:var(--line-strong)]" />
              <span>{pois.length} places</span>
              <span className="h-1 w-1 rounded-full bg-[color:var(--line-strong)]" />
              <span>{visits.length} check-ins</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--muted)]">
              Team-scoped realtime workspace
            </div>
            <Link href="/trips" className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] hover:bg-white">
              All trips
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <TabButton active={tab === 'map'} onClick={() => setTab('map')}>
            Map board
          </TabButton>
          <TabButton active={tab === 'activities'} onClick={() => setTab('activities')}>
            Activities
          </TabButton>
          <TabButton active={tab === 'expenses'} onClick={() => setTab('expenses')}>
            Expenses
          </TabButton>
        </div>
      </section>

      {error && (
        <p className="rounded-[1.4rem] border border-[color:var(--danger)]/20 bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--danger)]">
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

      {tab === 'map' && (
        <div className="workspace-grid flex-1">
          <div className="glass flex flex-col gap-3 rounded-[2rem] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <div className="data-label">Map board</div>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  Search Google Places, tap map POIs, or drop a pin to turn a location into a saved place, check-in, or activity.
                </p>
              </div>
            </div>
            <PlaceSearch
              getViewBox={() => mapHandle.current?.getViewBox()}
              onSelect={handleSearchSelect}
            />
            <div className="relative min-h-[520px] flex-1 overflow-hidden rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--paper-strong)]">
              <TripMap
                ref={mapHandle}
                pois={pois}
                visits={visits}
                onMapClick={handleMapClick}
                onPlaceTap={handlePlaceTap}
                className="absolute inset-0 h-full w-full"
              />
              {!selectedPlace && (
                <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--ink)] px-4 py-2 text-xs text-[color:var(--paper)] shadow-[0_14px_26px_rgba(23,50,77,0.24)]">
                  Tap a Google map place or drop a pin to start
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
            <section className="glass rounded-[2rem] px-5 py-5">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <div className="data-label">Places</div>
                  <h2 className="mt-1 text-lg font-semibold text-[color:var(--ink)]">{pois.length} saved</h2>
                </div>
              </div>
              {pois.length === 0 ? (
                <p className="rounded-[1.4rem] border border-dashed border-[color:var(--line-strong)] px-4 py-8 text-center text-sm text-[color:var(--muted)]">
                  No places yet. Search or tap the map to add one.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pois.map((poi) => (
                    <li
                      key={poi.$id}
                      className="rounded-[1.4rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className={poi.visitStatus === 'visited' ? 'text-[color:var(--muted)] line-through opacity-70' : 'text-[color:var(--ink)]'}>
                            {poi.name}
                          </div>
                          <div className="mt-1 text-xs capitalize text-[color:var(--muted)]">{poi.category}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => toggleVisited(poi)}
                            title={poi.visitStatus === 'visited' ? 'Mark planned' : 'Mark visited'}
                            className="rounded-full border border-[color:var(--line)] px-2.5 py-1 text-xs text-[color:var(--ink)] hover:bg-white"
                          >
                            {poi.visitStatus === 'visited' ? '↩' : '✓'}
                          </button>
                          <button
                            onClick={() => removePoi(poi)}
                            title="Remove"
                            className="rounded-full border border-[color:var(--line)] px-2.5 py-1 text-xs text-[color:var(--ink)] hover:bg-white"
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

            <section className="glass rounded-[2rem] px-5 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="data-label">Check-ins</div>
                  <h2 className="mt-1 text-lg font-semibold text-[color:var(--ink)]">{visits.length} logged</h2>
                </div>
                <button
                  onClick={logCurrentLocation}
                  className="rounded-full bg-[color:var(--accent-2)] px-3 py-2 text-xs font-semibold text-white hover:-translate-y-0.5"
                >
                  Log current location
                </button>
              </div>
              {visits.length === 0 ? (
                <p className="mt-3 rounded-[1.4rem] border border-dashed border-[color:var(--line-strong)] px-4 py-8 text-center text-sm text-[color:var(--muted)]">
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
      className={`rounded-full px-4 py-2 text-sm font-medium ${
        active
          ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
          : 'border border-[color:var(--line)] bg-[color:var(--panel-strong)] text-[color:var(--muted)] hover:bg-white hover:text-[color:var(--ink)]'
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
    <li className="rounded-[1.4rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-[color:var(--ink)]">{visit.placeName || 'Visited spot'}</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">{new Date(visit.visitedAt).toLocaleString()}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => setEditing((v) => !v)}
            title="Edit note"
            className="rounded-full border border-[color:var(--line)] px-2.5 py-1 text-xs text-[color:var(--ink)] hover:bg-white"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            title="Delete check-in"
            className="rounded-full border border-[color:var(--line)] px-2.5 py-1 text-xs text-[color:var(--ink)] hover:bg-white"
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
            className="flex-1 rounded-full border border-[color:var(--line)] bg-white/75 px-3 py-2 text-xs outline-none focus:border-[color:var(--accent)]"
          />
          <button
            onClick={() => {
              onSaveNote(note);
              setEditing(false);
            }}
            className="rounded-full bg-[color:var(--ink)] px-3 py-1.5 text-xs font-medium text-[color:var(--paper)]"
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
