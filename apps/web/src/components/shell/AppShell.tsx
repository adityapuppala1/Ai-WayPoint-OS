import { isStaffRole } from '@waypoint/core/console';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { getViewer } from '@/lib/server';
import { AccountMenu } from './AccountMenu';
import { type GoToGroup, GoToProvider } from './GoTo';
import { MobileHeader } from './MobileHeader';
import { BottomBar, NavRail } from './Nav';
import { type DirectoryRow, NAV, PRIMARY_TABS } from './nav-items';
import { OfflineNotice } from './OfflineNotice';
import { PageFrame } from './pending';
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

/**
 * What the go-to palette offers: every module with its one line, then the places inside them
 * that people look for by name. Worded here for the same reason as the More sheet.
 */
async function goToGroups(): Promise<GoToGroup[]> {
  const [nav, modules, shell, path, forecasts, settings, explore, today] = await Promise.all([
    getTranslations('nav'),
    getTranslations('modules'),
    getTranslations('shell'),
    getTranslations('path'),
    getTranslations('forecasts'),
    getTranslations('settings'),
    getTranslations('explore'),
    getTranslations('today'),
  ]);
  return [
    {
      id: 'modules',
      title: shell('allModules'),
      places: NAV.filter((n) => n.ready).map((item) => ({
        id: `module-${item.key}`,
        label: nav(item.key as 'signals'),
        description: modules(item.key as 'signals'),
        href: item.href,
        module: item.key,
      })),
    },
    {
      id: 'places',
      title: shell('goToPlaces'),
      places: [
        {
          id: 'path-new',
          label: path('makePlan'),
          description: path('newLead'),
          href: '/path/new',
          module: 'path',
        },
        {
          id: 'path-skills',
          label: path('skillsEditorTitle'),
          description: path('skillsEditorLead'),
          href: '/path/skills',
          module: 'path',
        },
        {
          id: 'forecasts',
          label: forecasts('navForecasts'),
          description: forecasts('lead'),
          href: '/signals/forecasts',
          module: 'signals',
        },
        {
          id: 'record',
          label: forecasts('navRecord'),
          description: forecasts('recordLead'),
          href: '/signals/forecasts/record',
          module: 'signals',
        },
        {
          id: 'support',
          label: nav('support'),
          description: today('toolHelpHint'),
          href: '/support',
          module: 'support',
        },
        {
          id: 'join',
          label: explore('joinProgramme'),
          description: explore('joinProgrammeHint'),
          href: '/join',
          module: 'org',
        },
        {
          id: 'privacy',
          label: shell('privacy'),
          description: settings('privacyLead'),
          href: '/settings/privacy',
          icon: 'lock',
        },
        {
          id: 'settings',
          label: shell('settings'),
          description: settings('lead'),
          href: '/settings',
          icon: 'settings',
        },
        {
          id: 'explore',
          label: nav('explore'),
          description: explore('lead'),
          href: '/explore',
          icon: 'more',
        },
      ],
    },
  ];
}

/** The frame around every signed-in (or guest) page: rail on wide screens, bottom bar on phones. */
export async function AppShell({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const [t, common, groups, directory] = await Promise.all([
    getTranslations('shell'),
    getTranslations('common'),
    goToGroups(),
    moreDirectory(),
  ]);
  const account = {
    signedIn: Boolean(viewer),
    isGuest: viewer?.user.isGuest ?? false,
    name:
      viewer?.profile.displayName ??
      (viewer && !viewer.user.isGuest ? viewer.user.name : null) ??
      null,
    email: viewer && !viewer.user.isGuest ? viewer.user.email : null,
    isAdmin: isStaffRole(viewer?.user.role),
  };
  return (
    <GoToProvider groups={groups} canAsk={Boolean(viewer)}>
      <div className={styles.shell}>
        <NavRail accountSlot={<AccountMenu account={account} />} />
        <div className={styles.column}>
          <MobileHeader account={account} helpLabel={t('helpShort')} />
          <div className={styles.desktopBar}>
            <QuickExit />
          </div>
          <main id="main" className={styles.main} tabIndex={-1}>
            <OfflineNotice />
            <PageFrame label={common('loading')}>{children}</PageFrame>
          </main>
        </div>
        <BottomBar directory={directory} />
      </div>
    </GoToProvider>
  );
}
