import { admin } from '@waypoint/api';
import { EmptyState, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { ScamReportActions } from '@/components/admin/ScamReportActions';
import { Facts } from '@/components/Facts';
import { requireAdmin } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('reportsTitle'), robots: { index: false } };
}

type Status = (typeof admin.SCAM_REPORT_STATUSES)[number];

export default async function ScamReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const viewer = await requireAdmin('/admin/reports');
  const { status: asked } = await searchParams;
  const status: Status = (admin.SCAM_REPORT_STATUSES as readonly string[]).includes(asked ?? '')
    ? (asked as Status)
    : 'new';
  const [t, shield, format, locale] = await Promise.all([
    getTranslations('admin'),
    getTranslations('shield'),
    getFormatter(),
    getLocale(),
  ]);
  const list = await admin.scamReportList(viewer.db, status);
  const countries = new Intl.DisplayNames([locale], { type: 'region' });
  const lists = new Intl.ListFormat(locale, { type: 'conjunction' });
  const now = new Date();

  return (
    <Panel title={t('reportsTitle')} description={t('reportsLead')} as="section">
      <div className="wp-stack">
        <nav aria-label={t('statusFilter')}>
          <ul className={styles.filters}>
            {admin.SCAM_REPORT_STATUSES.map((s) => (
              <li key={s}>
                <Link
                  href={(s === 'new' ? '/admin/reports' : `/admin/reports?status=${s}`) as Route}
                  aria-current={s === status ? 'page' : undefined}
                >
                  {t(`statuses.${s}`)}
                  <span className="wp-num">{format.number(list.counts[s] ?? 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {list.items.length ? (
          <ul className={styles.items}>
            {list.items.map((r) => (
              <li
                key={r.id}
                className={styles.item}
                data-tone={status === 'new' ? 'caution' : undefined}
              >
                <p className={styles.itemHead}>
                  <span className="wp-tag">
                    {shield.has(`categories.${r.category}` as 'categories.job')
                      ? shield(`categories.${r.category}` as 'categories.job')
                      : r.category}
                  </span>
                  <span>
                    {r.country ? (countries.of(r.country) ?? r.country) : t('anyCountry')}
                  </span>
                  <span>{format.relativeTime(new Date(r.createdAt), now)}</span>
                  {r.related ? <span>{t('related', { count: r.related })}</span> : null}
                </p>
                <p className={styles.body} dir="auto">
                  {r.description ?? t('noDescription')}
                </p>
                {r.urlHosts.length ? (
                  <p className={styles.itemHead}>
                    <span>{t('websites')}</span>
                    {r.urlHosts.map((h) => (
                      <span key={h} className={styles.host} dir="ltr">
                        {h}
                      </span>
                    ))}
                  </p>
                ) : null}
                {r.amountLost !== null || r.reportedTo.length ? (
                  <p className={styles.note}>
                    <Facts>
                      {r.amountLost !== null
                        ? t('lost', {
                            amount: r.currency
                              ? format.number(r.amountLost, {
                                  style: 'currency',
                                  currency: r.currency,
                                })
                              : format.number(r.amountLost),
                          })
                        : null}
                      {r.reportedTo.length
                        ? t('reportedTo', { list: lists.format(r.reportedTo) })
                        : null}
                    </Facts>
                  </p>
                ) : null}
                <ScamReportActions id={r.id} status={r.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t('reportsEmpty')} />
        )}
      </div>
    </Panel>
  );
}
