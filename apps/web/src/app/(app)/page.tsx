import { forecasts, today } from '@waypoint/api';
import { type ListedModule, moduleOrder, NOT_NOW_COOKIE, usesFahrenheit } from '@waypoint/core';
import type { Messages } from '@waypoint/i18n';
import { Icon, Panel, Route as RouteLine, type Station } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getLocale, getMessages, getTranslations } from 'next-intl/server';
import { contentLang } from '@/components/EnglishContentNote';
import { ForecastCard } from '@/components/forecasts/ForecastCard';
import { SignalItem } from '@/components/SignalItem';
import { GuestNote } from '@/components/today/GuestNote';
import { GUEST_NOTE_COOKIE } from '@/components/today/guest-note';
import { type ModuleLine, ModuleLines } from '@/components/today/ModuleLines';
import { NextStepSign } from '@/components/today/NextStepSign';
import { NudgeNotice } from '@/components/today/NudgeNotice';
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
  const [t, money, kinds, a11y, nav, modules, path, goals, common, format, locale, lang] =
    await Promise.all([
      getTranslations('today'),
      getTranslations('money'),
      getTranslations('stepKinds'),
      getTranslations('a11y'),
      getTranslations('nav'),
      getTranslations('modules'),
      getTranslations('path'),
      getTranslations('goals'),
      getTranslations('common'),
      getFormatter(),
      getLocale(),
      contentLang(),
    ]);

  const store = await cookies();
  const view = await today.today(viewer.db, viewer.user.id, viewer.profile, {
    matching: viewer.consents.foresight_matching,
    locale,
    // Every word on the sign is a message that already exists in this language.
    copy: today.todayCopy((await getMessages()) as unknown as Messages),
    // Steps set aside with "Not now" today. The cookie holds only the day and opaque keys.
    notNow: store.get(NOT_NOW_COOKIE)?.value,
  });
  const step = view.nextStep;
  // A guest with something saved is told, once, where it lives. Not before there is anything
  // to keep, and never again after "Not now".
  const guestNote =
    viewer.user.isGuest && view.hasSaved && store.get(GUEST_NOTE_COOKIE)?.value !== 'off';

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
        : s.id === view.planStepId
          ? 'current'
          : 'upcoming',
  }));

  // A note that is on the sign is not listed a second time underneath it.
  const onSign = step.done?.type === 'note' ? step.done.noteId : null;
  const notes = view.nudges.filter((n) => n.id !== onSign);

  // One line per module: what you can do there, and where things stand when Waypoint knows.
  const line: Record<ListedModule, Omit<ModuleLine, 'module' | 'href'>> = {
    path: view.plan
      ? {
          title: view.plan.title,
          description: path('progress', {
            done: view.plan.progress.done,
            total: view.plan.progress.total,
          }),
        }
      : { title: path('makePlan'), description: path('noPlanBody') },
    shield: { title: t('toolShield'), description: t('toolShieldHint') },
    ask: { title: t('toolAsk'), description: t('toolAskHint') },
    // What changed is listed in full beside this list; this line only says what Signals is.
    signals: { title: nav('signals'), description: modules('signals') },
    circles: { title: t('toolCircles'), description: t('toolCirclesHint') },
    money: view.money
      ? {
          title: money(`stress.${view.money.stress}.title`),
          description:
            view.money.monthsOfRunway === null
              ? money('runwayNone')
              : view.money.monthsOfRunway < 1
                ? money('runwayLessThanMonth')
                : money('runwayMonths', { months: view.money.monthsOfRunway }),
        }
      : { title: t('toolMoney'), description: t('toolMoneyHint') },
    mind: { title: t('toolMind'), description: t('toolMindHint') },
    health: { title: nav('health'), description: modules('health') },
    civic: view.checklist
      ? {
          title: view.checklist.title,
          description: t('checklistProgress', {
            done: view.checklist.done,
            total: view.checklist.total,
          }),
          lang,
        }
      : { title: nav('civic'), description: modules('civic') },
    // The weather line is filled in by this device (its words are in SurroundingsGlance).
    surroundings: { title: t('toolWeather'), description: t('toolWeatherHint') },
    goals: {
      title: nav('goals'),
      description: view.goals.reviewedThisWeek ? goals('reviewDone') : modules('goals'),
    },
  };
  const lines: ModuleLine[] = [
    ...moduleOrder(viewer.profile.situation).map((module) => ({
      module,
      href: `/${module}`,
      ...line[module],
    })),
    {
      module: 'support',
      href: '/support',
      title: t('toolHelp'),
      description: t('toolHelpHint'),
    },
  ];

  return (
    <div className={`wp-page ${styles.page}`}>
      <header className="wp-page-head">
        <p className="wp-meta">{dateLine}</p>
        <h1>{heading}</h1>
      </header>

      <div className="wp-split">
        <div className={styles.main}>
          <NextStepSign
            step={step}
            day={view.day}
            context={
              step.kind === 'plan-step' && view.plan
                ? t('planContext', {
                    plan: view.plan.title,
                    week: view.plan.currentWeek,
                    weeks: view.plan.horizonWeeks,
                  })
                : undefined
            }
          />

          {guestNote ? <GuestNote /> : null}

          {notes.length ? (
            <section className="wp-section" aria-labelledby="nudges">
              <h2 id="nudges" className="wp-visually-hidden">
                {t('nudgesTitle')}
              </h2>
              {notes.map((n) => (
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

          <Panel
            title={t('changedTitle')}
            flush
            actions={
              <Link href={'/signals' as Route} className={styles.panelLink}>
                {common('seeAll')}
              </Link>
            }
          >
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
        </div>

        <aside className={styles.aside} aria-label={t('toolsTitle')}>
          <Panel title={t('toolsTitle')} flush as="div">
            <ModuleLines lines={lines} imperialDefault={usesFahrenheit(viewer.profile.country)} />
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
        </aside>
      </div>
    </div>
  );
}
