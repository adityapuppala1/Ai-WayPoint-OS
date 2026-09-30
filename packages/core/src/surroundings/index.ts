/**
 * Surroundings: weather, air quality and sun, turned into plain advice. The data comes from
 * Open-Meteo (free, no key, CC BY 4.0) and is fetched by the person's own device, so Waypoint's
 * servers never learn where they are. Everything here is pure and works offline on cached data.
 *
 * Thresholds and their sources:
 *  - Heat: US National Weather Service heat index bands (caution 80 °F / 26.7 °C, extreme
 *    caution 90 °F / 32.2 °C, danger 103 °F / 39.4 °C, extreme danger 125 °F / 51.7 °C),
 *    applied to Open-Meteo's apparent ("feels like") temperature.
 *  - Cold: at a wind chill of −19 °F (−28 °C) exposed skin can freeze in 30 minutes (NWS).
 *  - Air: US EPA Air Quality Index categories.
 *  - UV: WHO UV index advice (0–2 low, 3–7 protect yourself, 8+ extra protection).
 *  - Wind: gale force on the Beaufort scale (gusts of 62 km/h and more).
 */

export const OPEN_METEO = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  air: 'https://air-quality-api.open-meteo.com/v1/air-quality',
  geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
  attribution: 'https://open-meteo.com/',
} as const;

/** About 1 km. Enough for weather; not enough to find someone's home. */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export function forecastUrl(latitude: number, longitude: number): string {
  const q = new URLSearchParams({
    latitude: String(roundCoord(latitude)),
    longitude: String(roundCoord(longitude)),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day',
    hourly:
      'temperature_2m,apparent_temperature,precipitation_probability,weather_code,uv_index,wind_gusts_10m',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,uv_index_max,wind_gusts_10m_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '3',
  });
  return `${OPEN_METEO.forecast}?${q}`;
}

export function airUrl(latitude: number, longitude: number): string {
  const q = new URLSearchParams({
    latitude: String(roundCoord(latitude)),
    longitude: String(roundCoord(longitude)),
    current: 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide',
    hourly: 'us_aqi',
    timezone: 'auto',
    forecast_days: '2',
  });
  return `${OPEN_METEO.air}?${q}`;
}

export function geocodeUrl(name: string, language = 'en'): string {
  const q = new URLSearchParams({
    name: name.trim().slice(0, 80),
    count: '6',
    language,
    format: 'json',
  });
  return `${OPEN_METEO.geocoding}?${q}`;
}

// ───────────────────────────── Parsing ─────────────────────────────

export interface Place {
  label: string;
  latitude: number;
  longitude: number;
  country?: string;
  /** Region or state, to tell places with the same name apart. */
  region?: string;
}

export interface Weather {
  timezone: string;
  current: {
    time: string;
    temperature: number;
    apparent: number;
    humidity: number | null;
    precipitation: number;
    code: number;
    wind: number;
    gusts: number | null;
    isDay: boolean;
  };
  hours: Array<{
    time: string;
    temperature: number;
    apparent: number | null;
    precipitationChance: number | null;
    code: number;
    uv: number | null;
    gusts: number | null;
  }>;
  days: Array<{
    date: string;
    code: number;
    max: number;
    min: number;
    apparentMax: number | null;
    apparentMin: number | null;
    precipitation: number | null;
    precipitationChance: number | null;
    uvMax: number | null;
    gustsMax: number | null;
    sunrise: string | null;
    sunset: string | null;
  }>;
}

export interface Air {
  current: {
    time: string;
    usAqi: number | null;
    pm25: number | null;
    pm10: number | null;
    ozone: number | null;
    no2: number | null;
  };
  /** Highest US AQI expected over the next 24 hours. */
  peak24: number | null;
}

type Json = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (o: unknown, k: string): unknown[] =>
  o && typeof o === 'object' && Array.isArray((o as Json)[k]) ? ((o as Json)[k] as unknown[]) : [];

export function parseGeocoding(json: unknown): Place[] {
  return arr(json, 'results')
    .map((r) => r as Json)
    .filter((r) => num(r.latitude) !== null && num(r.longitude) !== null)
    .map((r) => ({
      label: String(r.name ?? ''),
      latitude: roundCoord(r.latitude as number),
      longitude: roundCoord(r.longitude as number),
      country: typeof r.country_code === 'string' ? r.country_code.toUpperCase() : undefined,
      region:
        typeof r.admin1 === 'string'
          ? r.admin1
          : typeof r.country === 'string'
            ? r.country
            : undefined,
    }))
    .filter((p) => p.label);
}

