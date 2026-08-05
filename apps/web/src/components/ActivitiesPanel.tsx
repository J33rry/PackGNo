'use client';

/**
 * Activities tab: a live journal of what the group did. Entries are typed by
 * hand or drafted by the AI from a detected place (the "Create activity" action
 * on the map info card prefills this with a place). Any member sees every
 * entry; only the author can edit or delete their own.
 */

import { useEffect, useRef, useState } from 'react';
import type { ActivityDoc, ActivitySource } from '@sync/shared';
import type { Place } from '@/lib/places';
import {
  createActivity,
  deleteActivity,
  generateActivityDraft,
  listActivities,
  subscribeToActivities,
  updateActivity,
} from '@/lib/activities';

/** A place handed over from the map to seed a new activity. `nonce` bumps per hand-off. */
export interface ActivityPrefill {
  place: Place;
  nonce: number;
}

interface ActivitiesPanelProps {
  tripId: string;
  teamId: string;
  currentUserId: string;
  prefill?: ActivityPrefill | null;
  /** Called when the prefill has been used up (form closed or saved). */
  onClearPrefill?: () => void;
}

export function ActivitiesPanel({
  tripId,
  teamId,
  currentUserId,
  prefill,
  onClearPrefill,
}: ActivitiesPanelProps) {
  const [activities, setActivities] = useState<ActivityDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const activitiesRef = useRef<ActivityDoc[]>([]);
  useEffect(() => {
    activitiesRef.current = activities;
  }, [activities]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await listActivities(tripId);
        if (active) setActivities(list);
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

  useEffect(() => {
    const unsub = subscribeToActivities(tripId, () => activitiesRef.current, setActivities);
    return () => unsub();
  }, [tripId]);

  // Form visibility is derived (no effect): open when the user asked, or when
  // the map handed over a place to draft from.
  const showForm = manualOpen || !!prefill;

  function closeForm() {
    setManualOpen(false);
    onClearPrefill?.();
  }

  function onCreated(doc: ActivityDoc) {
    setActivities((prev) => (prev.some((a) => a.$id === doc.$id) ? prev : [doc, ...prev]));
    closeForm();
  }

  async function remove(activity: ActivityDoc) {
    setError(null);
    try {
      await deleteActivity(activity.$id);
      setActivities((prev) => prev.filter((a) => a.$id !== activity.$id));
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function saveEdit(activity: ActivityDoc, patch: { title: string; description: string }) {
    setError(null);
    try {
      const updated = await updateActivity(activity.$id, patch);
      setActivities((prev) => prev.map((a) => (a.$id === updated.$id ? updated : a)));
    } catch (e) {
      setError(messageOf(e));
    }
  }

  return (
    <div className="board-card mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground/70">Activities ({activities.length})</h2>
        {!showForm && (
          <button
            onClick={() => setManualOpen(true)}
            className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background"
          >
            New activity
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {showForm && (
        <ActivityForm
          key={prefill?.nonce ?? 'manual'}
          tripId={tripId}
          teamId={teamId}
          initialPlace={prefill?.place ?? null}
          onCreated={onCreated}
          onCancel={closeForm}
          onError={setError}
        />
      )}

      {loading ? (
        <p className="text-sm text-foreground/60">Loading activities…</p>
      ) : activities.length === 0 && !showForm ? (
        <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-sm text-foreground/60 dark:border-white/15">
          No activities yet. Add one by hand, or tap a place on the map and choose “Create activity”.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {activities.map((activity) => (
            <ActivityRow
              key={activity.$id}
              activity={activity}
              canEdit={activity.userId === currentUserId}
              onSave={(patch) => saveEdit(activity, patch)}
              onDelete={() => remove(activity)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityForm({
  tripId,
  teamId,
  initialPlace,
  onCreated,
  onCancel,
  onError,
}: {
  tripId: string;
  teamId: string;
  initialPlace: Place | null;
  onCreated: (doc: ActivityDoc) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<ActivitySource>('manual');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function generate() {
    if (!initialPlace) return;
    setGenerating(true);
    onError('');
    try {
      const draft = await generateActivityDraft(initialPlace, description.trim() || undefined);
      setTitle(draft.title);
      setDescription(draft.description);
      setSource('ai');
    } catch (e) {
      onError(messageOf(e));
    } finally {
      setGenerating(false);
    }
  }

  async function submit() {
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    onError('');
    try {
      const created = await createActivity({
        tripId,
        teamId,
        title: title.trim(),
        description: description.trim(),
        source,
        placeName: initialPlace?.name ?? null,
        lat: initialPlace?.lat ?? null,
        lng: initialPlace?.lng ?? null,
        category: initialPlace ? (initialPlace.rawType ?? initialPlace.category) : null,
      });
      onCreated(created);
    } catch (e) {
      onError(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
      {initialPlace && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-black/5 px-3 py-2 text-xs dark:bg-white/10">
          <span className="truncate">
            📍 {initialPlace.name}
            {initialPlace.address ? ` — ${initialPlace.address}` : ''}
          </span>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="shrink-0 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background disabled:opacity-50"
          >
            {generating ? 'Generating…' : '✨ Generate with AI'}
          </button>
        </div>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Activity title"
        className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What did you do?"
        rows={3}
        className="resize-y rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground/50">
          {source === 'ai' ? 'AI-drafted — edit freely before saving' : ''}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-foreground/60 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !title.trim() || !description.trim()}
            className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save activity'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  canEdit,
  onSave,
  onDelete,
}: {
  activity: ActivityDoc;
  canEdit: boolean;
  onSave: (patch: { title: string; description: string }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="resize-y rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setTitle(activity.title);
              setDescription(activity.description);
              setEditing(false);
            }}
            className="rounded-lg px-3 py-1.5 text-sm text-foreground/60 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (title.trim() && description.trim()) {
                onSave({ title: title.trim(), description: description.trim() });
                setEditing(false);
              }
            }}
            className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background"
          >
            Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{activity.title}</h3>
            {activity.source === 'ai' && (
              <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground/50 dark:bg-white/10">
                AI
              </span>
            )}
          </div>
          {activity.placeName && (
            <p className="mt-0.5 text-xs text-foreground/50">📍 {activity.placeName}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setEditing(true)}
              title="Edit"
              className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
            >
              ✎
            </button>
            <button
              onClick={onDelete}
              title="Delete"
              className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{activity.description}</p>
      <p className="mt-2 text-xs text-foreground/40">
        {new Date(activity.occurredAt).toLocaleDateString()}
      </p>
    </li>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}
