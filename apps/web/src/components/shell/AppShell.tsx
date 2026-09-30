import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { getViewer } from '@/lib/server';
import { AccountMenu } from './AccountMenu';
import { MobileHeader } from './MobileHeader';
import { BottomBar, NavRail } from './Nav';
import { QuickExit } from './QuickExit';
import styles from './shell.module.css';

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
      <BottomBar />
    </div>
  );
}
