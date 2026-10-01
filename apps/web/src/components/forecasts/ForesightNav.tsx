import type { Route } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import styles from './forecasts.module.css';

const SECTIONS = [
  { key: 'navSignals', href: '/signals' },
  { key: 'navForecasts', href: '/signals/forecasts' },
  { key: 'navRecord', href: '/signals/forecasts/record' },
] as const;

/** The three parts of Signals: what is changing, what may come next, and how we have done. */
export async function ForesightNav({ current }: { current: (typeof SECTIONS)[number]['href'] }) {
  const t = await getTranslations('forecasts');
  return (
    <nav aria-label={t('navLabel')}>
      <ul className={styles.tabs}>
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href as Route} aria-current={s.href === current ? 'page' : undefined}>
              {t(s.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
