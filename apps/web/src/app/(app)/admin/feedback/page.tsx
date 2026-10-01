import { feedback } from '@waypoint/api';
import { EmptyState, Icon, LinkButton, StatStrip, StatTile } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { FeedbackActions } from '@/components/admin/FeedbackActions';
import { requireConsole } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('feedbackTitle'), robots: { index: false } };
}

type Query = Partial<Record<'status' | 'module' | 'rating' | 'wantsReply' | 'before', string>>;

/**
 * What people told us worked or did not, as the team works through it: new ones first, each
 * moved on to planned, done, or not something we will do, with a note for the rest of the
 * team, and a reply by email to anyone who asked for one. Each message had personal details
 * removed before it was stored; nobody is named unless they asked for a reply.
 */
export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const viewer = await requireConsole('feedback', '/admin/feedback');
  const raw = await searchParams;
  const parsed = feedback.FeedbackQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : feedback.FeedbackQuerySchema.parse({});
  const [t, fb, nav, settings, format, list] = await Promise.all([
    getTranslations('admin'),
    getTranslations('admin.fb'),
    getTranslations('nav'),
    getTranslations('settings'),
    getFormatter(),
    feedback.feedbackList(viewer.db, query),
  ]);
  const about = (module: string) =>
    module !== 'other' && nav.has(module as 'today')
      ? nav(module as 'today')
      : module === 'other'
        ? settings('feedbackOther')
        : module;
  const href = (change: Query) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...raw, before: undefined, ...change }))
      if (v) next.set(k, v);
    const s = next.toString();
    return (s ? `/admin/feedback?${s}` : '/admin/feedback') as Route;
  };
  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  const rating = (r: number | null) =>
    r === null ? '—' : format.number(r, { maximumFractionDigits: 1 });
  const states = [
    ...feedback.FEEDBACK_STATUSES.map((s) => [s, list.byStatus[s] ?? 0] as const),
    ['all', Object.values(list.byStatus).reduce((a, b) => a + b, 0)] as const,
  ];

  return (
    <section className="wp-stack" aria-labelledby="feedback-title">
      <header className={styles.sectionHead}>
        <h2 id="feedback-title">{t('feedbackTitle')}</h2>
        <p className="wp-lead">{t('feedbackLead')}</p>
      </header>

      <StatStrip label={fb('monthLabel')}>
        <StatTile label={fb('monthCount')} value={format.number(list.month.n)} />
        <StatTile
          label={fb('monthRating')}
          value={rating(list.month.avgRating)}
          note={fb('outOfFive')}
        />
        <StatTile
          label={fb('waitingReply')}
          value={format.number(list.month.waitingReply)}
          note={fb('waitingReplyNote')}
        />
        <StatTile label={fb('statuses.new')} value={format.number(list.byStatus.new ?? 0)} />
      </StatStrip>

      <div className={styles.filterGroups}>
        <ul className={styles.filters} aria-label={fb('stateLabel')}>
          {states.map(([s, n]) => (
            <li key={s}>
              <Link
                href={href({ status: s })}
                aria-current={query.status === s ? 'page' : undefined}
              >
                {fb(`statuses.${s}`)} <span className="wp-num">{format.number(n)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className={styles.filters} aria-label={fb('ratingLabel')}>
          {(['any', 'low', 'high'] as const).map((r) => (
            <li key={r}>
              <Link
                href={href({ rating: r === 'any' ? undefined : r })}
                aria-current={query.rating === r ? 'page' : undefined}
              >
                {fb(`ratings.${r}`)}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={href({ wantsReply: query.wantsReply === 'true' ? undefined : 'true' })}
              aria-current={query.wantsReply === 'true' ? 'page' : undefined}
            >
              {fb('askedReply')}
            </Link>
          </li>
        </ul>
      </div>
      {list.modules.length ? (
        <ul className={styles.filters} aria-label={fb('moduleLabel')}>
          <li>
            <Link
              href={href({ module: undefined })}
              aria-current={!query.module ? 'page' : undefined}
            >
              {fb('allParts')}
            </Link>
          </li>
          {list.modules.map((m) => (
            <li key={m.module}>
              <Link
                href={href({ module: m.module })}
                aria-current={query.module === m.module ? 'page' : undefined}
              >
                {about(m.module)} <span className="wp-num">{format.number(m.n)}</span>
                {m.avgRating !== null ? (
                  <span className="wp-meta">{fb('avgShort', { rating: rating(m.avgRating) })}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="wp-meta" role="status">
        {fb('found', { n: list.total })}
      </p>

      {list.items.length ? (
        <ul className={styles.items}>
          {list.items.map((f) => (
            <li
              key={f.id}
              className={styles.item}
              data-tone={f.rating !== null && f.rating <= 2 ? 'caution' : undefined}
            >
              <p className={styles.itemHead}>
                <span className="wp-tag">{about(f.module)}</span>
                <span
                  className={styles.statusPill}
                  data-status={
                    f.status === 'done' ? 'ok' : f.status === 'new' ? 'untested' : undefined
                  }
                >
                  {f.status === 'done' ? <Icon name="check" size={14} /> : null}
                  {fb(`statuses.${f.status}`)}
                </span>
                {f.rating !== null ? (
                  <span className="wp-num">{t('feedbackRated', { rating: f.rating })}</span>
                ) : null}
                <time dateTime={f.createdAt}>{when(f.createdAt)}</time>
              </p>
              {f.message ? (
                <p className={styles.body} dir="auto">
                  {f.message}
                </p>
              ) : (
                <p className={styles.note}>{t('feedbackNoMessage')}</p>
              )}
              {f.page ? <p className="wp-meta">{fb('onPage', { page: f.page })}</p> : null}
              {f.replyTo ? (
                <p className={styles.note}>
                  {t.rich('feedbackReplyTo', {
                    email: f.replyTo,
                    link: (chunks) => <a href={`mailto:${f.replyTo}`}>{chunks}</a>,
                  })}
                  {f.repliedAt ? ` ${fb('repliedOn', { when: when(f.repliedAt) })}` : ''}
                </p>
              ) : null}
              {f.handledAt ? (
                <p className="wp-meta">
                  {fb('handled', { who: f.handledBy ?? fb('someone'), when: when(f.handledAt) })}
                </p>
              ) : null}
              <FeedbackActions id={f.id} status={f.status} note={f.note} replyTo={f.replyTo} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={query.status === 'new' ? fb('allCaughtUp') : t('feedbackEmpty')} />
      )}

      <div className="wp-row">
        {query.before ? (
          <LinkButton href={href({})} variant="quiet" icon="back">
            {t('newest')}
          </LinkButton>
        ) : null}
        {list.next ? (
          <LinkButton href={href({ before: list.next })} variant="secondary" icon="forward">
            {t('older')}
          </LinkButton>
        ) : null}
      </div>
    </section>
  );
}
