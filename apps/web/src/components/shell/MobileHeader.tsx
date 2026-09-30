'use client';

import { cn, Icon, viewTransition } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { AccountMenu, type AccountSummary } from './AccountMenu';
import { LinkPending } from './pending';
import { QuickExit } from './QuickExit';
import styles from './shell.module.css';

export function MobileHeader({
  account,
  helpLabel,
}: {
  account: AccountSummary;
  helpLabel: string;
}) {
  return (
    <header className={cn(styles.mobileHeader, viewTransition.header)}>
      <Link href="/" className={styles.brand} aria-label="Waypoint">
        <span className={styles.brandMark} aria-hidden>
          <LogoMark size={28} />
        </span>
        <span className={styles.brandText}>Waypoint</span>
      </Link>
      <div className={styles.mobileActions}>
        <Link href={'/support' as Route} className={styles.helpChip}>
          <Icon name="support" size={18} weight="fill" />
          <span>{helpLabel}</span>
          <LinkPending />
        </Link>
        <QuickExit compact />
        <div className={styles.mobileAccount}>
          <AccountMenu account={account} />
        </div>
      </div>
    </header>
  );
}
