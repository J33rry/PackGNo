/**
 * Appwrite Realtime channel + event helpers.
 *
 * Kept SDK-free (plain strings) so both apps can build the same channel names
 * and classify the same events without this package depending on either
 * Appwrite SDK. Each app calls its own `client.subscribe(...)`.
 */

/** Channel covering every document in a collection. */
export function documentsChannel(databaseId: string, collectionId: string): string {
  return `databases.${databaseId}.collections.${collectionId}.documents`;
}

export type RealtimeAction = 'create' | 'update' | 'delete';

/**
 * Classify an Appwrite realtime event list into a single action.
 *
 * Appwrite sends several event strings per message (broad to specific, e.g.
 * `...documents.*.create` and `...documents.<id>.create`); we only care which
 * action occurred.
 */
export function actionFromEvents(events: readonly string[]): RealtimeAction | null {
  for (const event of events) {
    if (event.endsWith('.create')) return 'create';
    if (event.endsWith('.update')) return 'update';
    if (event.endsWith('.delete')) return 'delete';
  }
  return null;
}

/**
 * Apply a realtime change to a local list, keeping it consistent regardless of
 * which action fired. Returns a new array (never mutates the input).
 *
 * Documents that don't belong to the caller's scope should be filtered out
 * before calling this — pass `shouldInclude` to do it in one step.
 */
export function applyRealtimeChange<T extends { $id: string }>(
  current: readonly T[],
  action: RealtimeAction,
  doc: T,
  shouldInclude: (doc: T) => boolean = () => true,
): T[] {
  if (action === 'delete' || !shouldInclude(doc)) {
    return current.filter((item) => item.$id !== doc.$id);
  }
  const index = current.findIndex((item) => item.$id === doc.$id);
  if (index === -1) return [doc, ...current];
  const next = [...current];
  next[index] = doc;
  return next;
}
