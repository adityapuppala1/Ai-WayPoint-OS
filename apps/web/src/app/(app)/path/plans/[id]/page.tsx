import { path } from '@waypoint/api';
import { Icon, Notice, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PlanActions } from '@/components/path/PlanActions';
import styles from '@/components/path/path.module.css';
import { StepCheck } from '@/components/path/StepCheck';
import { requireViewer } from '@/lib/server';

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const viewer = await requireViewer(`/path/plans/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const plan = await path
    .getPlan(viewer.db, viewer.user.id, id, await getLocale())
    .catch(() => null);
  if (!plan) notFound();
  return plan;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const plan = await load(id);
  return { title: plan.title };
}

const COST_KEY = {
  free: 'costFree',
  'free-audit': 'costFreeAudit',
  'low-cost': 'costLowCost',
  paid: 'costPaid',
} as const;

export default async function PlanPage({ params }: Props) {
  const { id } = await params;
  const plan = await load(id);
  const t = await getTranslations('path');
  const kinds = await getTranslations('stepKinds');
  const levels = await getTranslations('skillLevels');
  const today = await getTranslations('today');

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <p className="wp-meta">
          <Link href={'/path' as Route}>{t('title')}</Link>
        </p>
        <h1>{plan.title}</h1>
        <p className="wp-lead">{plan.summary}</p>
        <p className="wp-meta">
          {plan.generatedBy === 'ai' ? t('aiWritten') : t('templateWritten')}
        </p>
        <PlanActions planId={plan.id} status={plan.status} />
      </header>

      {plan.status === 'completed' ? <Notice tone="safe" title={t('allDone')} /> : null}

      {plan.gaps.length ? (
        <Panel title={t('gapsTitle')}>
          <ul className={styles.gaps}>
            {plan.gaps.map((g) => (
              <li key={g.skillId}>
                <span>{g.name}</span>
                <span className="wp-secondary">
                  {t('gapFromTo', {
                    from: levels(String(g.from) as '1'),
                    to: levels(String(g.to) as '1'),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {plan.weeks.map((w) => {
        const done = w.steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
        return (
          <Panel
            key={w.week}
            as="section"
            id={`week-${w.week}`}
            title={t('week', { week: w.week })}
            description={today('progress', { done, total: w.steps.length })}
          >
            <ol className={styles.steps}>
              {w.steps.map((s) => (
                <li
                  key={s.id}
                  id={`step-${s.id}`}
                  className={`${styles.step} ${s.status === 'done' ? styles.stepDone : ''}`}
                >
                  <StepCheck
                    planId={plan.id}
                    stepId={s.id}
                    done={s.status === 'done'}
                    title={s.title}
                  />
                  <div className={styles.stepBody}>
                    <h3 className={styles.stepTitle}>{s.title}</h3>
                    <p className="wp-secondary">{s.detail}</p>
                    <p className={styles.stepMeta}>
                      <span>{kinds(s.kind)}</span>
                      <span>{today('minutes', { count: s.minutes })}</span>
                    </p>
                    {s.resource ? (
                      <p className={styles.resource}>
                        <Icon name="learn" size={16} />
                        <a href={s.resource.url} target="_blank" rel="noopener noreferrer">
                          {s.resource.title}
                        </a>
                        <span className="wp-meta">
                          {s.resource.provider},{' '}
                          {t(COST_KEY[s.resource.cost as keyof typeof COST_KEY] ?? 'costFree')}
                        </span>
                      </p>
                    ) : null}
                    {s.href ? (
                      <p className={styles.resource}>
                        <Icon name="forward" size={16} />
                        <Link href={s.href as Route}>{today('startStep')}</Link>
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        );
      })}
    </div>
  );
}
