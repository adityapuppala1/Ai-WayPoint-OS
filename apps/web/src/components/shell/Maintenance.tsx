import { Icon, Notice } from '@waypoint/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import styles from './shell.module.css';

/**
 * What everyone but staff sees while Waypoint is closed for maintenance: the admin's own words,
 * when it is expected back, and the way to help, which is never closed.
 */
export async function MaintenanceScreen({
  message,
  until,
}: {
  message: string;
  until: string | null;
}) {
  const [t, format] = await Promise.all([getTranslations('shell'), getFormatter()]);
  return (
    <main id="main" className={styles.maintenance} tabIndex={-1}>
      <div className="wp-page">
        <h1>{t('maintenanceTitle')}</h1>
        <Notice tone="caution" icon="settings" title={message} role="status">
          {until ? (
            <p>
              {t('maintenanceUntil', {
                until: format.dateTime(new Date(until), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </p>
          ) : null}
          <p>{t('maintenanceHelp')}</p>
        </Notice>
        <div className="wp-row">
          {/* A whole new page, not a step inside this one: the screen around it is drawn once
              per page, and help must open in full. */}
          <a href="/support" className={styles.helpLink}>
            <Icon name="support" size={20} weight="bold" />
            {t('help')}
          </a>
        </div>
      </div>
    </main>
  );
}
