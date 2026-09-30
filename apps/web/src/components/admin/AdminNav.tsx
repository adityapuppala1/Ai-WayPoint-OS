'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import styles from './admin.module.css';

const SECTIONS = [
  { key: 'overview', href: '/admin' },
  { key: 'moderation', href: '/admin/moderation' },
  { key: 'reports', href: '/admin/reports' },
  { key: 'forecasts', href: '/admin/forecasts' },
  { key: 'audit', href: '/admin/audit' },
] as const;

/** Section links for the admin console, with counts of what is waiting. */
export function AdminNav({
  waiting,
}: {
  waiting: { moderation: number; reports: number; forecasts: number };
}) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  return (
    <nav aria-label={t('navLabel')}>
      <ul className={styles.nav}>
        {SECTIONS.map((s) => {
          const count = s.key === 'overview' || s.key === 'audit' ? 0 : waiting[s.key];
          return (
            <li key={s.key}>
              <Link href={s.href as Route} aria-current={pathname === s.href ? 'page' : undefined}>
                {t(`nav.${s.key}`)}
                {count ? <span className={styles.badge}>{count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
