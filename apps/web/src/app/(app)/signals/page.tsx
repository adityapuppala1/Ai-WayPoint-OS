import { path, signals } from '@waypoint/api';
import { dbReady, getDb } from '@waypoint/db';
import { EmptyState, Panel } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ForesightNav } from '@/components/forecasts/ForesightNav';
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
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const viewer = await getViewer();
  const t = await getTranslations('signals');
  const common = await getTranslations('common');
  const skills = viewer ? await path.getUserSkills(viewer.db, viewer.user.id) : [];
  await dbReady();
  const list = await signals.relevantSignals(
    viewer?.db ?? getDb(),
    {
      userId: viewer?.user.id ?? null,
      profile: viewer?.profile ?? null,
      skillIds: skills.map((s) => s.skillId),
      matching: viewer?.consents.foresight_matching ?? false,
    },
    { query: q?.slice(0, 120), limit: 30, days: 365 },
  );
  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <h1>{t('title')}</h1>
        <p className="wp-lead">{t('lead')}</p>
      </header>
      <ForesightNav current="/signals" />
      <form className={styles.search} action="/signals" aria-label={t('search')}>
        <label htmlFor="signals-q" className="wp-visually-hidden">
          {t('search')}
        </label>
        <input
          id="signals-q"
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder={t('search')}
          className={styles.input}
          maxLength={120}
        />
        <button type="submit" className={styles.button}>
          {common('search')}
        </button>
      </form>
      <Panel flush>
        {list.length ? (
          list.map((s) => <SignalItem key={s.id} signal={s} headingLevel={3} />)
        ) : (
          <EmptyState title={t('empty')} />
        )}
      </Panel>
    </div>
  );
}
