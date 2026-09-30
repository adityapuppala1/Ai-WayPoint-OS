import { forecasts } from '@waypoint/api';
import { getEnv } from '@waypoint/core/env';
import { dbReady, getDb } from '@waypoint/db';
import { EmptyState, LinkButton, PageHeader, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { ForecastCard } from '@/components/forecasts/ForecastCard';
import { ForesightNav } from '@/components/forecasts/ForesightNav';
import styles from '@/components/forecasts/forecasts.module.css';
import { getViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('forecasts');
  return { title: t('title'), description: t('lead') };
}

/** How many judged forecasts to show here; the rest are on the record page. */
const JUDGED_HERE = 3;

/**
 * "What's next?": what may happen, how likely, and what to do either way. Staff publish every
 * forecast; nothing is generated, so with none published the page says so and stops there.
 */
export default async function ForecastsPage() {
  const [viewer, t, locale] = await Promise.all([
    getViewer(),
    getTranslations('forecasts'),
    getLocale(),
  ]);
  await dbReady();
  const list = await forecasts.listForecasts(
    viewer?.db ?? getDb(),
    {
      profile: viewer?.profile ?? null,
      matching: viewer?.consents.foresight_matching ?? false,
    },
    { locale, includeExamples: !getEnv().isProd },
  );
  return (
    <div className="wp-page">
      <PageHeader module="signals" title={t('title')} lead={t('lead')} />
      <ForesightNav current="/signals/forecasts" />
      <p className={styles.honest}>{t('honest')}</p>

      <Panel flush aria-label={t('title')}>
        {list.open.length ? (
          list.open.map((f) => <ForecastCard key={f.id} forecast={f} headingLevel={2} />)
        ) : (
          <EmptyState
            title={t('empty')}
            action={
              <LinkButton href={'/signals' as Route} variant="secondary" icon="signals">
                {t('emptyAction')}
              </LinkButton>
            }
          />
        )}
      </Panel>

      {list.awaiting.length ? (
        <Panel flush id="awaiting" title={t('awaitingTitle')} description={t('awaitingLead')}>
          {list.awaiting.map((f) => (
            <ForecastCard key={f.id} forecast={f} />
          ))}
        </Panel>
      ) : null}

      {list.judged.length ? (
        <Panel
          flush
          id="judged"
          title={t('judgedTitle')}
          actions={
            <LinkButton href={'/signals/forecasts/record' as Route} variant="quiet" size="sm">
              {t('seeRecord')}
            </LinkButton>
          }
        >
          {list.judged.slice(0, JUDGED_HERE).map((f) => (
            <ForecastCard key={f.id} forecast={f} />
          ))}
        </Panel>
      ) : null}
    </div>
  );
}
