import type { ProgrammeView } from '@waypoint/api/client';
import { EmptyState } from '@waypoint/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import styles from './org.module.css';

type InsightsView = ProgrammeView['insights'];

/**
 * A programme's k-anonymous totals: large groups only, rounded, a little noise, taken once a
 * week and counting people from a week after they join.
 */
export async function Insights({
  insights,
  hasTargets,
}: {
  insights: InsightsView;
  hasTargets: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations('org'), getFormatter()]);
  const { participants, k } = insights;
  const day = (iso: string) =>
    format.dateTime(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso), {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  const timing = `${t('insightsAsOf', { date: day(insights.asOf), next: day(insights.nextUpdate) })} ${t('insightsCountAfter', { days: insights.countAfterDays })}`;
  if (participants.value === null) {
    return (
      <EmptyState title={t('insightsFewTitle')}>
        {t('insightsFew', { k })} {timing}
      </EmptyState>
    );
  }
  const percent = (v: number) => format.number(v, { style: 'percent', maximumFractionDigits: 0 });
  const shares: Array<{ key: string; value: number | null; label: string; note?: string }> = [
    { key: 'plan', value: insights.withPlan, label: t('statPlan') },
    { key: 'moved', value: insights.movedForward, label: t('statMoved') },
    ...(hasTargets
      ? [
          {
            key: 'target',
            value: insights.onTarget,
            label: t('statOnTarget'),
            note: insights.onTargetPending ? t('onTargetPending') : undefined,
          },
        ]
      : []),
  ];
  const top = Math.max(participants.value, 1);
  const bars = (
    items: Array<{ id: string; label: string; n: number }>,
    hidden: boolean,
    title: string,
    id: string,
  ) => (
    <section aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {items.length ? (
        <>
          <ul className={styles.bars}>
            {items.map((g) => (
              <li key={g.id} className={styles.bar}>
                <span>{g.label}</span>
                <span className={styles.barValue}>
                  {t('aboutCount', { count: format.number(g.n) })}
                </span>
                <span className={styles.barTrack} aria-hidden="true">
                  <span
                    className={styles.barFill}
                    style={{ inlineSize: `${Math.min(100, (g.n / top) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
          {hidden ? <p className={styles.hint}>{t('groupsHidden')}</p> : null}
        </>
      ) : (
        <p className={styles.hint}>
          {t('groupsNone')} {hidden ? t('groupsHidden') : null}
        </p>
      )}
    </section>
  );

  return (
    <div className="wp-stack">
      <ul className={styles.stats}>
        <li className={styles.stat}>
          <span className={styles.statValue}>{format.number(participants.value)}</span>
          <span className={styles.statLabel}>{t('statCounted')}</span>
          <span className={styles.statNote}>{t('statCountedNote')}</span>
        </li>
        {shares.map((s) => (
          <li key={s.key} className={styles.stat} data-hidden={s.value === null}>
            <span className={styles.statValue}>
              {s.value === null ? t('statHidden') : percent(s.value)}
            </span>
            <span className={styles.statLabel}>{s.label}</span>
            {s.value === null ? (
              <span className={styles.statNote}>{s.note ?? t('statHiddenNote')}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className={styles.groups}>
        {bars(
          insights.goals.map((g) => ({ id: g.id, label: g.title, n: g.n })),
          insights.goalsHidden,
          t('goalsTitle'),
          'insights-goals',
        )}
        {bars(
          insights.skills.map((s) => ({ id: s.id, label: s.name, n: s.n })),
          insights.skillsHidden,
          t('skillsTitle'),
          'insights-skills',
        )}
      </div>
      <p className={styles.hint}>
        {timing} {t('noiseNote')}
      </p>
    </div>
  );
}
