import { safeNextPath } from '@waypoint/core';
import { List, ModuleMark, Panel, Route as RouteLine, type Station } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LinkRow } from '@/components/LinkRow';
import { NAV } from '@/components/shell/nav-items';
import { PublicShell } from '@/components/shell/PublicShell';
import { WelcomeSign } from '@/components/WelcomeSign';
import { getViewer } from '@/lib/server';
import { startHref } from './start-href';
import styles from './welcome.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return { title: { absolute: `${t('title')} — ${t('tagline')}` } };
}

/** What getting started asks, in order (the same five stations as on /start). */
const STATIONS = ['place', 'situation', 'skills', 'time', 'privacy'] as const;

/** Modules that open with no account; each has a row of its own further up the page. */
const OPEN = new Set(['shield', 'civic', 'surroundings']);

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getViewer();
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  if (viewer) redirect(safeNext as Route);
  const [t, start, today, nav, modules, civic, forecasts, explore, a11y, shell] = await Promise.all(
    [
      getTranslations('welcome'),
      getTranslations('start'),
      getTranslations('today'),
      getTranslations('nav'),
      getTranslations('modules'),
      getTranslations('civic'),
      getTranslations('forecasts'),
      getTranslations('explore'),
      getTranslations('a11y'),
      getTranslations('shell'),
    ],
  );

  // Nothing is answered yet, so every station is still ahead.
  const stations: Station[] = STATIONS.map((key) => ({
    id: key,
    label: start(`steps.${key}`),
    state: 'upcoming',
  }));

  return (
    <PublicShell>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="welcome-title">
          <h1 id="welcome-title" className={styles.title}>
            {t('title')}
          </h1>
          <p className="wp-lead">{t('lead')}</p>
        </section>

        <div className={styles.start}>
          <WelcomeSign next={safeNext} />
          {/* What "Get started" will ask, before anything is asked. */}
          <Panel title={start('title')} description={start('lead')} as="section" headingLevel={2}>
            <RouteLine
              stations={stations}
              module="today"
              label={start('progressLabel')}
              stateLabels={{
                done: a11y('routeDone'),
                current: a11y('routeCurrent'),
                upcoming: a11y('routeUpcoming'),
              }}
            />
          </Panel>
        </div>

        {/* These open as they are: no account, no questions first. */}
        <Panel title={t('noAccountTitle')} as="section" headingLevel={2} flush>
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
            <LinkRow
              href="/civic"
              leading={<ModuleMark module="civic" size="sm" />}
              title={nav('civic')}
              description={civic('lead')}
            />
            <LinkRow
              href="/surroundings"
              leading={<ModuleMark module="surroundings" size="sm" />}
              title={today('toolWeather')}
              description={modules('surroundings')}
            />
            <LinkRow
              href="/signals/forecasts"
              leading={<ModuleMark module="signals" size="sm" />}
              title={forecasts('title')}
              description={forecasts('lead')}
            />
          </List>
        </Panel>

        {/* The rest of Waypoint. Each row starts getting started and arrives at that module. */}
        <Panel title={explore('lead')} as="section" headingLevel={2} flush>
          <List>
            {NAV.filter((item) => !OPEN.has(item.key)).map((item) => (
              <LinkRow
                key={item.key}
                href={startHref(item.href)}
                leading={<ModuleMark module={item.key} size="sm" />}
                title={nav(item.key as 'today')}
                description={item.key === 'ask' ? t('askHint') : modules(item.key as 'today')}
              />
            ))}
          </List>
        </Panel>

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

        <p className={styles.foot}>
          {t('freeNote')}{' '}
          <span>
            {t('haveAccount')} <Link href={'/sign-in' as Route}>{shell('signIn')}</Link>
          </span>
        </p>
      </div>
    </PublicShell>
  );
}
