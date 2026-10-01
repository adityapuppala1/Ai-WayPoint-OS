import { mind as mindService } from '@waypoint/api';
import { LinkButton, Notice, PageHeader, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Breathing } from '@/components/mind/Breathing';
import { Journal } from '@/components/mind/Journal';
import { MoodCheckin } from '@/components/mind/MoodCheckin';
import { MoodTrend } from '@/components/mind/MoodTrend';
import styles from '@/components/mind/mind.module.css';
import { NextStops } from '@/components/NextStops';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('mind');
  return { title: t('title'), description: t('lead') };
}

export default async function MindPage() {
  const viewer = await requireViewer('/mind');
  const t = await getTranslations('mind');
  const view = await mindService.mindOverview(viewer.db, viewer.user.id, viewer.profile);

  return (
    <div className="wp-page">
      <div className="wp-section">
        <PageHeader module="mind" title={t('title')} lead={t('lead')} />
        <p className="wp-secondary">
          {t('notTherapy')} <Link href={'/support' as Route}>{t('getHelp')}</Link>
        </p>
      </div>

      {view.summary.suggestSupport ? (
        <Notice tone="support" title={t('supportTitle')}>
          <p>{t('supportBody')}</p>
          <div className="wp-row">
            <LinkButton href={'/support' as Route} variant="support" icon="support">
              {t('getHelp')}
            </LinkButton>
            <LinkButton href={'/ask' as Route} icon="ask">
              {t('supportAsk')}
            </LinkButton>
          </div>
        </Notice>
      ) : null}

      <Panel title={t('checkinTitle')} description={t('checkinLead')} as="section" id="checkin">
        <MoodCheckin />
      </Panel>

      <Panel title={t('trendTitle')} as="section">
        <MoodTrend summary={view.summary} checkinId="checkin" />
      </Panel>

      <Panel title={t('journalTitle')} description={t('journalLead')} as="section">
        <Journal entries={view.journal} />
      </Panel>

      <Panel title={t('calmTitle')} as="section">
        <h3>{t('breatheTitle')}</h3>
        <Breathing />
        <h3>{t('groundTitle')}</h3>
        <p className="wp-secondary">{t('groundLead')}</p>
        <ol className={styles.grounding}>
          {(['ground5', 'ground4', 'ground3', 'ground2', 'ground1'] as const).map((k, i) => (
            <li key={k}>
              <b aria-hidden="true">{5 - i}</b>
              <span>{t(k)}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <NextStops stops={['circles', 'ask']} />
    </div>
  );
}
