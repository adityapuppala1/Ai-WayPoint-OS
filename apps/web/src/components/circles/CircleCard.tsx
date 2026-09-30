import type { CircleSummary } from '@waypoint/api/client';
import type { Route } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import styles from './circles.module.css';
import { SeatRing } from './SeatRing';

/** One circle in a list: its seats, name, what it's for and how much room is left. */
export async function CircleCard({ circle: c }: { circle: CircleSummary }) {
  const [t, format, locale] = await Promise.all([
    getTranslations('circles'),
    getFormatter(),
    getLocale(),
  ]);
  const left = Math.max(0, c.maxMembers - c.memberCount);
  return (
    <article className={styles.card}>
      <SeatRing members={c.memberCount} max={c.maxMembers} count={format.number(c.memberCount)} />
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle} lang={c.language}>
          <Link href={`/circles/${c.id}` as Route}>{c.name}</Link>
        </h3>
        <p className={styles.cardDescription} lang={c.language}>
          {c.description}
        </p>
        <p className={styles.meta}>
          <span>{t('memberCount', { count: c.memberCount })}</span>
          {c.joined ? (
            <span className="wp-tag" data-tone="safe">
              {t('joinedTag')}
            </span>
          ) : c.full ? (
            <span className={styles.full}>{t('fullNote')}</span>
          ) : (
            <span>{t('placesLeft', { count: left })}</span>
          )}
          {c.language !== locale ? (
            <span className="wp-tag">
              {t('inLanguage', { language: format.displayName(c.language, { type: 'language' }) })}
            </span>
          ) : null}
        </p>
      </div>
    </article>
  );
}
