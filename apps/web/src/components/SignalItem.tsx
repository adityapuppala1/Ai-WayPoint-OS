import type { SignalView } from '@waypoint/api/client';
import { safeExternalHref } from '@waypoint/core/paths';
import { Disclosure } from '@waypoint/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getViewer } from '@/lib/server';
import styles from './SignalItem.module.css';
import { SignalItemActions } from './SignalItemActions';

type ReasonKey =
  | 'country'
  | 'region'
  | 'global'
  | 'sector'
  | 'skill'
  | 'life-stage'
  | 'situation'
  | 'role';

/**
 * One signal: what changed, where it came from, and why it is shown to this person. Anyone
 * with a session (a guest included) can save it or say it is not relevant to them.
 */
export async function SignalItem({
  signal,
  headingLevel = 3,
  canDismiss = true,
}: {
  signal: SignalView;
  headingLevel?: 3 | 4;
  /** Off on the Saved list: see SignalItemActions. */
  canDismiss?: boolean;
}) {
  const [t, words, reasons, common, format, viewer] = await Promise.all([
    getTranslations('today'),
    getTranslations('signals'),
    getTranslations('relevanceReasons'),
    getTranslations('common'),
    getFormatter(),
    getViewer(),
  ]);
  const Heading = `h${headingLevel}` as 'h3';
  // Only a secure web page becomes a link; anything else is shown as plain text.
  const sourceHref = safeExternalHref(signal.sourceUrl);
  const body = (
    <>
      <div className={styles.head}>
        {/* Signals are written in one language: say which, for screen readers. */}
        <Heading className={styles.title} lang={signal.language} dir="auto">
          {signal.title}
        </Heading>
        {signal.isDemo ? (
          <span className="wp-tag" data-tone="demo">
            {common('demoData')}
          </span>
        ) : null}
      </div>
      <p className={styles.summary} lang={signal.language} dir="auto">
        {signal.summary}
      </p>
      <p className={styles.meta}>
        {sourceHref ? (
          <a href={sourceHref} target="_blank" rel="noopener noreferrer">
            {t('source', { name: signal.sourceName })}
          </a>
        ) : (
          <span>{t('source', { name: signal.sourceName })}</span>
        )}
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
    </>
  );
  // Saving needs a session to belong to; example rows are not something to keep.
  if (!viewer || signal.isDemo) return <article className={styles.item}>{body}</article>;
  return (
    <SignalItemActions
      id={signal.id}
      title={signal.title}
      saved={signal.saved}
      canDismiss={canDismiss}
      labels={{
        save: words('save'),
        saved: words('saved'),
        dismiss: words('dismiss'),
        hidden: words('hidden'),
        undo: words('undo'),
      }}
    >
      {body}
    </SignalItemActions>
  );
}
