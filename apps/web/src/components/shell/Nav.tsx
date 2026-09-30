'use client';

import { cn, Dialog, Icon, ModuleMark } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { type DirectoryRow, NAV, PRIMARY_TABS } from './nav-items';
import styles from './shell.module.css';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavKey =
  | 'today'
  | 'path'
  | 'shield'
  | 'circles'
  | 'ask'
  | 'signals'
  | 'money'
  | 'mind'
  | 'health'
  | 'civic'
  | 'surroundings'
  | 'goals';

export function NavRail({ accountSlot }: { accountSlot: React.ReactNode }) {
  const t = useTranslations('nav');
  const shell = useTranslations('shell');
  const a11y = useTranslations('a11y');
  const pathname = usePathname();
  return (
    <nav className={styles.rail} aria-label={a11y('mainNav')}>
      <Link href="/" className={styles.brand} aria-label={shell('home')}>
        <span className={styles.brandMark} aria-hidden>
          <LogoMark size={28} />
        </span>
        <span className={styles.brandText}>Waypoint</span>
      </Link>
      <ul className={styles.railList}>
        {NAV.filter((n) => n.ready).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className={cn(styles.railLink, active && styles.active)}
                aria-current={active ? 'page' : undefined}
                style={{ '--line': `var(--wp-line-${item.key})` } as React.CSSProperties}
              >
                <ModuleMark module={item.key} size="sm" tone={active ? 'solid' : 'tint'} />
                <span>{t(item.key as NavKey)}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href={'/explore' as Route}
            className={cn(styles.railLink, isActive(pathname, '/explore') && styles.active)}
            aria-current={isActive(pathname, '/explore') ? 'page' : undefined}
          >
            <span className={styles.moreMark} aria-hidden>
              <Icon name="more" size={18} weight="bold" />
            </span>
            <span>{t('explore')}</span>
          </Link>
        </li>
      </ul>
      <div className={styles.railFoot}>
        <Link
          href={'/support' as Route}
          className={cn(styles.helpLink, isActive(pathname, '/support') && styles.active)}
        >
          <Icon name="support" size={20} weight="fill" />
          <span>{t('support')}</span>
        </Link>
        {accountSlot}
      </div>
    </nav>
  );
}

/**
 * The phone's bottom bar, and the More sheet behind it: a directory of everywhere that is not
 * a tab, each with a line saying what it is. The rows are worded on the server (their text is
 * not among the messages sent to the browser) and arrive as `directory`.
 */
export function BottomBar({ directory }: { directory: DirectoryRow[] }) {
  const t = useTranslations('nav');
  const a11y = useTranslations('a11y');
  const shell = useTranslations('shell');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = NAV.filter((n) => PRIMARY_TABS.includes(n.key));
  const moreActive = !primary.some((n) => isActive(pathname, n.href));
  // "What's next?" lives under Signals: only the closest match is the current page.
  const current = directory
    .filter((row) => isActive(pathname, row.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <>
      <nav className={styles.bottomBar} aria-label={a11y('mainNav')}>
        <ul>
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(styles.tab, active && styles.active)}
                  aria-current={active ? 'page' : undefined}
                >
                  <ModuleMark module={item.key} size="sm" tone={active ? 'solid' : 'tint'} />
                  <span>{t(item.key as NavKey)}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className={cn(styles.tab, moreActive && styles.active)}
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
            >
              <span className={styles.moreMark} aria-hidden>
                <Icon name="menu" size={18} weight="bold" />
              </span>
              <span>{shell('more')}</span>
            </button>
          </li>
        </ul>
      </nav>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        title={shell('allModules')}
        variant="sheet"
        closeLabel={a11y('closeMenu')}
      >
        <ul className={styles.sheetList}>
          {directory.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href as Route}
                className={styles.sheetLink}
                onClick={() => setOpen(false)}
                aria-current={row === current ? 'page' : undefined}
              >
                {row.module ? (
                  <ModuleMark module={row.module} size="sm" />
                ) : (
                  <span className={styles.moreMark} aria-hidden>
                    <Icon name="settings" size={18} />
                  </span>
                )}
                <span className={styles.sheetText}>
                  <span className={styles.sheetName}>{row.name}</span>
                  {row.description ? (
                    <span className={styles.sheetHint}>{row.description}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
