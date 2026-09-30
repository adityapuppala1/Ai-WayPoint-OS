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
  { key: 'signals', href: '/admin/signals' },
  { key: 'feedback', href: '/admin/feedback' },
  { key: 'audit', href: '/admin/audit' },
] as const;

type Waiting = { moderation: number; reports: number; forecasts: number };

/** Section links for the admin console, with counts of what is waiting. */
export function AdminNav({ waiting }: { waiting: Waiting }) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  return (
    <nav aria-label={t('navLabel')}>
      <ul className={styles.nav}>
        {SECTIONS.map((s) => {
          const count = s.key in waiting ? waiting[s.key as keyof Waiting] : 0;
          // A page inside a section (editing one forecast) still belongs to that section.
          const here =
            pathname === s.href || (s.href !== '/admin' && pathname.startsWith(`${s.href}/`));
          return (
            <li key={s.key}>
              <Link href={s.href as Route} aria-current={here ? 'page' : undefined}>
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
