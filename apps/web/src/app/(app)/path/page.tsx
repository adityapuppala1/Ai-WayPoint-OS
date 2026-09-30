import { org, path } from '@waypoint/api';
import {
  EmptyState,
  LinkButton,
  List,
  ModuleMark,
  Panel,
  Route as RouteLine,
  type Station,
} from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { LinkRow } from '@/components/LinkRow';
import { NextStops } from '@/components/NextStops';
import { RoleCard } from '@/components/path/RoleCard';
import { requireViewer } from '@/lib/server';
import styles from './path.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('path');
  return { title: t('title') };
}

export default async function PathPage() {
  const viewer = await requireViewer('/path');
  const t = await getTranslations('path');
  const levels = await getTranslations('skillLevels');
  const a11y = await getTranslations('a11y');
  const locale = await getLocale();
  const [view, joined] = await Promise.all([
    path.pathOverview(viewer.db, viewer.user.id, viewer.profile, locale),
    org.myProgrammes(viewer.db, viewer.user.id, locale),
  ]);
  const programmes = joined.programmes.filter((p) => !p.archived && p.targetRoles.length);
  const plan = view.activePlan;

  const weekStations: Station[] = plan
    ? Array.from({ length: plan.horizonWeeks }, (_, i) => {
        const week = i + 1;
        return {
          id: String(week),
          label: t('week', { week }),
          state:
            week < plan.currentWeek ? 'done' : week === plan.currentWeek ? 'current' : 'upcoming',
        };
      })
    : [];

  return (
    <div className="wp-page">
      <header className="wp-page-head wp-page-head-row">
        <div className="wp-page-head">
          <h1>{t('title')}</h1>
          <p className="wp-lead">{t('lead')}</p>
        </div>
        <LinkButton href={'/path/new' as Route} variant={plan ? 'secondary' : 'primary'} icon="add">
          {plan ? t('newPlan') : t('makePlan')}
        </LinkButton>
      </header>

      {plan ? (
        <Panel
          title={plan.title}
          description={t('progress', { done: plan.progress.done, total: plan.progress.total })}
          actions={<Link href={`/path/plans/${plan.id}` as Route}>{t('activePlan')}</Link>}
        >
          <div className={styles.planBody}>
            <p>{plan.summary}</p>
            <RouteLine
              stations={weekStations}
              orientation="horizontal"
              compact={plan.horizonWeeks > 8}
              module="path"
              label={t('activePlan')}
              stateLabels={{
                done: a11y('routeDone'),
                current: a11y('routeCurrent'),
                upcoming: a11y('routeUpcoming'),
              }}
            />
            {view.nextStep ? (
              <div className={styles.next}>
                <p className="wp-meta">{t('nextStep')}</p>
                <Link
                  href={`/path/plans/${plan.id}#step-${view.nextStep.id}` as Route}
                  className={styles.nextLink}
                >
                  {view.nextStep.title}
                </Link>
              </div>
            ) : null}
          </div>
        </Panel>
      ) : (
        <Panel>
          <EmptyState
            title={t('noPlanTitle')}
            action={
              <LinkButton href={'/path/new' as Route} variant="primary" icon="forward">
                {t('makePlan')}
              </LinkButton>
            }
          >
            {t('noPlanBody')}
          </EmptyState>
        </Panel>
      )}

      <section className="wp-section" aria-labelledby="suggestions">
        <div>
          <h2 id="suggestions">{t('suggestionsTitle')}</h2>
          <p className="wp-secondary">{t('suggestionsLead')}</p>
        </div>
        <div className={styles.roles}>
          {view.suggestions.map((s) => (
            <RoleCard key={s.roleId} suggestion={s} />
          ))}
        </div>
      </section>

      {programmes.map((p) => (
        <Panel
          key={p.id}
          title={t('programmeTitle')}
          description={t('programmeLead', { organisation: p.organisation, programme: p.name })}
          as="section"
          flush
        >
          <List>
            {p.targetRoles.map((r) => (
              <LinkRow
                key={r.id}
                href={`/path/roles/${r.id}`}
                leading={<ModuleMark module="org" size="sm" />}
                title={r.title}
                meta={t('programmeRole')}
              />
            ))}
          </List>
        </Panel>
      ))}

      <Panel
        title={t('skillsTitle')}
        flush
        actions={
          <Link href={'/path/skills' as Route} className={styles.small}>
            {t('editSkills')}
          </Link>
        }
      >
        {view.skills.length ? (
          <List>
            {view.skills.map((s) => (
              <LinkRow
                key={s.skillId}
                href="/path/skills"
                title={s.name}
                meta={levels(String(s.level) as '1')}
              />
            ))}
          </List>
        ) : (
          <p className={styles.pad}>{t('skillsEmpty')}</p>
        )}
      </Panel>

      {view.otherPlans.length ? (
        <Panel title={t('otherPlans')} flush>
          <List>
            {view.otherPlans.map((p) => (
              <LinkRow
                key={p.id}
                href={`/path/plans/${p.id}`}
                title={p.title}
                description={t('progress', { done: p.progress.done, total: p.progress.total })}
                meta={
                  p.status === 'completed'
                    ? t('completed')
                    : p.status === 'paused'
                      ? t('paused')
                      : undefined
                }
              />
            ))}
          </List>
        </Panel>
      ) : null}

      <NextStops stops={['signals', 'circles']} />
    </div>
  );
}
