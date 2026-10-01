'use client';

import { CONSOLE_PATHS, type ConsoleArea, type ConsoleGroup } from '@waypoint/core/console';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import styles from './admin.module.css';

type Waiting = Partial<Record<ConsoleArea, number>>;

/**
 * The console's sections, grouped (Home, People, Safety, Content, Insights, Platform), showing
 * only what this member of staff may open, with counts of what is waiting. A side list on
 * wide screens; a row that scrolls sideways on a phone.
 */
export function AdminNav({
  groups,
  waiting,
}: {
  groups: Array<{ group: ConsoleGroup; areas: ConsoleArea[] }>;
  waiting: Waiting;
}) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  return (
    <nav aria-label={t('navLabel')} className={styles.consoleNav}>
      {groups.map(({ group, areas }) => (
        <div key={group} className={styles.navGroup}>
          <p className={styles.navGroupLabel} id={`console-${group}`}>
            {t(`groups.${group}`)}
          </p>
          <ul className={styles.nav} aria-labelledby={`console-${group}`}>
            {areas.map((area) => {
              const href = CONSOLE_PATHS[area];
              const count = waiting[area] ?? 0;
              // A page inside a section (editing one forecast) still belongs to that section.
              const here =
                pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));
              return (
                <li key={area}>
                  <Link href={href as Route} aria-current={here ? 'page' : undefined}>
                    {t(`nav.${area}`)}
                    {count ? <span className={styles.badge}>{count}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
