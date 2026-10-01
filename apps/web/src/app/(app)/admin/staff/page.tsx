import { people } from '@waypoint/api';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { StaffConsole } from '@/components/admin/StaffConsole';
import { requireConsole } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.people');
  return { title: t('staffTitle'), robots: { index: false } };
}

/** The staff and invitations to join them. */
export default async function StaffPage() {
  const viewer = await requireConsole('staff', '/admin/staff');
  const [t, view] = await Promise.all([
    getTranslations('admin.people'),
    people.staffView(viewer.db),
  ]);
  return (
    <section className="wp-stack" aria-labelledby="staff-title">
      <header className={styles.sectionHead}>
        <h2 id="staff-title">{t('staffTitle')}</h2>
        <p className="wp-lead">{t('staffLead')}</p>
      </header>
      <StaffConsole view={view} at={new Date().toISOString()} />
    </section>
  );
}
