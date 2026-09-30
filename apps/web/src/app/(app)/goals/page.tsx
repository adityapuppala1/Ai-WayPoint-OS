import { goals as goalsService } from '@waypoint/api';
import { Disclosure, EmptyState, ModuleMark, Panel } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { GoalComposer } from '@/components/goals/GoalComposer';
import { GoalItem } from '@/components/goals/GoalItem';
import styles from '@/components/goals/goals.module.css';
import { WeeklyReview } from '@/components/goals/WeeklyReview';
import { type NextStop, NextStops } from '@/components/NextStops';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('goals');
  return { title: t('title'), description: t('lead') };
}

export default async function GoalsPage() {
  const viewer = await requireViewer('/goals');
  const [t, mind, format] = await Promise.all([
    getTranslations('goals'),
    getTranslations('mind'),
    getFormatter(),
  ]);
  const view = await goalsService.goalsOverview(viewer.db, viewer.user.id, viewer.profile.timezone);
  const active = view.goals.filter((g) => g.status === 'active');
  const rest = view.goals.filter((g) => g.status !== 'active');
  // Where the active goals point: the modules for their parts of life (at most three).
  const stops = active.flatMap((g): NextStop[] => (g.area === 'goals' ? [] : [g.area]));
  const weekDate = (d: string) =>
    format.dateTime(new Date(`${d}T12:00:00`), { day: 'numeric', month: 'long' });

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <div className="wp-row">
          <ModuleMark module="goals" size="lg" />
          <h1>{t('title')}</h1>
        </div>
        <p className="wp-lead">{t('lead')}</p>
      </header>

      <Panel title={t('yourGoals')} as="section">
        {active.length ? (
          <ul className={styles.list}>
            {active.map((g) => (
              <GoalItem key={g.id} goal={g} />
            ))}
          </ul>
        ) : (
          <EmptyState title={t('empty')} />
        )}
        <Disclosure title={t('add')} headingLevel={3} defaultExpanded={active.length === 0}>
          <GoalComposer />
        </Disclosure>
      </Panel>

      <Panel title={t('reviewTitle')} description={t('reviewLead')} as="section" id="review">
        <p className="wp-meta">{t('weekOf', { date: weekDate(view.weekStart) })}</p>
        <WeeklyReview initial={view.thisWeek} />
      </Panel>

      {rest.length ? (
        <Panel title={t('doneTitle')} as="section">
          <ul className={styles.list}>
            {rest.map((g) => (
              <GoalItem key={g.id} goal={g} />
            ))}
          </ul>
        </Panel>
      ) : null}

      {view.recentReviews.length ? (
        <Panel title={t('reviewPast')} as="section">
          {view.recentReviews.map((r) => (
            <Disclosure
              key={r.id}
              title={t('weekOf', { date: weekDate(r.weekStart) })}
              headingLevel={3}
            >
              <dl className={styles.answers}>
                {r.wentWell ? (
                  <div>
                    <dt>{t('wentWell')}</dt>
                    <dd dir="auto">{r.wentWell}</dd>
                  </div>
                ) : null}
                {r.gotInTheWay ? (
                  <div>
                    <dt>{t('gotInTheWay')}</dt>
                    <dd dir="auto">{r.gotInTheWay}</dd>
                  </div>
                ) : null}
                {r.nextChange ? (
                  <div>
                    <dt>{t('nextChange')}</dt>
                    <dd dir="auto">{r.nextChange}</dd>
                  </div>
                ) : null}
                {r.mood ? (
                  <div>
                    <dt>{t('reviewMood')}</dt>
                    <dd>{mind(`moods.${String(r.mood) as '1'}`)}</dd>
                  </div>
                ) : null}
              </dl>
            </Disclosure>
          ))}
        </Panel>
      ) : null}

      <NextStops stops={stops.length ? stops : ['mind', 'path']} />
    </div>
  );
}
