import type { HealthView } from '@waypoint/api/client';
import { Icon, type IconName } from '@waypoint/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { CSSProperties } from 'react';
import styles from './health.module.css';

type Metric = 'sleep' | 'activity' | 'water';

const ICON: Record<Metric, IconName> = { sleep: 'sleep', activity: 'move', water: 'water' };
const UNIT = { sleep: 'sleepUnit', activity: 'activityUnit', water: 'waterUnit' } as const;
/** Bars are drawn against at least this much, so a small value looks small. */
const FLOOR: Record<Metric, number> = { sleep: 10, activity: 60, water: 8 };

/** The last seven days as small bars, with one line of context from a public health body. */
export async function WeekBars({ week }: { week: HealthView['week'] }) {
  const [t, format] = await Promise.all([getTranslations('health'), getFormatter()]);
  const day = (date: string, style: 'narrow' | 'long') =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      weekday: style,
      ...(style === 'long' ? { day: 'numeric', month: 'long' } : {}),
      timeZone: 'UTC',
    });
  const lastIndex = week.days.length - 1;

  const summary: Record<Metric, string | null> = {
    sleep:
      week.sleepAverage !== null
        ? t('sleepAverage', {
            hours: week.sleepAverage,
            days: week.days.filter((d) => d.sleep !== null).length,
          })
        : null,
    activity: week.activityTotal ? t('activityTotal', { minutes: week.activityTotal }) : null,
    water: null,
  };
  const guide: Record<Metric, string> = {
    sleep: t('sleepGuide'),
    activity: t('activityGuide'),
    water: t('waterGuide'),
  };

  return (
    <ul className={styles.metrics}>
      {(['sleep', 'activity', 'water'] as const).map((m) => {
        const values = week.days.map((d) => d[m]);
        const top = Math.max(FLOOR[m], ...values.map((v) => v ?? 0));
        return (
          <li key={m} className={styles.metric}>
            <span className={styles.metricIcon} aria-hidden="true">
              <Icon name={ICON[m]} size={20} />
            </span>
            <div className={styles.metricBody}>
              <p className={styles.metricTitle}>{t(m)}</p>
              <ol className={styles.bars}>
                {week.days.map((d, i) => {
                  const v = d[m];
                  const label =
                    v === null ? t('notSet') : `${format.number(v)} ${t(UNIT[m], { value: v })}`;
                  return (
                    <li
                      key={d.date}
                      className={styles.bar}
                      data-empty={v === null}
                      data-today={i === lastIndex}
                    >
                      <span className={styles.barTrack} aria-hidden="true">
                        <span
                          className={styles.barFill}
                          style={
                            {
                              blockSize: `${v === null ? 0 : Math.max(6, (v / top) * 100)}%`,
                            } as CSSProperties
                          }
                        />
                      </span>
                      <span className={styles.barDay} aria-hidden="true">
                        {day(d.date, 'narrow')}
                      </span>
                      <span className="wp-visually-hidden">
                        {t('barLabel', { day: day(d.date, 'long'), value: label })}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {summary[m] ? <p className="wp-secondary">{summary[m]}</p> : null}
              <p className={styles.guide}>{guide[m]}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
