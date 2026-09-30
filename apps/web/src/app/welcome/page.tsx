import { safeNextPath } from '@waypoint/core';
import { List, ModuleMark, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LinkRow } from '@/components/LinkRow';
import { PublicShell } from '@/components/shell/PublicShell';
import { WelcomeSign } from '@/components/WelcomeSign';
import { getViewer } from '@/lib/server';
import styles from './welcome.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return { title: { absolute: `${t('title')} — ${t('tagline')}` } };
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getViewer();
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  if (viewer) redirect(safeNext as Route);
  const t = await getTranslations('welcome');

  return (
    <PublicShell>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="welcome-title">
          <h1 id="welcome-title" className={styles.title}>
            {t('title')}
          </h1>
          <p className="wp-lead">{t('lead')}</p>
        </section>

        <WelcomeSign />

        <Panel title={t('pointsTitle')} as="section" headingLevel={2}>
          <dl className={styles.points}>
            <div>
              <dt>
                <ModuleMark module="today" size="sm" />
                {t('point1Title')}
              </dt>
              <dd>{t('point1Body')}</dd>
            </div>
            <div>
              <dt>
                <ModuleMark module="path" size="sm" />
                {t('point2Title')}
              </dt>
              <dd>{t('point2Body')}</dd>
            </div>
            <div>
              <dt>
                <ModuleMark module="shield" size="sm" />
                {t('point3Title')}
              </dt>
              <dd>{t('point3Body')}</dd>
            </div>
          </dl>
        </Panel>

        <Panel flush>
          <List>
            <LinkRow
              href="/shield"
              leading={<ModuleMark module="shield" size="sm" />}
              title={t('checkMessage')}
              description={t('checkMessageHint')}
            />
            <LinkRow
              href="/support"
              leading={<ModuleMark module="support" size="sm" />}
              title={t('getHelp')}
              description={t('getHelpHint')}
            />
          </List>
        </Panel>

        <p className={styles.foot}>
          {t('freeNote')}{' '}
          <span>
            {t('haveAccount')}{' '}
            <Link href={'/sign-in' as Route}>{(await getTranslations('shell'))('signIn')}</Link>
          </span>
        </p>
      </div>
    </PublicShell>
  );
}
