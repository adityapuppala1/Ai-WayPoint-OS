import { forecasts, today } from '@waypoint/api';
import { usesFahrenheit } from '@waypoint/core';
import { Icon, List, ModuleMark, Panel, Route as RouteLine, type Station } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { ForecastCard } from '@/components/forecasts/ForecastCard';
import { LinkRow } from '@/components/LinkRow';
import { SignalItem } from '@/components/SignalItem';
import { NextStepSign } from '@/components/today/NextStepSign';
import { NudgeNotice } from '@/components/today/NudgeNotice';
import { SurroundingsGlance } from '@/components/today/SurroundingsGlance';
import { ltr } from '@/lib/bidi';
import { getViewer } from '@/lib/server';
import styles from './today.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('today');
  return { title: t('title') };
}

function partOfDay(timeZone: string): 'morning' | 'afternoon' | 'evening' {
  let hour = new Date().getUTCHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone }).format(
        new Date(),
      ),
    );
  } catch {
    // unknown zone: fall back to UTC
  }
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

export default async function TodayPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/welcome' as Route);
  const t = await getTranslations('today');
  const money = await getTranslations('money');
  const kinds = await getTranslations('stepKinds');
  const a11y = await getTranslations('a11y');
  const format = await getFormatter();
  const locale = await getLocale();

  const view = await today.today(viewer.db, viewer.user.id, viewer.profile, {
    matching: viewer.consents.foresight_matching,
    locale,
    copy: {
      onboardTitle: t('onboardTitle'),
      onboardDetail: t('onboardDetail'),
      makePlanTitle: t('makePlanTitle'),
      makePlanDetail: t('makePlanDetail'),
      exploreTitle: t('exploreTitle'),
      exploreDetail: t('exploreDetail'),
    },
  });

  // Forecasts that are about this person's country or sector, or about everywhere. Only ones
  // staff have published: with none, Today says nothing about the future.
  const ahead = (
    await forecasts.listForecasts(
      viewer.db,
      { profile: viewer.profile, matching: viewer.consents.foresight_matching },
      // Today only needs what is still ahead; the judged ones are not read at all.
      { locale, judgedPage: false },
    )
  ).open
    .filter((f) => f.reasons.length > 0 || f.regions.length === 0)
    .slice(0, 2);
  const next = ahead.length ? await getTranslations('forecasts') : null;

  const greeting = t(partOfDay(viewer.profile.timezone));
  const heading = view.name ? t('greetingName', { greeting, name: view.name }) : greeting;
  const dateLine = format.dateTime(new Date(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: viewer.profile.timezone,
  });

  const stations: Station[] = view.week.map((s) => ({
    id: s.id,
    label: s.title,
    meta: `${kinds(s.kind)}, ${t('minutes', { count: s.minutes })}`,
    state:
      s.status === 'done' || s.status === 'skipped'
        ? 'done'
        : s.id === view.nextStep.stepId
          ? 'current'
          : 'upcoming',
  }));

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <p className="wp-meta">{dateLine}</p>
        <h1>{heading}</h1>
      </header>

      <NextStepSign
        step={view.nextStep}
        context={
          view.plan
            ? t('planContext', {
                plan: view.plan.title,
                week: view.plan.currentWeek,
                weeks: view.plan.horizonWeeks,
              })
            : undefined
        }
        fromLabel={view.plan?.title}
      />

      {view.nudges.length ? (
        <section className="wp-section" aria-labelledby="nudges">
          <h2 id="nudges" className="wp-visually-hidden">
            {t('nudgesTitle')}
          </h2>
          {view.nudges.map((n) => (
            <NudgeNotice key={n.id} nudge={n} />
          ))}
        </section>
      ) : null}

      {view.plan && stations.length ? (
        <Panel
          title={t('weekTitle')}
          description={t('progress', {
            done: view.week.filter((s) => s.status === 'done' || s.status === 'skipped').length,
            total: view.week.length,
          })}
          actions={
            <Link href={`/path/plans/${view.plan.id}` as Route} className={styles.panelLink}>
              {t('openPlan')}
            </Link>
          }
        >
          <RouteLine
            stations={stations}
            module="path"
            label={t('weekLabel')}
            stateLabels={{
              done: a11y('routeDone'),
              current: a11y('routeCurrent'),
              upcoming: a11y('routeUpcoming'),
            }}
          />
        </Panel>
      ) : null}

      {view.checklist ? (
        <Panel title={t('checklistTitle')} flush>
          <List>
            <LinkRow
              href={view.checklist.href}
              leading={<ModuleMark module="civic" size="sm" />}
              title={view.checklist.title}
              description={t('checklistProgress', {
                done: view.checklist.done,
                total: view.checklist.total,
              })}
            />
          </List>
        </Panel>
      ) : null}

      <Panel title={t('changedTitle')} flush>
        {view.signals.length ? (
          view.signals.map((s) => <SignalItem key={s.id} signal={s} />)
        ) : (
          <p className={styles.empty}>{t('changedEmpty')}</p>
        )}
      </Panel>

      {next ? (
        <Panel
          title={next('todayTitle')}
          flush
          actions={
            <Link href={'/signals/forecasts' as Route} className={styles.panelLink}>
              {next('seeAll')}
            </Link>
          }
        >
          {ahead.map((f) => (
            <ForecastCard key={f.id} forecast={f} />
          ))}
        </Panel>
      ) : null}

      <Panel title={t('toolsTitle')} flush>
        <List>
          <LinkRow
            href="/shield"
            leading={<ModuleMark module="shield" size="sm" />}
            title={t('toolShield')}
            description={t('toolShieldHint')}
          />
          <LinkRow
            href="/money"
            leading={<ModuleMark module="money" size="sm" />}
            title={view.money ? money(`stress.${view.money.stress}.title`) : t('toolMoney')}
            description={
              view.money
                ? view.money.monthsOfRunway === null
                  ? money('runwayNone')
                  : view.money.monthsOfRunway < 1
                    ? money('runwayLessThanMonth')
                    : money('runwayMonths', { months: view.money.monthsOfRunway })
                : t('toolMoneyHint')
            }
          />
          <SurroundingsGlance imperialDefault={usesFahrenheit(viewer.profile.country)} />
          <LinkRow
            href="/mind"
            leading={<ModuleMark module="mind" size="sm" />}
            title={t('toolMind')}
            description={t('toolMindHint')}
          />
          <LinkRow
            href="/circles"
            leading={<ModuleMark module="circles" size="sm" />}
            title={t('toolCircles')}
            description={t('toolCirclesHint')}
          />
          <LinkRow
            href="/ask"
            leading={<ModuleMark module="ask" size="sm" />}
            title={t('toolAsk')}
            description={t('toolAskHint')}
          />
          <LinkRow
            href="/support"
            leading={<ModuleMark module="support" size="sm" />}
            title={t('toolHelp')}
            description={t('toolHelpHint')}
          />
        </List>
      </Panel>

      {view.emergencyNumber ? (
        <p className={styles.emergency}>
          <Icon name="phone" size={16} />
          <span>
            {t.rich('emergencyLine', {
              number: ltr(view.emergencyNumber),
              link: (chunks) => <a href={`tel:${view.emergencyNumber}`}>{chunks}</a>,
            })}
          </span>
        </p>
      ) : null}
    </div>
  );
}