/** Read an Open-Meteo forecast response; throws if the essentials are missing. */
export function parseForecast(json: unknown): Weather {
  const o = (json ?? {}) as Json;
  const c = (o.current ?? {}) as Json;
  const temperature = num(c.temperature_2m);
  const code = num(c.weather_code);
  if (temperature === null || code === null) throw new Error('Weather data is incomplete');
  const h = (o.hourly ?? {}) as Json;
  const d = (o.daily ?? {}) as Json;
  const at = (k: string, i: number) => num(arr(h, k)[i]);
  const dat = (k: string, i: number) => num(arr(d, k)[i]);
  return {
    timezone: typeof o.timezone === 'string' ? o.timezone : 'UTC',
    current: {
      time: String(c.time ?? ''),
      temperature,
      apparent: num(c.apparent_temperature) ?? temperature,
      humidity: num(c.relative_humidity_2m),
      precipitation: num(c.precipitation) ?? 0,
      code,
      wind: num(c.wind_speed_10m) ?? 0,
      gusts: num(c.wind_gusts_10m),
      isDay: c.is_day !== 0,
    },
    hours: arr(h, 'time').map((t, i) => ({
      time: String(t),
      temperature: at('temperature_2m', i) ?? temperature,
      apparent: at('apparent_temperature', i),
      precipitationChance: at('precipitation_probability', i),
      code: at('weather_code', i) ?? code,
      uv: at('uv_index', i),
      gusts: at('wind_gusts_10m', i),
    })),
    days: arr(d, 'time').map((t, i) => ({
      date: String(t),
      code: dat('weather_code', i) ?? code,
      max: dat('temperature_2m_max', i) ?? temperature,
      min: dat('temperature_2m_min', i) ?? temperature,
      apparentMax: dat('apparent_temperature_max', i),
      apparentMin: dat('apparent_temperature_min', i),
      precipitation: dat('precipitation_sum', i),
      precipitationChance: dat('precipitation_probability_max', i),
      uvMax: dat('uv_index_max', i),
      gustsMax: dat('wind_gusts_10m_max', i),
      sunrise: typeof arr(d, 'sunrise')[i] === 'string' ? (arr(d, 'sunrise')[i] as string) : null,
      sunset: typeof arr(d, 'sunset')[i] === 'string' ? (arr(d, 'sunset')[i] as string) : null,
    })),
  };
}

export function parseAir(json: unknown, now?: string): Air {
  const o = (json ?? {}) as Json;
  const c = (o.current ?? {}) as Json;
  const h = (o.hourly ?? {}) as Json;
  const times = arr(h, 'time').map(String);
  const values = arr(h, 'us_aqi').map(num);
  const from = now ?? String(c.time ?? '');
  const start = Math.max(
    0,
    times.findIndex((t) => t >= from.slice(0, 13)),
  );
  const next = values.slice(start, start + 24).filter((v): v is number => v !== null);
  return {
    current: {
      time: String(c.time ?? ''),
      usAqi: num(c.us_aqi),
      pm25: num(c.pm2_5),
      pm10: num(c.pm10),
      ozone: num(c.ozone),
      no2: num(c.nitrogen_dioxide),
    },
    peak24: next.length ? Math.max(...next) : null,
  };
}

/** The next `count` hours from now (Open-Meteo's hourly data starts at local midnight). */
export function upcomingHours(weather: Weather, count = 24): Weather['hours'] {
  const hour = weather.current.time.slice(0, 13);
  const from = hour ? weather.hours.findIndex((h) => h.time.slice(0, 13) >= hour) : 0;
  return weather.hours.slice(Math.max(0, from), Math.max(0, from) + count);
}

// ───────────────────────────── Meaning ─────────────────────────────

export type WeatherKind =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'freezing'
  | 'snow'
  | 'storm';

/** WMO weather interpretation codes, as used by Open-Meteo. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code === 56 || code === 57 || code === 66 || code === 67) return 'freezing';
  if (code >= 51 && code <= 55) return 'drizzle';
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

export type AqiLevel =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very-unhealthy'
  | 'hazardous';

/** US EPA Air Quality Index categories. */
export function aqiLevel(usAqi: number): AqiLevel {
  if (usAqi <= 50) return 'good';
  if (usAqi <= 100) return 'moderate';
  if (usAqi <= 150) return 'sensitive';
  if (usAqi <= 200) return 'unhealthy';
  if (usAqi <= 300) return 'very-unhealthy';
  return 'hazardous';
}

