import type { MindView } from '@waypoint/api/client';
import { getFormatter, getTranslations } from 'next-intl/server';
import { EmptyNote } from '@/components/EmptyNote';
import { JumpLink } from '@/components/JumpLink';
import styles from './mind.module.css';

/**
 * Two weeks of check-ins as quiet bars. Each bar carries its own label for screen readers, so
 * the chart never depends on seeing it. With nothing to show yet, it points at the check-in
 * (the part of the page with the id `checkinId`).
 */
export async function MoodTrend({
  summary,
  checkinId,
}: {
  summary: MindView['summary'];
  checkinId: string;
}) {
  const t = await getTranslations('mind');
  const format = await getFormatter();
  const day = (d: string) =>
    format.dateTime(new Date(`${d}T12:00:00`), { weekday: 'short', day: 'numeric' });
  const last = summary.days.length - 1;
  const hasAny = summary.days.some((d) => d.mood !== null);
  if (!hasAny)
    return (
      <EmptyNote action={<JumpLink to={checkinId}>{t('checkinTitle')}</JumpLink>}>
        {t('trendEmpty')}
      </EmptyNote>
    );
  return (
    <div>
      <ul className={styles.trend}>
        {summary.days.map((d, i) => (
          <li
            key={d.date}
            className={styles.bar}
            data-empty={d.mood === null}
            data-today={i === last}
          >
            <span
              aria-hidden="true"
              style={d.mood === null ? undefined : { blockSize: `${d.mood * 20}%` }}
            />
            <span className="wp-visually-hidden">
              {d.mood === null
                ? t('dayNone', { date: day(d.date) })
                : t('dayMood', { date: day(d.date), mood: t(`moods.${String(d.mood) as '1'}`) })}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.trendAxis} aria-hidden="true">
        <span>{day(summary.days[0]?.date ?? '')}</span>
        <span>{day(summary.days[last]?.date ?? '')}</span>
      </div>
      {summary.average7 !== null ? (
        <p className="wp-secondary">
          {t('average', {
            mood: t(`moods.${String(Math.round(summary.average7)) as '1'}`),
          })}
        </p>
      ) : null}
    </div>
  );
}
