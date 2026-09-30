'use client';

import { Button } from '@waypoint/ui';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

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

export function QuickExit({ compact }: { compact?: boolean }) {
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
      {compact ? t('quickExitShort') : t('quickExit')}
    </Button>
  );
}
