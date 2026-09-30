'use client';

import { authClient } from '@waypoint/auth/client';
import { Icon, Menu, MenuItem, MenuSeparator } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button as AriaButton } from 'react-aria-components';
import { forgetOfflineCopy } from '@/lib/offline';
import styles from './shell.module.css';

export interface AccountSummary {
  signedIn: boolean;
  isGuest: boolean;
  name: string | null;
  email: string | null;
  /** Platform staff: shows the Admin console. */
  isAdmin?: boolean;
}

export function AccountMenu({ account }: { account: AccountSummary }) {
  const t = useTranslations('shell');
  const common = useTranslations('common');
  const router = useRouter();
  const label = account.signedIn
    ? account.isGuest
      ? common('guest')
      : (account.name ?? account.email ?? common('you'))
    : t('signIn');

  const signOut = async () => {
    await authClient.signOut().catch(() => undefined);
    await forgetOfflineCopy();
    router.push('/welcome' as Route);
    router.refresh();
  };

  return (
    <Menu
      label={t('account')}
      placement="top end"
      trigger={
        <AriaButton className={styles.accountButton}>
          <Icon name="account" size={22} />
          <span className={styles.accountText}>
            <span className={styles.accountName}>{label}</span>
            {account.signedIn && !account.isGuest && account.email ? (
              <span className={styles.accountEmail}>{account.email}</span>
            ) : null}
          </span>
          <Icon name="chevronDown" size={16} />
        </AriaButton>
      }
    >
      {account.signedIn ? (
        <>
          {account.isGuest ? (
            <MenuItem id="create" icon="add" href={'/sign-up' as Route}>
              {t('createAccount')}
            </MenuItem>
          ) : null}
          <MenuItem id="settings" icon="settings" href={'/settings' as Route}>
            {t('settings')}
          </MenuItem>
          <MenuItem id="privacy" icon="lock" href={'/settings/privacy' as Route}>
            {t('privacy')}
          </MenuItem>
          {account.isGuest ? null : (
            <MenuItem id="org" icon="org" href={'/org' as Route}>
              {t('organisations')}
            </MenuItem>
          )}
          {account.isAdmin ? (
            <MenuItem id="admin" icon="shield" href={'/admin' as Route}>
              {t('admin')}
            </MenuItem>
          ) : null}
          <MenuSeparator />
          <MenuItem id="signout" icon="signOut" onAction={signOut}>
            {t('signOut')}
          </MenuItem>
        </>
      ) : (
        <>
          <MenuItem id="signin" icon="account" href={'/sign-in' as Route}>
            {t('signIn')}
          </MenuItem>
          <MenuItem id="create" icon="add" href={'/sign-up' as Route}>
            {t('createAccount')}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
