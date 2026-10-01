import { admin } from '@waypoint/api';
import { EmptyState, LinkButton, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { Facts } from '@/components/Facts';
import { requireConsole } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('auditTitle'), robots: { index: false } };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const viewer = await requireConsole('audit', '/admin/audit');
  const { before } = await searchParams;
  const [t, format] = await Promise.all([getTranslations('admin'), getFormatter()]);
  const trail = await admin.auditTrail(viewer.db, { before: before ?? null, limit: 50 });
  const label = (action: string) => {
    const key = `actions.${action.replace(/[.-]/g, '_')}`;
    return t.has(key as 'actions.org_created') ? t(key as 'actions.org_created') : action;
  };

  return (
    <Panel title={t('auditTitle')} description={t('auditLead')} as="section">
      <div className="wp-stack">
        {trail.items.length ? (
          <ol className={styles.log}>
            {trail.items.map((e) => (
              <li key={e.id} className={styles.entry}>
                <span className={styles.entryWhat}>{label(e.action)}</span>
                <time className={styles.entryWhen} dateTime={e.createdAt}>
                  {format.dateTime(new Date(e.createdAt), {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
                <Facts className={styles.entryWho}>
                  {e.actor ? e.actor.name : t('system')}
                  {e.actor ? e.actor.email : null}
                  {e.organisation}
                </Facts>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title={t('auditEmpty')} />
        )}
        <div className="wp-row">
          {before ? (
            <LinkButton href={'/admin/audit' as Route} variant="quiet" icon="back">
              {t('newest')}
            </LinkButton>
          ) : null}
          {trail.next ? (
            <LinkButton
              href={`/admin/audit?before=${encodeURIComponent(trail.next)}` as Route}
              variant="secondary"
              icon="forward"
            >
              {t('older')}
            </LinkButton>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
