import { admin } from '@waypoint/api';
import { EmptyState, LinkButton, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { requireAdmin } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('feedbackTitle'), robots: { index: false } };
}

/**
 * What people told us worked or did not, newest first. Each message had personal details
 * removed before it was stored. Nobody is named except someone who asked for a reply, and
 * then only by the address to reply to; a guest cannot be identified from this page at all.
 */
export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const viewer = await requireAdmin('/admin/feedback');
  const { before } = await searchParams;
  const [t, nav, settings, format] = await Promise.all([
    getTranslations('admin'),
    getTranslations('nav'),
    getTranslations('settings'),
    getFormatter(),
  ]);
  const list = await admin.feedbackList(viewer.db, { before: before ?? null, limit: 50 });
  const about = (module: string) =>
    module !== 'other' && nav.has(module as 'today')
      ? nav(module as 'today')
      : settings('feedbackOther');

  return (
    <Panel title={t('feedbackTitle')} description={t('feedbackLead')} as="section">
      <div className="wp-stack">
        {list.items.length ? (
          <ul className={styles.items}>
            {list.items.map((f) => (
              <li key={f.id} className={styles.item}>
                <p className={styles.itemHead}>
                  <span className="wp-tag">{about(f.module)}</span>
                  {f.rating !== null ? (
                    <span className="wp-num">{t('feedbackRated', { rating: f.rating })}</span>
                  ) : null}
                  <time dateTime={f.createdAt}>
                    {format.dateTime(new Date(f.createdAt), {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </p>
                {f.message ? (
                  <p className={styles.body} dir="auto">
                    {f.message}
                  </p>
                ) : (
                  <p className={styles.note}>{t('feedbackNoMessage')}</p>
                )}
                {f.replyTo ? (
                  <p className={styles.note}>
                    {t.rich('feedbackReplyTo', {
                      email: f.replyTo,
                      link: (chunks) => <a href={`mailto:${f.replyTo}`}>{chunks}</a>,
                    })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t('feedbackEmpty')} />
        )}
        <div className="wp-row">
          {before ? (
            <LinkButton href={'/admin/feedback' as Route} variant="quiet" icon="back">
              {t('newest')}
            </LinkButton>
          ) : null}
          {list.next ? (
            <LinkButton
              href={`/admin/feedback?before=${encodeURIComponent(list.next)}` as Route}
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
