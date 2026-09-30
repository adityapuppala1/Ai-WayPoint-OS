'use client';

import {
  type Advice,
  type Air,
  advise,
  airUrl,
  aqiLevel,
  forecastUrl,
  type Place,
  parseAir,
  parseForecast,
  toFahrenheit,
  toMph,
  upcomingHours,
  uvLevel,
  type WeatherKind,
  weatherKind,
} from '@waypoint/core/surroundings';
import { Button, Icon, type IconName, Notice, Panel, Segmented, Skeleton } from '@waypoint/ui';
import { type DateTimeFormatOptions, useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { PlacePicker } from './PlacePicker';
import {
  type Cached,
  FRESH_MS,
  loadCache,
  loadPlace,
  loadUnits,
  placeKey,
  saveCache,
  savePlace,
  saveUnits,
  type Units,
} from './storage';
import styles from './surroundings.module.css';

const KIND_ICON: Record<WeatherKind, [day: IconName, night: IconName]> = {
  clear: ['wxClear', 'wxClearNight'],
  partly: ['wxPartly', 'wxPartlyNight'],
  cloudy: ['wxCloudy', 'wxCloudy'],
  fog: ['wxFog', 'wxFog'],
  drizzle: ['wxRain', 'wxRain'],
  rain: ['wxRain', 'wxRain'],
  freezing: ['wxRain', 'wxRain'],
  snow: ['wxSnow', 'wxSnow'],
  storm: ['wxStorm', 'wxStorm'],
};

export const weatherIcon = (code: number, isDay = true): IconName => {
  const pair = KIND_ICON[weatherKind(code)];
  return isDay ? pair[0] : pair[1];
};

type State =
  | { status: 'idle' }
  | { status: 'loading'; cached: Cached | null }
  | { status: 'ready'; data: Cached; offline: boolean }
  | { status: 'error' };

async function fetchConditions(place: Place): Promise<Cached> {
  const [w, a] = await Promise.all([
    fetch(forecastUrl(place.latitude, place.longitude)),
    fetch(airUrl(place.latitude, place.longitude)).catch(() => null),
  ]);
  if (!w.ok) throw new Error(`forecast ${w.status}`);
  const weather = parseForecast(await w.json());
  let air: Air | null = null;
  if (a?.ok) {
    try {
      air = parseAir(await a.json(), weather.current.time);
    } catch {
      air = null;
    }
  }
  return { key: placeKey(place), fetchedAt: Date.now(), weather, air };
}

/**
 * Surroundings, fetched by the browser from Open-Meteo. The place and the last forecast are kept
 * on this device only; when the network is down the last forecast is shown with its time.
 */
export function SurroundingsView({
  imperialDefault,
  sources,
}: {
  imperialDefault: boolean;
  sources: Array<{ url: string; title: string }>;
}) {
  const t = useTranslations('surroundings');
  const format = useFormatter();
  const [mounted, setMounted] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [picking, setPicking] = useState(false);
  const [units, setUnits] = useState<Units>(imperialDefault ? 'imperial' : 'metric');
  const [state, setState] = useState<State>({ status: 'idle' });

  const load = useCallback(async (p: Place, force = false) => {
    const cached = loadCache();
    const sameCached = cached && cached.key === placeKey(p) ? cached : null;
    if (!force && sameCached && Date.now() - sameCached.fetchedAt < FRESH_MS) {
      setState({ status: 'ready', data: sameCached, offline: false });
      return;
    }
    setState({ status: 'loading', cached: sameCached });
    try {
      const data = await fetchConditions(p);
      saveCache(data);
      setState({ status: 'ready', data, offline: false });
    } catch {
      setState(
        sameCached ? { status: 'ready', data: sameCached, offline: true } : { status: 'error' },
      );
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    const saved = loadPlace();
    const savedUnits = loadUnits();
    if (savedUnits) setUnits(savedUnits);
    if (saved) {
      setPlace(saved);
      void load(saved);
    }
  }, [load]);

  const choose = (p: Place) => {
    savePlace(p);
    setPlace(p);
    setPicking(false);
    void load(p, true);
  };

  const temp = (c: number) =>
    format.number(Math.round(units === 'imperial' ? toFahrenheit(c) : c), {
      style: 'unit',
      unit: units === 'imperial' ? 'fahrenheit' : 'celsius',
    });
  const speed = (kmh: number) =>
    format.number(Math.round(units === 'imperial' ? toMph(kmh) : kmh), {
      style: 'unit',
      unit: units === 'imperial' ? 'mile-per-hour' : 'kilometer-per-hour',
    });
  // Open-Meteo times are the place's own wall clock ("2026-09-29T14:00"), so show them as-is.
  const wall = (iso: string, opts: DateTimeFormatOptions) => {
    const full = iso.length === 10 ? `${iso}T12:00:00` : iso.length === 16 ? `${iso}:00` : iso;
    const at = new Date(`${full}Z`);
    return Number.isNaN(at.getTime()) ? '' : format.dateTime(at, { ...opts, timeZone: 'UTC' });
  };

  if (!mounted) {
    return (
      <Panel as="section">
        <Skeleton height="8rem" />
      </Panel>
    );
  }

  if (!place || picking) {
    return (
      <Panel title={t('whereTitle')} description={t('whereLead')} as="section">
        <PlacePicker onPick={choose} onCancel={place ? () => setPicking(false) : undefined} />
      </Panel>
    );
  }

  const data =
    state.status === 'ready' ? state.data : state.status === 'loading' ? state.cached : null;

  return (
    <>
      <div className={styles.placeBar}>
        <p className={styles.placeName}>
          <Icon name="place" size={18} />
          <span dir="auto">{place.label}</span>
          {place.region ? <span className={styles.placeRegion}>{place.region}</span> : null}
        </p>
        <div className={styles.placeActions}>
          <Segmented
            label={t('units')}
            value={units}
            onChange={(v) => {
              setUnits(v as Units);
              saveUnits(v as Units);
            }}
            options={[
              { id: 'metric', label: '°C' },
              { id: 'imperial', label: '°F' },
            ]}
          />
          <Button variant="quiet" size="sm" icon="edit" onPress={() => setPicking(true)}>
            {t('changePlace')}
          </Button>
        </div>
      </div>

      {state.status === 'ready' && state.offline ? (
        <Notice
          tone="caution"
          title={t('offline', {
            time: format.dateTime(new Date(state.data.fetchedAt), {
              weekday: 'short',
              hour: 'numeric',
              minute: '2-digit',
            }),
          })}
        />
      ) : null}

      {state.status === 'error' ? (
        <Notice
          tone="caution"
          title={t('failed')}
          actions={
            <Button size="sm" icon="retry" onPress={() => void load(place, true)}>
              {t('retry')}
            </Button>
          }
        />
      ) : null}

      {!data ? (
        state.status === 'loading' ? (
          <Panel as="section" aria-label={t('loading')}>
            <Skeleton height="10rem" />
          </Panel>
        ) : null
      ) : (
        <Conditions
          data={data}
          busy={state.status === 'loading'}
          temp={temp}
          speed={speed}
          wall={wall}
          sources={sources}
        />
      )}
    </>
  );
}

function Conditions({
  data,
  busy,
  temp,
  speed,
  wall,
  sources,
}: {
  data: Cached;
  busy: boolean;
  temp: (c: number) => string;
  speed: (kmh: number) => string;
  wall: (iso: string, opts: DateTimeFormatOptions) => string;
  sources: Array<{ url: string; title: string }>;
}) {
  const t = useTranslations('surroundings');
  const format = useFormatter();
  const { weather, air } = data;
  const c = weather.current;
  const kind = weatherKind(c.code);
  const advice: Advice[] = advise(weather, air);
  const today = weather.days[0];
  const hours = upcomingHours(weather, 12);
  const uvMax = today?.uvMax ?? null;
  const aqi = air?.current.usAqi ?? null;
  const percent = (v: number) => format.number(v / 100, { style: 'percent' });

  return (
    <div className="wp-stack" aria-busy={busy}>
      <Panel as="section" title={t('now')}>
        <div className={styles.now}>
          <Icon name={weatherIcon(c.code, c.isDay)} size={56} className={styles.nowIcon} />
          <div className={styles.nowText}>
            <p className={styles.nowTemp}>{temp(c.temperature)}</p>
            <p className={styles.nowKind}>{t(`kinds.${kind}`)}</p>
            <p className="wp-secondary">{t('feelsLike', { temp: temp(c.apparent) })}</p>
          </div>
        </div>
        <ul className={styles.facts}>
          <li>
            <Icon name="air" size={16} />
            {t('wind', { speed: speed(c.wind) })}
            {c.gusts && c.gusts > c.wind + 10 ? `, ${t('gusts', { speed: speed(c.gusts) })}` : ''}
          </li>
          {c.humidity !== null ? (
            <li>
              <Icon name="water" size={16} />
              {t('humidity', { value: percent(c.humidity) })}
            </li>
          ) : null}
          <li className="wp-meta">
            {t('updated', {
              time: format.dateTime(new Date(data.fetchedAt), {
                hour: 'numeric',
                minute: '2-digit',
              }),
            })}
          </li>
        </ul>
      </Panel>

      <Panel as="section" title={t('adviceTitle')}>
        {advice.length ? (
          <ul className={styles.advice}>
            {advice.map((a) => (
              <li key={a.id} className={styles.adviceItem} data-severity={a.severity}>
                <Icon
                  name={
                    a.severity === 'danger'
                      ? 'danger'
                      : a.severity === 'caution'
                        ? 'caution'
                        : 'info'
                  }
                  size={20}
                  weight="fill"
                />
                <div>
                  <p className={styles.adviceTitle}>{t(`advice.${a.id}.title`)}</p>
                  <p className="wp-secondary">{t(`advice.${a.id}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-secondary">{t('calm')}</p>
        )}
      </Panel>

      <div className={styles.pair}>
        <Panel as="section" title={t('airTitle')}>
          {aqi !== null ? (
            <div className={styles.gauge}>
              <p className={styles.gaugeValue} data-level={aqiLevel(aqi)}>
                {t(`aqiLevels.${aqiLevel(aqi)}`)}
              </p>
              <p className="wp-secondary">{t('aqi', { value: format.number(Math.round(aqi)) })}</p>
              {air?.peak24 !== null && air?.peak24 !== undefined && air.peak24 > aqi ? (
                <p className="wp-meta">
                  {t('aqiPeak', { value: format.number(Math.round(air.peak24)) })}
                </p>
              ) : null}
              <p className="wp-meta">{t('aqiScale')}</p>
            </div>
          ) : (
            <p className="wp-secondary">{t('airNone')}</p>
          )}
        </Panel>
        <Panel as="section" title={t('sunTitle')}>
          <div className={styles.gauge}>
            {uvMax !== null ? (
              <>
                <p className={styles.gaugeValue} data-uv={uvLevel(uvMax)}>
                  {t(`uvLevels.${uvLevel(uvMax)}`)}
                </p>
                <p className="wp-secondary">
                  {t('uvToday', { value: format.number(Math.round(uvMax)) })}
                </p>
              </>
            ) : null}
            {today?.sunrise ? (
              <p className="wp-meta">
                {t('sunrise', {
                  time: wall(today.sunrise, { hour: 'numeric', minute: '2-digit' }),
                })}
              </p>
            ) : null}
            {today?.sunset ? (
              <p className="wp-meta">
                {t('sunset', { time: wall(today.sunset, { hour: 'numeric', minute: '2-digit' }) })}
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      {hours.length ? (
        <Panel as="section" title={t('hoursTitle')}>
          <ol className={styles.hours}>
            {hours.map((h) => (
              <li key={h.time} className={styles.hour}>
                <span className={styles.hourTime}>{wall(h.time, { hour: 'numeric' })}</span>
                <Icon name={weatherIcon(h.code)} size={24} />
                <span className={styles.hourTemp}>{temp(h.temperature)}</span>
                {h.precipitationChance !== null && h.precipitationChance >= 20 ? (
                  <span className={styles.hourRain}>
                    <Icon name="water" size={12} />
                    <span className="wp-visually-hidden">
                      {t('rainChance', { value: percent(h.precipitationChance) })}
                    </span>
                    <span aria-hidden="true">{percent(h.precipitationChance)}</span>
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}

      {weather.days.length ? (
        <Panel as="section" title={t('daysTitle')} flush>
          <ul className={styles.days}>
            {weather.days.map((d, i) => (
              <li key={d.date} className={styles.day}>
                <span className={styles.dayName}>
                  {i === 0
                    ? t('today')
                    : i === 1
                      ? t('tomorrow')
                      : wall(d.date, { weekday: 'long' })}
                </span>
                <Icon name={weatherIcon(d.code)} size={24} />
                <span className={styles.dayKind}>{t(`kinds.${weatherKind(d.code)}`)}</span>
                <span className={styles.dayRange}>
                  {temp(d.min)} – {temp(d.max)}
                </span>
                <span className={styles.dayRain}>
                  {d.precipitationChance !== null && d.precipitationChance >= 20
                    ? t('rainChance', { value: percent(d.precipitationChance) })
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <details className={styles.sources}>
        <summary className="wp-secondary">{t('sourcesTitle')}</summary>
        <ul>
          {sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" lang="en">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </details>
      <p className="wp-meta">
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          {t('attribution')}
        </a>
      </p>
    </div>
  );
}
