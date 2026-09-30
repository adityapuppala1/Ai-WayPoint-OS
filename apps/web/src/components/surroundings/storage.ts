/**
 * Surroundings keeps the chosen place and the last forecast on this device only (localStorage),
 * so Waypoint's servers never learn where someone is. Every access is guarded: storage can be
 * missing or blocked (private windows, strict settings) and the page must still work.
 */
import type { Air, Place, Weather } from '@waypoint/core/surroundings';

const PLACE_KEY = 'wp-place';
const CACHE_KEY = 'wp-surroundings';
const UNITS_KEY = 'wp-units';

export interface Cached {
  /** `lat,lon` of the place the data is for. */
  key: string;
  fetchedAt: number;
  weather: Weather;
  air: Air | null;
}

export type Units = 'metric' | 'imperial';

export const placeKey = (p: Pick<Place, 'latitude' | 'longitude'>) =>
  `${p.latitude.toFixed(2)},${p.longitude.toFixed(2)}`;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the page still works for this visit.
  }
}

export const loadPlace = () => read<Place>(PLACE_KEY);
export const savePlace = (p: Place | null) => write(PLACE_KEY, p);
export const loadCache = () => read<Cached>(CACHE_KEY);
export const saveCache = (c: Cached | null) => write(CACHE_KEY, c);
export const loadUnits = () => read<Units>(UNITS_KEY);
export const saveUnits = (u: Units) => write(UNITS_KEY, u);

/** Forecasts older than this are fetched again when the page opens. */
export const FRESH_MS = 30 * 60_000;
