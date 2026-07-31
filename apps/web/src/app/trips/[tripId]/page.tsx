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
    return <p className="p-6 text-sm text-foreground/60">Loading trip…</p>;
  }
  if (!trip) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 dark:text-red-400">{error ?? 'Trip not found.'}</p>
        <Link href="/trips" className="mt-3 inline-block text-sm underline">
          Back to trips
        </Link>
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">{trip.name}</h1>
          {trip.destination && <p className="text-sm text-foreground/60">{trip.destination}</p>}
        </div>
        <Link href="/trips" className="text-sm text-foreground/60 underline">
          All trips
        </Link>
      </div>

      <div className="flex gap-1 border-b border-black/10 px-6 dark:border-white/10">
        <TabButton active={tab === 'map'} onClick={() => setTab('map')}>
          Map
        </TabButton>
        <TabButton active={tab === 'activities'} onClick={() => setTab('activities')}>
          Activities
        </TabButton>
        <TabButton active={tab === 'expenses'} onClick={() => setTab('expenses')}>
          Expenses
        </TabButton>
      </div>

      {error && (
        <p className="mx-6 mb-3 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
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
        <div className="mt-4 grid flex-1 gap-4 px-6 pb-6 lg:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-2">
            <PlaceSearch
              getViewBox={() => mapHandle.current?.getViewBox()}
              onSelect={handleSearchSelect}
            />
            <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
              <TripMap
                ref={mapHandle}
                pois={pois}
                visits={visits}
                onMapClick={handleMapClick}
                onPlaceTap={handlePlaceTap}
                className="absolute inset-0 h-full w-full"
              />
              {!selectedPlace && (
                <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
                  Tap a place, or click the map, to add it
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

          <aside className="flex flex-col gap-5">
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-foreground/70">Places ({pois.length})</h2>
              {pois.length === 0 ? (
                <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-foreground/60 dark:border-white/15">
                  No places yet. Search or tap the map to add one.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pois.map((poi) => (
                    <li
                      key={poi.$id}
                      className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className={poi.visitStatus === 'visited' ? 'line-through opacity-60' : ''}>
                            {poi.name}
                          </div>
                          <div className="text-xs capitalize text-foreground/50">{poi.category}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => toggleVisited(poi)}
                            title={poi.visitStatus === 'visited' ? 'Mark planned' : 'Mark visited'}
                            className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            {poi.visitStatus === 'visited' ? '↩' : '✓'}
                          </button>
                          <button
                            onClick={() => removePoi(poi)}
                            title="Remove"
                            className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
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

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground/70">Check-ins ({visits.length})</h2>
                <button
                  onClick={logCurrentLocation}
                  className="rounded-lg border border-black/15 px-2.5 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  Log where I am now
                </button>
              </div>
              {visits.length === 0 ? (
                <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-foreground/60 dark:border-white/15">
                  No check-ins yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
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
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-foreground text-foreground'
          : 'border-transparent text-foreground/50 hover:text-foreground/80'
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
    <li className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate">{visit.placeName || 'Visited spot'}</div>
          <div className="text-xs text-foreground/50">{new Date(visit.visitedAt).toLocaleString()}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => setEditing((v) => !v)}
            title="Edit note"
            className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            title="Delete check-in"
            className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
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
            className="flex-1 rounded-lg border border-black/10 bg-transparent px-2 py-1 text-xs outline-none focus:border-foreground/40 dark:border-white/15"
          />
          <button
            onClick={() => {
              onSaveNote(note);
              setEditing(false);
            }}
            className="rounded-lg bg-foreground px-2.5 py-1 text-xs font-medium text-background"
          >
            Save
          </button>
        </div>
      ) : (
        visit.note && <p className="mt-1.5 text-xs text-foreground/70">{visit.note}</p>
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