export type UvLevel = 'low' | 'protect' | 'extra';

/** WHO: 0–2 enjoy being outside; 3–7 protect yourself; 8+ avoid the midday sun. */
export function uvLevel(uv: number): UvLevel {
  if (uv < 2.5) return 'low';
  if (uv < 7.5) return 'protect';
  return 'extra';
}

export type HeatLevel = 'caution' | 'extreme-caution' | 'danger' | 'extreme-danger';

/** NWS heat index bands, applied to the "feels like" temperature in °C. */
export function heatLevel(apparentC: number): HeatLevel | null {
  if (apparentC >= 51.7) return 'extreme-danger';
  if (apparentC >= 39.4) return 'danger';
  if (apparentC >= 32.2) return 'extreme-caution';
  if (apparentC >= 26.7) return 'caution';
  return null;
}

export type AdviceId =
  | 'heat'
  | 'heat-danger'
  | 'cold'
  | 'cold-danger'
  | 'storm'
  | 'wind'
  | 'uv'
  | 'uv-extra'
  | 'air'
  | 'air-danger'
  | 'rain';

export interface Advice {
  id: AdviceId;
  severity: 'info' | 'caution' | 'danger';
}

const RANK = { danger: 0, caution: 1, info: 2 } as const;

/** Plain advice for now and the next 24 hours, most serious first. None means a calm day. */
export function advise(weather: Weather, air?: Air | null): Advice[] {
  const out: Advice[] = [];
  const today = weather.days[0];
  const next24 = upcomingHours(weather, 24);
  const hottest = Math.max(
    weather.current.apparent,
    today?.apparentMax ?? Number.NEGATIVE_INFINITY,
    ...next24.map((h) => h.apparent ?? Number.NEGATIVE_INFINITY),
  );
  const coldest = Math.min(
    weather.current.apparent,
    today?.apparentMin ?? Number.POSITIVE_INFINITY,
    ...next24.map((h) => h.apparent ?? Number.POSITIVE_INFINITY),
  );
  const heat = heatLevel(hottest);
  if (heat === 'danger' || heat === 'extreme-danger')
    out.push({ id: 'heat-danger', severity: 'danger' });
  else if (heat === 'extreme-caution') out.push({ id: 'heat', severity: 'caution' });

  if (coldest <= -28) out.push({ id: 'cold-danger', severity: 'danger' });
  else if (coldest <= 0) out.push({ id: 'cold', severity: 'caution' });

  const codes = [weather.current.code, today?.code ?? 0, ...next24.map((h) => h.code)];
  if (codes.some((c) => c >= 95)) out.push({ id: 'storm', severity: 'caution' });
  else if ((today?.precipitation ?? 0) >= 20 || codes.some((c) => c === 65 || c === 67 || c === 82))
    out.push({ id: 'rain', severity: 'info' });

  const gusts = Math.max(weather.current.gusts ?? 0, ...next24.map((h) => h.gusts ?? 0));
  if (gusts >= 62) out.push({ id: 'wind', severity: 'caution' });

  const uv = Math.max(today?.uvMax ?? 0, ...next24.map((h) => h.uv ?? 0));
  const uvl = uvLevel(uv);
  if (uvl === 'extra') out.push({ id: 'uv-extra', severity: 'caution' });
  else if (uvl === 'protect') out.push({ id: 'uv', severity: 'info' });

  const aqi = Math.max(air?.current.usAqi ?? 0, air?.peak24 ?? 0);
  if (aqi > 150) out.push({ id: 'air-danger', severity: 'danger' });
  else if (aqi > 100) out.push({ id: 'air', severity: 'caution' });

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

// ───────────────────────────── Units ─────────────────────────────

/** Countries that use °F day to day. */
const FAHRENHEIT = new Set([
  'US',
  'PR',
  'GU',
  'VI',
  'AS',
  'MP',
  'UM',
  'BS',
  'BZ',
  'KY',
  'PW',
  'FM',
  'MH',
  'LR',
]);

export function usesFahrenheit(country?: string | null): boolean {
  return FAHRENHEIT.has((country ?? '').toUpperCase());
}

export const toFahrenheit = (c: number): number => (c * 9) / 5 + 32;
export const toMph = (kmh: number): number => kmh / 1.609344;
