import { admin } from '@waypoint/api';
import { consoleFor } from '@waypoint/core/console';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import styles from '@/components/admin/admin.module.css';
import { requireStaffViewer } from '@/lib/server';

/**
 * The platform console, for staff only: everyone else gets a plain "not found", so it stays
 * unlisted. Each member of staff sees the sections their role may open.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await requireStaffViewer('/admin');
  const [t, waiting] = await Promise.all([
    getTranslations('admin'),
    // Counted for this member of staff: a verdict they recorded is not theirs to confirm.
    admin.adminCounts(viewer.db, viewer.user.id),
  ]);
  return (
    <div className="wp-page wp-page-wide">
      <header className="wp-page-head">
        <h1>{t('title')}</h1>
        <p className="wp-lead">{t('lead')}</p>
      </header>
      <div className={styles.consoleLayout}>
        <AdminNav groups={consoleFor(viewer.user.role)} waiting={waiting} />
        <div className={styles.consoleMain}>{children}</div>
      </div>
    </div>
  );
}
