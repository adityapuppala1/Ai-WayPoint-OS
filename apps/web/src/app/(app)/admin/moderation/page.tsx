import { admin } from '@waypoint/api';
import { EmptyState, Notice, Panel } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { ModerationActions } from '@/components/admin/ModerationActions';
import { requireAdmin } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('moderationTitle'), robots: { index: false } };
}

export default async function ModerationPage() {
  const viewer = await requireAdmin('/admin/moderation');
  const [t, circles, format] = await Promise.all([
    getTranslations('admin'),
    getTranslations('circles'),
    getFormatter(),
  ]);
  const queue = await admin.moderationQueue(viewer.db);
  const now = new Date();

  return (
    <Panel title={t('moderationTitle')} description={t('moderationLead')} as="section">
      <div className="wp-stack">
        <Notice
          tone="support"
          icon="support"
          title={t('safetyCount', { count: queue.heldForSafety })}
        />
        {queue.items.length ? (
          <ul className={styles.items}>
            {queue.items.map((item) => (
              <li
                key={item.postId}
                className={styles.item}
                data-tone={item.held === 'scam' ? 'danger' : item.held ? 'caution' : undefined}
              >
                <p className={styles.itemHead}>
                  <span className="wp-tag" data-tone={item.held ? 'demo' : undefined}>
                    {item.held === 'scam'
                      ? t('heldScam')
                      : item.held === 'reports'
                        ? t('heldReports')
                        : t('reportedVisible')}
                  </span>
                  <span>{t('inCircle', { circle: item.circle.name })}</span>
                  {item.isReply ? <span>{t('reply')}</span> : null}
                  <span>{format.relativeTime(new Date(item.createdAt), now)}</span>
                </p>
                <p className={styles.body} lang={item.circle.language} dir="auto">
                  {item.body}
                </p>
                {item.reports.length && item.reports.every((r) => r.reason === 'worried') ? (
                  <p className={styles.note}>{t('worriedNote')}</p>
                ) : null}
                {item.reports.length ? (
                  <ul className={styles.reasons}>
                    {item.reports.map((r) => (
                      <li key={r.reason} className="wp-tag">
                        {t('reportTally', {
                          reason: circles(`reasons.${r.reason}`),
                          count: format.number(r.n),
                        })}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ModerationActions postId={item.postId} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t('queueEmpty')} />
        )}
      </div>
    </Panel>
  );
}
