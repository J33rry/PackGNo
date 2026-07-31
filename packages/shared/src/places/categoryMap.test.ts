import { describe, it, expect } from 'vitest';
import { poiCategoryFromTags } from './categoryMap';

describe('poiCategoryFromTags', () => {
  it('maps lodging tags', () => {
    expect(poiCategoryFromTags('hotel')).toBe('lodging');
    expect(poiCategoryFromTags('guest_house')).toBe('lodging');
    expect(poiCategoryFromTags('lodging')).toBe('lodging');
  });

  it('maps food & drink tags', () => {
    expect(poiCategoryFromTags('restaurant')).toBe('food');
    expect(poiCategoryFromTags('cafe')).toBe('food');
    expect(poiCategoryFromTags('fast_food')).toBe('food');
    expect(poiCategoryFromTags('bar')).toBe('food');
  });

  it('maps sights', () => {
    expect(poiCategoryFromTags('museum')).toBe('sight');
    expect(poiCategoryFromTags('attraction')).toBe('sight');
    expect(poiCategoryFromTags('viewpoint')).toBe('sight');
  });

  it('maps activities and transport', () => {
    expect(poiCategoryFromTags('cinema')).toBe('activity');
    expect(poiCategoryFromTags('railway_station')).toBe('transport');
    expect(poiCategoryFromTags('parking')).toBe('transport');
  });

  it('is case-insensitive and trims', () => {
    expect(poiCategoryFromTags('  Hotel ')).toBe('lodging');
    expect(poiCategoryFromTags('RESTAURANT')).toBe('food');
  });

  it('returns the first matching descriptor, most-specific first', () => {
    // subclass `hotel` wins even when a later generic class would not match.
    expect(poiCategoryFromTags('hotel', 'tourism')).toBe('lodging');
    // first descriptor misses, second hits.
    expect(poiCategoryFromTags('tourism', 'museum')).toBe('sight');
  });

  it('falls back to other for unknown or empty input', () => {
    expect(poiCategoryFromTags('tourism')).toBe('other');
    expect(poiCategoryFromTags(null, undefined, '')).toBe('other');
    expect(poiCategoryFromTags()).toBe('other');
  });
});
