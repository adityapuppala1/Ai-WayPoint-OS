'use client';

import { Icon } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { AccountMenu, type AccountSummary } from './AccountMenu';
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
    <header className={styles.mobileHeader}>
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
        </Link>
        <QuickExit compact />
        <div className={styles.mobileAccount}>
          <AccountMenu account={account} />
        </div>
      </div>
    </header>
  );
}
