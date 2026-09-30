import type { SignalView } from '@waypoint/api/client';
import { Disclosure } from '@waypoint/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import styles from './SignalItem.module.css';

type ReasonKey =
  | 'country'
  | 'region'
  | 'global'
  | 'sector'
  | 'skill'
  | 'life-stage'
  | 'situation'
  | 'role';

/** One signal: what changed, where it came from, and why it is shown to this person. */
export async function SignalItem({
  signal,
  headingLevel = 3,
}: {
  signal: SignalView;
  headingLevel?: 3 | 4;
}) {
  const t = await getTranslations('today');
  const reasons = await getTranslations('relevanceReasons');
  const common = await getTranslations('common');
  const format = await getFormatter();
  const Heading = `h${headingLevel}` as 'h3';
  return (
    <article className={styles.item}>
      <div className={styles.head}>
        <Heading className={styles.title}>{signal.title}</Heading>
        {signal.isDemo ? (
          <span className="wp-tag" data-tone="demo">
            {common('demoData')}
          </span>
        ) : null}
      </div>
      <p className={styles.summary}>{signal.summary}</p>
      <p className={styles.meta}>
        <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer">
          {t('source', { name: signal.sourceName })}
        </a>
        <span aria-hidden className={styles.sep} />
        <time dateTime={signal.publishedAt}>
          {format.dateTime(new Date(signal.publishedAt), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </time>
      </p>
      {signal.reasons.length ? (
        <Disclosure title={t('whySeeing')} headingLevel={4}>
          <ul className={styles.reasons}>
            {signal.reasons.map((r) => (
              <li key={r}>{reasons(r as ReasonKey)}</li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </article>
  );
}
