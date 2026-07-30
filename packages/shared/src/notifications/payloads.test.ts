import { describe, expect, it } from 'vitest';
import { buildNotification, type NotificationType } from './payloads';

const base = { tripId: 't1', entityId: 'e1', tripName: 'Goa 2026' };

describe('buildNotification', () => {
  it('always attaches routing data', () => {
    const types: NotificationType[] = ['sos', 'expense', 'settlement', 'poll', 'trip_member'];
    for (const type of types) {
      const n = buildNotification({ ...base, type });
      expect(n.data).toEqual({ type, tripId: 't1', entityId: 'e1' });
      expect(n.title.length).toBeGreaterThan(0);
      expect(n.body.length).toBeGreaterThan(0);
    }
  });

  it('leads with urgency for SOS', () => {
    const n = buildNotification({ ...base, type: 'sos', actorName: 'Alice' });
    expect(n.title).toContain('Alice');
    expect(n.title).toContain('🚨');
  });

  it('formats expense amounts as rupees', () => {
    const n = buildNotification({
      ...base,
      type: 'expense',
      actorName: 'Bob',
      detail: 'dinner',
      amount: 1250.5,
    });
    expect(n.body).toContain('₹1250.50');
    expect(n.body).toContain('dinner');
  });

  it('respects a non-INR currency', () => {
    const n = buildNotification({ ...base, type: 'settlement', amount: 20, currency: 'USD' });
    expect(n.body).toContain('USD 20.00');
  });

  it('falls back to a generic actor when none is given', () => {
    const n = buildNotification({ ...base, type: 'poll' });
    expect(n.body).toContain('Someone');
  });

  it('includes the trip name for context', () => {
    const n = buildNotification({ ...base, type: 'expense', actorName: 'Bob', amount: 10 });
    expect(n.title).toContain('Goa 2026');
  });
});
