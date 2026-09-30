import { describe, expect, it } from 'vitest';
import {
  clampMetric,
  formatSchedule,
  healthWeek,
  nextOccurrence,
  parseSchedule,
  zonedTime,
} from '../src/health';
import {
  advise,
  airUrl,
  aqiLevel,
  forecastUrl,
  geocodeUrl,
  heatLevel,
  parseAir,
  parseForecast,
  parseGeocoding,
  roundCoord,
  usesFahrenheit,
  uvLevel,
  type Weather,
  weatherKind,
} from '../src/surroundings';

const at = (iso: string) => new Date(iso);

describe('health', () => {
  it('keeps logged values sensible', () => {
    expect(clampMetric('sleep', 7.3)).toBe(7.5);
    expect(clampMetric('sleep', 40)).toBe(16);
    expect(clampMetric('activity', 33)).toBe(35);
    expect(clampMetric('water', -2)).toBe(0);
  });

  it('summarises the last seven days', () => {
    const w = healthWeek(
      [
        { kind: 'sleep', value: 6, date: '2026-09-29' },
        { kind: 'sleep', value: 8, date: '2026-09-27' },
        { kind: 'activity', value: 30, date: '2026-09-28' },
        { kind: 'activity', value: 45, date: '2026-09-23' },
        { kind: 'activity', value: 90, date: '2026-09-20' }, // older than a week
        { kind: 'note', value: null, date: '2026-09-29' },
      ],
      '2026-09-29',
    );
    expect(w.days.map((d) => d.date)).toEqual([
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
    ]);
    expect(w.activityTotal).toBe(75);
    expect(w.sleepAverage).toBe(7);
    expect(w.loggedDays).toBe(4);
  });

  it('stores schedules in a small, readable format', () => {
    const s = { repeat: 'quarterly' as const, date: '2026-10-01', time: '09:30' };
    expect(formatSchedule(s)).toBe('DTSTART=20261001T0930;REPEAT=quarterly');
    expect(parseSchedule(formatSchedule(s))).toEqual(s);
    expect(parseSchedule('FREQ=DAILY')).toBeNull();
    expect(parseSchedule('DTSTART=20261001T0930;REPEAT=hourly')).toBeNull();
  });

  it('turns wall-clock times into instants in the person’s zone', () => {
    expect(zonedTime('2026-10-01', '09:00', 'Asia/Kolkata').toISOString()).toBe(
      '2026-10-01T03:30:00.000Z',
    );
    // New York is on summer time in July and standard time in December.
    expect(zonedTime('2026-07-01', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-07-01T13:00:00.000Z',
    );
    expect(zonedTime('2026-12-01', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-12-01T14:00:00.000Z',
    );
  });

  it('finds the next reminder, keeping 9:00 at 9:00 across clock changes', () => {
    const daily = { repeat: 'daily' as const, date: '2026-10-30', time: '09:00' };
    // London moves from summer time to GMT on 25 October 2026.
    expect(nextOccurrence(daily, at('2026-11-02T12:00:00Z'), 'Europe/London')?.toISOString()).toBe(
      '2026-11-03T09:00:00.000Z',
    );
    const early = { repeat: 'daily' as const, date: '2026-10-20', time: '09:00' };
    expect(nextOccurrence(early, at('2026-10-24T09:00:00Z'), 'Europe/London')?.toISOString()).toBe(
      '2026-10-25T09:00:00.000Z', // 9:00 GMT on the day the clocks go back
    );
    expect(nextOccurrence(early, at('2026-10-21T07:00:00Z'), 'Europe/London')?.toISOString()).toBe(
      '2026-10-21T08:00:00.000Z', // 9:00 BST
    );
  });

  it('handles one-off, weekly and monthly reminders', () => {
    const once = { repeat: 'once' as const, date: '2026-10-05', time: '08:00' };
    expect(nextOccurrence(once, at('2026-10-01T00:00:00Z'))?.toISOString()).toBe(
      '2026-10-05T08:00:00.000Z',
    );
    expect(nextOccurrence(once, at('2026-10-06T00:00:00Z'))).toBeNull();

    const weekly = { repeat: 'weekly' as const, date: '2026-09-07', time: '18:00' }; // Mondays
    expect(nextOccurrence(weekly, at('2026-09-29T10:00:00Z'))?.toISOString()).toBe(
      '2026-10-05T18:00:00.000Z',
    );

    // The 31st becomes the last day of shorter months, then goes back to the 31st.
    const monthly = { repeat: 'monthly' as const, date: '2026-01-31', time: '10:00' };
    expect(nextOccurrence(monthly, at('2026-02-01T00:00:00Z'))?.toISOString()).toBe(
      '2026-02-28T10:00:00.000Z',
    );
    expect(nextOccurrence(monthly, at('2026-03-01T00:00:00Z'))?.toISOString()).toBe(
      '2026-03-31T10:00:00.000Z',
    );
    const yearly = { repeat: 'yearly' as const, date: '2024-03-15', time: '09:00' };
    expect(nextOccurrence(yearly, at('2026-09-29T00:00:00Z'))?.toISOString()).toBe(
      '2027-03-15T09:00:00.000Z',
    );
    const halfYearly = { repeat: 'half-yearly' as const, date: '2026-01-10', time: '09:00' };
    expect(nextOccurrence(halfYearly, at('2026-07-10T09:00:00Z'), 'UTC')?.toISOString()).toBe(
      '2027-01-10T09:00:00.000Z',
    );
  });
});

const forecastJson = {
  timezone: 'Asia/Kolkata',
  current: {
    time: '2026-09-29T14:00',
    temperature_2m: 34.1,
    apparent_temperature: 41.2,
    relative_humidity_2m: 62,
    precipitation: 0,
    weather_code: 2,
    wind_speed_10m: 12.4,
    wind_gusts_10m: 30.1,
    is_day: 1,
  },
  hourly: {
    time: ['2026-09-29T14:00', '2026-09-29T15:00', '2026-09-29T16:00'],
    temperature_2m: [34.1, 34.5, 33.8],
    apparent_temperature: [41.2, 42.0, 40.1],
    precipitation_probability: [10, 20, 60],
    weather_code: [2, 3, 95],
    uv_index: [9.1, 7.2, 4.0],
    wind_gusts_10m: [30, 65, 40],
  },
  daily: {
    time: ['2026-09-29', '2026-09-30', '2026-10-01'],
    weather_code: [95, 61, 1],
    temperature_2m_max: [35, 31, 32],
    temperature_2m_min: [27, 26, 26],
    apparent_temperature_max: [42, 36, 37],
    apparent_temperature_min: [30, 29, 29],
    precipitation_sum: [12.5, 30, 0],
    precipitation_probability_max: [70, 90, 10],
    uv_index_max: [9.5, 6, 8],
    wind_gusts_10m_max: [40, 70, 20],
    sunrise: ['2026-09-29T06:21', '2026-09-30T06:21', '2026-10-01T06:22'],
    sunset: ['2026-09-29T18:24', '2026-09-30T18:23', '2026-10-01T18:22'],
  },
};

describe('surroundings', () => {
  it('rounds coordinates to about a kilometre before anything is fetched', () => {
    expect(roundCoord(19.076_09)).toBe(19.08);
    expect(forecastUrl(19.076_09, 72.877_65)).toContain('latitude=19.08&longitude=72.88');
    expect(airUrl(-1.2921, 36.8219)).toContain('latitude=-1.29&longitude=36.82');
    expect(geocodeUrl(' Nairobi ', 'sw')).toContain('name=Nairobi');
    expect(geocodeUrl('Nairobi', 'sw')).toContain('language=sw');
  });

  it('reads forecasts, air quality and place search results', () => {
    const w = parseForecast(forecastJson);
    expect(w.current.apparent).toBe(41.2);
    expect(w.hours).toHaveLength(3);
    expect(w.days[1]?.precipitation).toBe(30);
    expect(() => parseForecast({ current: {} })).toThrow();

    const a = parseAir(
      {
        current: { time: '2026-09-29T14:00', us_aqi: 88, pm2_5: 31.5 },
        hourly: {
          time: ['2026-09-29T13:00', '2026-09-29T14:00', '2026-09-29T15:00'],
          us_aqi: [70, 88, 162],
        },
      },
      '2026-09-29T14:00',
    );
    expect(a.current.usAqi).toBe(88);
    expect(a.peak24).toBe(162);

    const places = parseGeocoding({
      results: [
        {
          name: 'Pune',
          latitude: 18.519_57,
          longitude: 73.855_35,
          country_code: 'in',
          admin1: 'Maharashtra',
        },
        { name: 'Nowhere' },
      ],
    });
    expect(places).toEqual([
      { label: 'Pune', latitude: 18.52, longitude: 73.86, country: 'IN', region: 'Maharashtra' },
    ]);
    expect(parseGeocoding({})).toEqual([]);
  });

  it('names the weather and the levels people act on', () => {
    expect(weatherKind(0)).toBe('clear');
    expect(weatherKind(2)).toBe('partly');
    expect(weatherKind(45)).toBe('fog');
    expect(weatherKind(66)).toBe('freezing');
    expect(weatherKind(81)).toBe('rain');
    expect(weatherKind(86)).toBe('snow');
    expect(weatherKind(99)).toBe('storm');
    expect(aqiLevel(42)).toBe('good');
    expect(aqiLevel(101)).toBe('sensitive');
    expect(aqiLevel(151)).toBe('unhealthy');
    expect(aqiLevel(301)).toBe('hazardous');
    expect(uvLevel(2)).toBe('low');
    expect(uvLevel(5)).toBe('protect');
    expect(uvLevel(8)).toBe('extra');
    expect(heatLevel(25)).toBeNull();
    expect(heatLevel(33)).toBe('extreme-caution');
    expect(heatLevel(40)).toBe('danger');
  });

  it('gives the most serious advice first, and none on a calm day', () => {
    const w = parseForecast(forecastJson);
    const air = parseAir({ current: { us_aqi: 120 }, hourly: { time: [], us_aqi: [] } });
    const ids = advise(w, air).map((a) => a.id);
    expect(ids[0]).toBe('heat-danger');
    expect(ids).toEqual(expect.arrayContaining(['storm', 'wind', 'uv-extra', 'air']));
    expect(ids).not.toContain('cold');

    const calm: Weather = {
      timezone: 'UTC',
      current: {
        time: '',
        temperature: 18,
        apparent: 18,
        humidity: 50,
        precipitation: 0,
        code: 1,
        wind: 8,
        gusts: 15,
        isDay: true,
      },
      hours: [],
      days: [
        {
          date: '2026-09-29',
          code: 1,
          max: 20,
          min: 12,
          apparentMax: 20,
          apparentMin: 11,
          precipitation: 0,
          precipitationChance: 5,
          uvMax: 2,
          gustsMax: 20,
          sunrise: null,
          sunset: null,
        },
      ],
    };
    expect(advise(calm, null)).toEqual([]);
    expect(advise({ ...calm, current: { ...calm.current, apparent: -30 } }, null)[0]?.id).toBe(
      'cold-danger',
    );
  });

  it('uses Fahrenheit only where people do', () => {
    expect(usesFahrenheit('US')).toBe(true);
    expect(usesFahrenheit('lr')).toBe(true);
    expect(usesFahrenheit('IN')).toBe(false);
    expect(usesFahrenheit(null)).toBe(false);
  });
});

describe('surroundings hours', () => {
  it('starts the hourly view at the current hour', async () => {
    const { upcomingHours } = await import('../src/surroundings');
    const w = parseForecast({
      ...forecastJson,
      current: { ...forecastJson.current, time: '2026-09-29T15:15' },
    });
    expect(upcomingHours(w, 2).map((h) => h.time)).toEqual([
      '2026-09-29T15:00',
      '2026-09-29T16:00',
    ]);
  });
});
