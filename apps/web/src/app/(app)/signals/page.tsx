import { path, signals } from '@waypoint/api';
import { dbReady, getDb } from '@waypoint/db';
import { Button, EmptyState, LinkButton, PageHeader, Panel, SearchField } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ForesightNav } from '@/components/forecasts/ForesightNav';
import { NextStops } from '@/components/NextStops';
import { SignalItem } from '@/components/SignalItem';
import { getViewer } from '@/lib/server';
import styles from './signals.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signals');
  return { title: t('title') };
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string }>;
}) {
  const { q, saved } = await searchParams;
  const viewer = await getViewer();
  const [t, common, forecasts] = await Promise.all([
    getTranslations('signals'),
    getTranslations('common'),
    getTranslations('forecasts'),
  ]);
  const skills = viewer ? await path.getUserSkills(viewer.db, viewer.user.id) : [];
  await dbReady();
  const db = viewer?.db ?? getDb();
  const who = {
    userId: viewer?.user.id ?? null,
    profile: viewer?.profile ?? null,
    skillIds: skills.map((s) => s.skillId),
    matching: viewer?.consents.foresight_matching ?? false,
  };
  // What someone saved needs a session to belong to (a guest session counts).
  const showSaved = Boolean(viewer) && saved === '1';
  const query = showSaved ? '' : (q?.trim().slice(0, 120) ?? '');
  const list = showSaved
    ? await signals.savedSignals(db, who)
    : await signals.relevantSignals(db, who, {
        query,
        limit: 30,
        days: signals.SIGNAL_WINDOW_DAYS,
      });
  const showAll = (
    <LinkButton href={'/signals' as Route} variant="secondary">
      {t('showAll')}
    </LinkButton>
  );
  return (
    <div className="wp-page wp-page-wide">
      <PageHeader module="signals" title={t('title')} lead={t('lead')} />
      <div className="wp-split">
        <div className="wp-split-main">
          <ForesightNav current="/signals" />
          {viewer ? (
            <nav aria-label={t('filterLabel')}>
              <ul className={styles.filters}>
                <li>
                  <Link href={'/signals' as Route} aria-current={showSaved ? undefined : 'page'}>
                    {t('filterAll')}
                  </Link>
                </li>
                <li>
                  <Link
                    href={'/signals?saved=1' as Route}
                    aria-current={showSaved ? 'page' : undefined}
                  >
                    {t('saved')}
                  </Link>
                </li>
              </ul>
            </nav>
          ) : null}
          {showSaved ? null : (
            <form className={styles.search} action="/signals" aria-label={t('search')}>
              <SearchField
                className={styles.field}
                label={t('search')}
                placeholder={t('search')}
                name="q"
                defaultValue={query}
                maxLength={120}
              />
              <Button type="submit" variant="secondary" icon="search">
                {common('search')}
              </Button>
            </form>
          )}
          <Panel flush>
            {list.length ? (
              list.map((s) => (
                <SignalItem key={s.id} signal={s} headingLevel={3} canDismiss={!showSaved} />
              ))
            ) : showSaved ? (
              <EmptyState title={t('savedEmpty')} action={showAll} />
            ) : query ? (
              <EmptyState title={t('noMatch', { query })} action={showAll} />
            ) : (
              // Nothing has changed for this person lately: what may come next is one tap away.
              <EmptyState
                title={t('empty')}
                action={
                  <LinkButton href={'/signals/forecasts' as Route} variant="secondary">
                    {forecasts('navForecasts')}
                  </LinkButton>
                }
              />
            )}
          </Panel>
        </div>
        {/* What changed can change a plan: where to take it next, beside the list. Without a
            session, the places that work without one. */}
        <div className="wp-split-aside">
          <NextStops stops={viewer ? ['path', 'circles'] : ['shield', 'civic']} />
        </div>
      </div>
    </div>
  );
}
