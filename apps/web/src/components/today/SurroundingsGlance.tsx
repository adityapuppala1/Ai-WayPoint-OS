'use client';

import { aqiLevel, toFahrenheit, weatherKind } from '@waypoint/core/surroundings';
import { ModuleMark } from '@waypoint/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LinkRow } from '@/components/LinkRow';
import {
  type Cached,
  loadCache,
  loadPlace,
  loadUnits,
  placeKey,
} from '@/components/surroundings/storage';

/**
 * Today's weather at a glance, from the forecast this device saved last time (never fetched
 * here, never sent to Waypoint). Without a saved place it invites people to choose one.
 */
export function SurroundingsGlance({ imperialDefault }: { imperialDefault: boolean }) {
  const t = useTranslations('today');
  const s = useTranslations('surroundings');
  const format = useFormatter();
  const [glance, setGlance] = useState<{ data: Cached; label: string; imperial: boolean } | null>(
    null,
  );

  useEffect(() => {
    const place = loadPlace();
    const data = loadCache();
    if (!place || !data || data.key !== placeKey(place)) return;
    // Older than a day is no longer "today".
    if (Date.now() - data.fetchedAt > 24 * 3_600_000) return;
    const units = loadUnits();
    setGlance({
      data,
      label: place.label,
      imperial: units ? units === 'imperial' : imperialDefault,
    });
  }, [imperialDefault]);

  if (!glance) {
    return (
      <LinkRow
        href="/surroundings"
        leading={<ModuleMark module="surroundings" size="sm" />}
        title={t('toolWeather')}
        description={t('toolWeatherHint')}
      />
    );
  }

  const c = glance.data.weather.current;
  const temp = format.number(
    Math.round(glance.imperial ? toFahrenheit(c.temperature) : c.temperature),
    {
      style: 'unit',
      unit: glance.imperial ? 'fahrenheit' : 'celsius',
    },
  );
  const aqi = glance.data.air?.current.usAqi;
  return (
    <LinkRow
      href="/surroundings"
      leading={<ModuleMark module="surroundings" size="sm" />}
      title={t('weatherNow', { temp, kind: s(`kinds.${weatherKind(c.code)}`) })}
      description={[
        glance.label,
        aqi !== null && aqi !== undefined
          ? t('weatherAir', { level: s(`aqiLevels.${aqiLevel(aqi)}`) })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    />
  );
}
