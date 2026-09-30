'use client';

import { geocodeUrl, type Place, parseGeocoding, roundCoord } from '@waypoint/core/surroundings';
import { Button, Icon, SearchField } from '@waypoint/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import styles from './surroundings.module.css';

/**
 * Choose a place by searching (Open-Meteo geocoding, called from the browser) or with the
 * device's location, rounded to about a kilometre. Nothing is sent to Waypoint.
 */
export function PlacePicker({
  onPick,
  onCancel,
}: {
  onPick: (place: Place) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('surroundings');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState<'search' | 'locate' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setBusy('search');
    setMessage(null);
    try {
      const res = await fetch(geocodeUrl(q, locale));
      if (!res.ok) throw new Error(String(res.status));
      const places = parseGeocoding(await res.json());
      setResults(places);
      if (!places.length) setMessage(t('noResults'));
    } catch {
      setResults(null);
      setMessage(t('searchFailed'));
    } finally {
      setBusy(null);
    }
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setMessage(t('locationFailed'));
      return;
    }
    setBusy('locate');
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(null);
        onPick({
          label: t('yourLocation'),
          latitude: roundCoord(pos.coords.latitude),
          longitude: roundCoord(pos.coords.longitude),
        });
      },
      (err) => {
        setBusy(null);
        setMessage(err.code === err.PERMISSION_DENIED ? t('locationDenied') : t('locationFailed'));
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  };

  return (
    <div className={styles.picker}>
      <div className={styles.pickerRow}>
        <Button variant="primary" icon="locate" onPress={locate} isBusy={busy === 'locate'}>
          {t('useLocation')}
        </Button>
        {onCancel ? (
          <Button variant="quiet" onPress={onCancel}>
            {t('cancel')}
          </Button>
        ) : null}
      </div>
      <form
        className={styles.searchRow}
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <SearchField
          label={t('search')}
          value={query}
          onChange={(v) => {
            setQuery(v);
            setMessage(null);
          }}
          onSubmit={() => void search()}
          className={styles.searchField}
        />
        <Button
          type="submit"
          icon="search"
          isBusy={busy === 'search'}
          isDisabled={query.trim().length < 2}
        >
          {t('searchButton')}
        </Button>
      </form>
      {message ? (
        <p className={styles.message} role="status">
          {message}
        </p>
      ) : null}
      {results?.length ? (
        <ul className={styles.results}>
          {results.map((p) => (
            <li key={`${p.latitude},${p.longitude}`}>
              <button type="button" className={styles.result} onClick={() => onPick(p)}>
                <Icon name="place" size={18} />
                <span>
                  <span className={styles.resultName}>{p.label}</span>
                  {p.region ? <span className={styles.resultRegion}>{p.region}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
