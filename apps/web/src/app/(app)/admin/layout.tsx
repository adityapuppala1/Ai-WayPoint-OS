import { admin } from '@waypoint/api';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import { requireAdmin } from '@/lib/server';

/** Platform staff only. Everyone else gets a plain "not found": the console stays unlisted. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await requireAdmin('/admin');
  const [t, waiting] = await Promise.all([getTranslations('admin'), admin.adminCounts(viewer.db)]);
  return (
    <div className="wp-page wp-page-wide">
      <header className="wp-page-head">
        <h1>{t('title')}</h1>
        <p className="wp-lead">{t('lead')}</p>
      </header>
      <AdminNav waiting={waiting} />
      {children}
    </div>
  );
}
