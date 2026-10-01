'use client';

import { AnimatedNumber } from '@waypoint/ui';
import { useFormatter } from 'next-intl';

/**
 * A whole number written the way the reader's language writes it (Arabic and Hindi digits
 * included), which counts to its new value when it changes. On arrival it stands still.
 */
export function Count({ value }: { value: number }) {
  const format = useFormatter();
  return <AnimatedNumber value={value} format={(n) => format.number(Math.round(n))} />;
}
