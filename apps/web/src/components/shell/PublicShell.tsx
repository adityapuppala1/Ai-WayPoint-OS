import { Icon } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LanguagePicker } from '@/components/LanguagePicker';
import { LogoMark } from '@/components/Logo';
import { LegalLinks } from '@/components/legal/LegalLinks';
import { getViewer } from '@/lib/server';
import styles from './public.module.css';
import { QuickExit } from './QuickExit';

/** Frame for pages people see before they have a session: welcome, sign-in, onboarding, legal. */
export async function PublicShell({
  children,
  hideSignIn,
}: {
  children: ReactNode;
  hideSignIn?: boolean;
}) {
  const t = await getTranslations('shell');
  const viewer = await getViewer();
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label={t('home')}>
          <LogoMark size={30} />
          <span>Waypoint</span>
        </Link>
        <div className={styles.actions}>
          <div className={styles.language}>
            <LanguagePicker signedIn={Boolean(viewer)} compact />
          </div>
          <Link href={'/support' as Route} className={styles.help}>
            <Icon name="support" size={18} weight="fill" />
            <span>{t('help')}</span>
          </Link>
          <QuickExit />
          {!hideSignIn && !viewer ? (
            <Link href={'/sign-in' as Route} className={styles.signIn}>
              {t('signIn')}
            </Link>
          ) : null}
        </div>
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      <footer className={styles.footer}>
        <LegalLinks className={styles.legal} />
      </footer>
    </div>
  );
}
