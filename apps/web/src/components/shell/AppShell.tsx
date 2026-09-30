import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { getViewer } from '@/lib/server';
import { AccountMenu } from './AccountMenu';
import { MobileHeader } from './MobileHeader';
import { BottomBar, NavRail } from './Nav';
import { type DirectoryRow, NAV, PRIMARY_TABS } from './nav-items';
import { QuickExit } from './QuickExit';
import styles from './shell.module.css';

/**
 * Everything on a phone that is not a tab, for the More sheet: the other modules with one
 * line each, then "What's next?" and "Join a programme" (which have no other way in on a
 * phone), help and settings. Worded here because module descriptions stay on the server.
 */
async function moreDirectory(): Promise<DirectoryRow[]> {
  const [nav, modules, forecasts, explore, today] = await Promise.all([
    getTranslations('nav'),
    getTranslations('modules'),
    getTranslations('forecasts'),
    getTranslations('explore'),
    getTranslations('today'),
  ]);
  const rows: DirectoryRow[] = [];
  for (const item of NAV.filter((n) => !PRIMARY_TABS.includes(n.key))) {
    rows.push({
      key: item.key,
      href: item.ready ? item.href : '/explore',
      module: item.key,
      name: nav(item.key as 'signals'),
      description: modules(item.key as 'signals'),
    });
    // Forecasts are part of Signals, so they sit right under it.
    if (item.key === 'signals')
      rows.push({
        key: 'forecasts',
        href: '/signals/forecasts',
        module: 'signals',
        name: forecasts('navForecasts'),
        description: forecasts('lead'),
      });
  }
  rows.push(
    {
      key: 'join',
      href: '/join',
      module: 'org',
      name: explore('joinProgramme'),
      description: explore('joinProgrammeHint'),
    },
    {
      key: 'support',
      href: '/support',
      module: 'support',
      name: nav('support'),
      description: today('toolHelpHint'),
    },
    { key: 'settings', href: '/settings', name: nav('settings') },
  );
  return rows;
}

/** The frame around every signed-in (or guest) page: rail on wide screens, bottom bar on phones. */
export async function AppShell({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const t = await getTranslations('shell');
  const account = {
    signedIn: Boolean(viewer),
    isGuest: viewer?.user.isGuest ?? false,
    name:
      viewer?.profile.displayName ??
      (viewer && !viewer.user.isGuest ? viewer.user.name : null) ??
      null,
    email: viewer && !viewer.user.isGuest ? viewer.user.email : null,
    isAdmin: viewer?.user.role === 'admin',
  };
  return (
    <div className={styles.shell}>
      <NavRail accountSlot={<AccountMenu account={account} />} />
      <div className={styles.column}>
        <MobileHeader account={account} helpLabel={t('helpShort')} />
        <div className={styles.desktopBar}>
          <QuickExit />
        </div>
        <main id="main" className={styles.main} tabIndex={-1}>
          {children}
        </main>
      </div>
      <BottomBar directory={await moreDirectory()} />
    </div>
  );
}
