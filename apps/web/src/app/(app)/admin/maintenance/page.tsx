import { maintenance } from '@waypoint/api';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { MaintenanceConsole } from '@/components/admin/MaintenanceConsole';
import { requireConsole } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.maint');
  return { title: t('title'), robots: { index: false } };
}

/** Maintenance, the announcement for everyone, backups and housekeeping. */
export default async function MaintenancePage() {
  const viewer = await requireConsole('maintenance', '/admin/maintenance');
  const [t, view] = await Promise.all([
    getTranslations('admin.maint'),
    maintenance.maintenanceView(viewer.db),
  ]);
  return (
    <section className="wp-stack" aria-labelledby="maint-page-title">
      <header className={styles.sectionHead}>
        <h2 id="maint-page-title">{t('title')}</h2>
        <p className="wp-lead">{t('lead')}</p>
      </header>
      <MaintenanceConsole view={view} at={new Date().toISOString()} />
    </section>
  );
}
