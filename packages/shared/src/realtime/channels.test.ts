import { describe, expect, it } from 'vitest';
import { actionFromEvents, applyRealtimeChange, documentsChannel } from './channels';

const doc = (id: string, name = 'x') => ({ $id: id, name });

describe('documentsChannel', () => {
  it('builds the collection documents channel', () => {
    expect(documentsChannel('db1', 'pois')).toBe('databases.db1.collections.pois.documents');
  });
});

describe('actionFromEvents', () => {
  it('detects the action from Appwrite event lists', () => {
    expect(actionFromEvents(['databases.d.collections.c.documents.1.create'])).toBe('create');
    expect(actionFromEvents(['databases.d.collections.c.documents.1.update'])).toBe('update');
    expect(actionFromEvents(['databases.d.collections.c.documents.1.delete'])).toBe('delete');
  });

  it('returns null when no action is recognised', () => {
    expect(actionFromEvents(['something.else'])).toBeNull();
    expect(actionFromEvents([])).toBeNull();
  });
});

describe('applyRealtimeChange', () => {
  it('prepends a newly created document', () => {
    const next = applyRealtimeChange([doc('a')], 'create', doc('b'));
    expect(next.map((d) => d.$id)).toEqual(['b', 'a']);
  });

  it('replaces an updated document in place', () => {
    const next = applyRealtimeChange([doc('a', 'old'), doc('b')], 'update', doc('a', 'new'));
    expect(next.map((d) => d.$id)).toEqual(['a', 'b']);
    expect(next[0]!.name).toBe('new');
  });

  it('removes a deleted document', () => {
    const next = applyRealtimeChange([doc('a'), doc('b')], 'delete', doc('a'));
    expect(next.map((d) => d.$id)).toEqual(['b']);
  });

  it('drops documents that fall outside the caller scope', () => {
    // e.g. a POI that belongs to a different trip
    const next = applyRealtimeChange([doc('a')], 'create', doc('b'), () => false);
    expect(next.map((d) => d.$id)).toEqual(['a']);
  });

  it('does not mutate the input array', () => {
    const current = [doc('a')];
    applyRealtimeChange(current, 'create', doc('b'));
    expect(current).toHaveLength(1);
  });
});
