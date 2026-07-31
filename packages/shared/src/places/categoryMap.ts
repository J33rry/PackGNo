/**
 * Map an OpenStreetMap / OpenMapTiles place descriptor onto our own
 * {@link PoiCategory}. Both vocabularies are handled with one token table:
 *
 *  - Nominatim returns a `class` (e.g. `tourism`, `amenity`) and a more specific
 *    `type` (e.g. `hotel`, `restaurant`, `museum`).
 *  - OpenMapTiles vector-tile POI features carry a `class` (e.g. `lodging`,
 *    `restaurant`, `attraction`) and a raw-OSM-tag `subclass` (e.g. `hotel`).
 *
 * Pure and framework-agnostic so it runs identically in tests, web, and native.
 */

import type { PoiCategory } from '../types/index';

/**
 * Specific place tokens → our category. Keys are matched case-insensitively
 * against whatever descriptors a caller has (subclass, class, type, …). The
 * first descriptor that hits wins, so pass the most specific ones first.
 */
const TOKEN_TO_CATEGORY: Record<string, PoiCategory> = {
  // --- lodging ---
  lodging: 'lodging',
  hotel: 'lodging',
  motel: 'lodging',
  hostel: 'lodging',
  guest_house: 'lodging',
  guesthouse: 'lodging',
  apartment: 'lodging',
  chalet: 'lodging',
  resort: 'lodging',
  camp_site: 'lodging',
  caravan_site: 'lodging',

  // --- food & drink ---
  restaurant: 'food',
  fast_food: 'food',
  food_court: 'food',
  cafe: 'food',
  bar: 'food',
  pub: 'food',
  biergarten: 'food',
  bakery: 'food',
  ice_cream: 'food',
  food: 'food',

  // --- sights ---
  attraction: 'sight',
  viewpoint: 'sight',
  museum: 'sight',
  gallery: 'sight',
  art_gallery: 'sight',
  artwork: 'sight',
  monument: 'sight',
  memorial: 'sight',
  castle: 'sight',
  fort: 'sight',
  ruins: 'sight',
  archaeological_site: 'sight',
  place_of_worship: 'sight',
  temple: 'sight',
  church: 'sight',
  mosque: 'sight',
  synagogue: 'sight',
  shrine: 'sight',
  zoo: 'sight',
  aquarium: 'sight',
  theme_park: 'sight',
  park: 'sight',
  garden: 'sight',
  beach: 'sight',
  waterfall: 'sight',

  // --- activities ---
  cinema: 'activity',
  theatre: 'activity',
  nightclub: 'activity',
  casino: 'activity',
  spa: 'activity',
  sports_centre: 'activity',
  fitness_centre: 'activity',
  stadium: 'activity',
  pitch: 'activity',
  swimming_pool: 'activity',
  water_park: 'activity',
  golf_course: 'activity',
  marina: 'activity',

  // --- transport ---
  bus_station: 'transport',
  bus_stop: 'transport',
  bus: 'transport',
  railway_station: 'transport',
  railway: 'transport',
  station: 'transport',
  subway_entrance: 'transport',
  tram_stop: 'transport',
  airport: 'transport',
  aerodrome: 'transport',
  ferry_terminal: 'transport',
  harbor: 'transport',
  taxi: 'transport',
  car_rental: 'transport',
  bicycle_rental: 'transport',
  parking: 'transport',
  fuel: 'transport',
};

/**
 * Resolve a {@link PoiCategory} from one or more OSM/OMT descriptors. Pass the
 * most specific descriptor first (e.g. `type`/`subclass` before `class`);
 * returns `'other'` when nothing matches.
 */
export function poiCategoryFromTags(
  ...descriptors: Array<string | null | undefined>
): PoiCategory {
  for (const raw of descriptors) {
    if (!raw) continue;
    const hit = TOKEN_TO_CATEGORY[raw.trim().toLowerCase()];
    if (hit) return hit;
  }
  return 'other';
}
