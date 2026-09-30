'use client';

import { Button } from '@waypoint/ui';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import styles from './public.module.css';

const EXIT_URL = 'https://www.bbc.com/weather';

/** Leave immediately. Also triggered by pressing Escape three times in a row. */
export function quickExit() {
  try {
    sessionStorage.clear();
  } catch {
    // storage may be unavailable
  }
  window.open(EXIT_URL, '_blank', 'noopener');
  window.location.replace(EXIT_URL);
}

/** `compact`: the short label; `"narrow"`: the short label on small screens only. */
export function QuickExit({ compact }: { compact?: boolean | 'narrow' }) {
  const t = useTranslations('a11y');
  useEffect(() => {
    let presses: number[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const now = Date.now();
      presses = [...presses.filter((p) => now - p < 1200), now];
      if (presses.length >= 3) quickExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <Button
      variant="secondary"
      size="sm"
      icon="close"
      onPress={quickExit}
      aria-label={`${t('quickExit')}. ${t('quickExitHint')}`}
    >
      {compact === 'narrow' ? (
        <>
          <span className={styles.full}>{t('quickExit')}</span>
          <span className={styles.short}>{t('quickExitShort')}</span>
        </>
      ) : compact ? (
        t('quickExitShort')
      ) : (
        t('quickExit')
      )}
    </Button>
  );
}
