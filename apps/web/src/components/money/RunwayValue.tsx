'use client';

import { AnimatedNumber } from '@waypoint/ui';
import { useTranslations } from 'next-intl';

/**
 * How many months the savings last, in words. After the numbers are changed it counts to the
 * new figure (at once in lite mode or when less motion is asked for); on arrival it stands
 * still. The runway is kept to one decimal place, so every step of the count is too.
 */
export function RunwayValue({ months }: { months: number }) {
  const t = useTranslations('money');
  return (
    <AnimatedNumber
      value={months}
      format={(n) => t('runwayMonths', { months: Math.round(n * 10) / 10 })}
    />
  );
}
