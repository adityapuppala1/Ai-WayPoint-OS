import { system } from '@waypoint/api';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { SystemConsole } from '@/components/admin/SystemConsole';
import { requireConsole } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.sys');
  return { title: t('title'), robots: { index: false } };
}

/**
 * How Waypoint itself is doing: the API's traffic, errors and speed, the database, background
 * work and messages waiting to go out, and the server it runs on.
 */
export default async function SystemPage() {
  const viewer = await requireConsole('system', '/admin/system');
  const [t, view] = await Promise.all([getTranslations('admin.sys'), system.systemView(viewer.db)]);
  return (
    <section className="wp-stack" aria-labelledby="system-title">
      <header className={styles.sectionHead}>
        <h2 id="system-title">{t('title')}</h2>
        <p className="wp-lead">{t('lead')}</p>
      </header>
      <SystemConsole view={view} at={new Date().toISOString()} />
    </section>
  );
}
