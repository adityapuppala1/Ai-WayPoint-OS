'use client';

import { cn, Dialog, Icon, type ModuleKey, ModuleMark } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { NAV } from './nav-items';
import styles from './shell.module.css';

const PRIMARY: ModuleKey[] = ['today', 'path', 'shield', 'ask'];

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

export function BottomBar() {
  const t = useTranslations('nav');
  const a11y = useTranslations('a11y');
  const shell = useTranslations('shell');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = NAV.filter((n) => PRIMARY.includes(n.key));
  const moreActive = !primary.some((n) => isActive(pathname, n.href));
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
          {NAV.map((item) => (
            <li key={item.key}>
              <Link
                href={item.ready ? item.href : ('/explore' as Route)}
                className={styles.sheetLink}
                onClick={() => setOpen(false)}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              >
                <ModuleMark module={item.key} size="sm" />
                <span>{t(item.key as NavKey)}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={'/support' as Route}
              className={styles.sheetLink}
              onClick={() => setOpen(false)}
            >
              <ModuleMark module="support" size="sm" />
              <span>{t('support')}</span>
            </Link>
          </li>
          <li>
            <Link
              href={'/settings' as Route}
              className={styles.sheetLink}
              onClick={() => setOpen(false)}
            >
              <span className={styles.moreMark} aria-hidden>
                <Icon name="settings" size={18} />
              </span>
              <span>{t('settings')}</span>
            </Link>
          </li>
        </ul>
      </Dialog>
    </>
  );
}
