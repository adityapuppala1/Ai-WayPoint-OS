'use client';

import type { analytics } from '@waypoint/api';
import {
  BarList,
  Funnel,
  Heatmap,
  Panel,
  StackedBarChart,
  type StatDelta,
  StatStrip,
  StatTile,
  TimeSeriesChart,
} from '@waypoint/ui';
import { useFormatter, useTranslations } from 'next-intl';
import styles from './admin.module.css';

type View = analytics.Analytics;

/** Names worked out on the server, so the page and its script agree on every one. */
export interface AnalyticsNames {
  modules: Record<string, string>;
  feedbackModules: Record<string, string>;
  countries: Record<string, string>;
  languages: Record<string, string>;
  situations: Record<string, string>;
  /** Monday first. */
  weekdays: string[];
  hours: string[];
}

/**
 * The analytics as numbers and charts: a few headline figures with the change from the
 * period before, then people over time, how they find their way in and come back, what they
 * open and when, and where they are. Every chart can be read as a table instead.
 */
export function AnalyticsConsole({ view, names }: { view: View; names: AnalyticsNames }) {
  const t = useTranslations('admin.an');
  const chartT = useTranslations('admin.chart');
  const format = useFormatter();

  const num = (n: number) => format.number(n);
  const compact = (n: number) =>
    format.number(n, { notation: n >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 });
  const share = (r: number) => format.number(r, { style: 'percent', maximumFractionDigits: 0 });
  const one = (n: number) => format.number(n, { maximumFractionDigits: 1 });
  const onDay = (d: string) =>
    format.dateTime(new Date(`${d}T00:00:00Z`), {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  const dayTick = (d: string) =>
    format.dateTime(new Date(`${d}T00:00:00Z`), {
      day: 'numeric',
      month: view.range.days > 31 ? 'short' : undefined,
      timeZone: 'UTC',
    });
  const delta = (
    now: number,
    before: number,
    good: StatDelta['good'] = 'up',
  ): StatDelta | undefined => {
    if (!before) return undefined;
    const r = (now - before) / before;
    return {
      text: format.number(r, {
        style: 'percent',
        signDisplay: 'exceptZero',
        maximumFractionDigits: 0,
      }),
      period: t('vsBefore', { days: view.range.days }),
      direction: Math.abs(r) < 0.005 ? 'flat' : r > 0 ? 'up' : 'down',
      good,
    };
  };
  const labels = {
    chart: chartT('chart'),
    table: chartT('table'),
    view: chartT('view'),
    keys: chartT('keys'),
    noData: chartT('noData'),
  };
  const name = (map: Record<string, string>, id: string) => map[id] ?? id;

  const p = view.people;
  const days = view.daily.map((d) => d.day);
  const newPeople = p.newAccounts + p.newGuests;
  const viewsTotal = view.views.total;
  const funnelIds = ['joined', 'setUp', 'planned', 'returned', 'recent'] as const;
  const heat = names.weekdays.map((_, dow) =>
    names.hours.map((_, hour) => {
      const cell = view.views.byHour.find((h) => h.dow === dow + 1 && h.hour === hour);
      return cell ? cell.n : 0;
    }),
  );
  const smallNote = (n: number) => (n ? t('smallGroups', { n: num(n) }) : undefined);

  /** People by one thing about them, or a word on why there is nothing to show yet. */
  const breakdown = (
    title: string,
    description: string,
    rows: ReadonlyArray<{ id: string; n: number }>,
    label: (id: string) => string,
    category: string,
  ) => (
    <Panel>
      {rows.length ? (
        <BarList
          title={title}
          description={description}
          headingLevel={3}
          items={rows.map((r) => ({
            id: r.id,
            label: label(r.id),
            value: r.n,
            note: p.active ? share(r.n / p.active) : undefined,
          }))}
          formatValue={num}
          labels={{ ...labels, category, value: t('funnelPeople') }}
        />
      ) : (
        <div className={`wp-stack ${styles.emptyChart}`}>
          <h3>{title}</h3>
          <p className="wp-meta">{t('nothingYet')}</p>
        </div>
      )}
    </Panel>
  );

  return (
    <div className="wp-stack">
      <StatStrip label={t('glance')}>
        <StatTile
          label={t('tiles.active')}
          value={num(p.active)}
          delta={delta(p.active, p.activeBefore)}
          trend={{
            values: view.daily.map((d) => d.accounts + d.guests),
            label: t('tiles.activeTrend', { n: num(p.active) }),
          }}
        />
        <StatTile
          label={t('tiles.daily')}
          value={one(p.dailyAverage)}
          note={t('tiles.dailyNote')}
        />
        <StatTile label={t('tiles.weekly')} value={num(p.weekly)} note={t('tiles.weeklyNote')} />
        <StatTile
          label={t('tiles.stickiness')}
          value={p.stickiness === null ? '—' : share(p.stickiness)}
          note={t('tiles.stickinessNote', { monthly: num(p.monthly) })}
        />
        <StatTile
          label={t('tiles.new')}
          value={num(newPeople)}
          delta={delta(newPeople, p.newBefore)}
          note={t('tiles.newNote', { accounts: num(p.newAccounts), guests: num(p.newGuests) })}
        />
        <StatTile
          label={t('tiles.views')}
          value={compact(viewsTotal)}
          delta={delta(viewsTotal, view.views.totalBefore)}
          note={p.active ? t('tiles.viewsNote', { n: one(viewsTotal / p.active) }) : undefined}
        />
      </StatStrip>

      <Panel>
        <TimeSeriesChart
          title={t('activeChart')}
          description={t('activeChartLead')}
          headingLevel={3}
          x={days}
          series={[
            {
              id: 'accounts',
              label: t('series.accounts'),
              values: view.daily.map((d) => d.accounts),
            },
            { id: 'guests', label: t('series.guests'), values: view.daily.map((d) => d.guests) },
          ]}
          formatX={onDay}
          formatTick={dayTick}
          formatValue={num}
          labels={{ ...labels, x: t('day') }}
        />
      </Panel>

      <div className={styles.twoUp}>
        <Panel>
          <StackedBarChart
            title={t('newChart')}
            description={t('newChartLead')}
            headingLevel={3}
            x={days}
            series={[
              {
                id: 'accounts',
                label: t('series.accounts'),
                values: view.daily.map((d) => d.newAccounts),
              },
              {
                id: 'guests',
                label: t('series.guests'),
                values: view.daily.map((d) => d.newGuests),
              },
            ]}
            formatX={onDay}
            formatTick={dayTick}
            formatValue={num}
            labels={{ ...labels, x: t('day'), total: t('series.total') }}
          />
        </Panel>
        <Panel>
          <Funnel
            title={t('funnelChart')}
            description={t('funnelChartLead')}
            headingLevel={3}
            steps={funnelIds.map((id) => ({
              id,
              label: t(`funnel.${id}`),
              value: view.funnel.find((f) => f.id === id)?.n ?? 0,
            }))}
            formatValue={num}
            formatShare={share}
            labels={{
              ...labels,
              step: t('funnelStep'),
              value: t('funnelPeople'),
              fromPrevious: t('fromPrevious'),
              fromFirst: t('fromFirst'),
            }}
          />
        </Panel>
      </div>

      <Panel>
        {view.cohorts.length ? (
          <Heatmap
            title={t('cohortChart')}
            description={t('cohortChartLead')}
            headingLevel={3}
            rows={view.cohorts.map((c) => `${onDay(c.week)} (${num(c.size)})`)}
            cols={['1', '2', '3', '4', '5', '6', '7']}
            values={view.cohorts.map((c) => c.returned)}
            min={0}
            max={1}
            showValues
            formatValue={share}
            formatCol={(c) => t('weekN', { n: Number(c) })}
            labels={{
              ...labels,
              rows: t('cohortRows'),
              scale: t('cohortScale'),
              noData: t('notYet'),
            }}
          />
        ) : (
          <div className={`wp-stack ${styles.emptyChart}`}>
            <h3>{t('cohortChart')}</h3>
            <p className="wp-meta">{t('nothingYet')}</p>
          </div>
        )}
      </Panel>

      <div className={styles.twoUp}>
        <Panel>
          <BarList
            title={t('modulesChart')}
            description={t('modulesChartLead')}
            headingLevel={3}
            items={view.views.byModule.map((m) => ({
              id: m.id,
              label: name(names.modules, m.id),
              value: m.n,
              note: [
                viewsTotal ? share(m.n / viewsTotal) : null,
                m.before ? delta(m.n, m.before)?.text : t('newThisPeriod'),
              ]
                .filter(Boolean)
                .join(' · '),
            }))}
            formatValue={num}
            labels={{ ...labels, category: t('cols.part'), value: t('cols.views') }}
          />
        </Panel>
        <Panel>
          <Heatmap
            title={t('hoursChart')}
            description={t('hoursChartLead')}
            headingLevel={3}
            rows={names.weekdays}
            cols={names.hours}
            values={heat}
            cellHeight={22}
            formatValue={num}
            labels={{ ...labels, rows: t('weekday'), scale: t('cols.views') }}
          />
        </Panel>
      </div>

      <div className={styles.twoUp}>
        {breakdown(
          t('platformsChart'),
          t('platformsChartLead'),
          view.platforms,
          (id) => t(`platform.${id as 'web'}`),
          t('cols.platform'),
        )}
        {breakdown(
          t('languagesChart'),
          smallNote(view.smallGroups.languages) ?? t('peopleActiveLead'),
          view.languages,
          (id) => name(names.languages, id),
          t('cols.language'),
        )}
      </div>

      <div className={styles.twoUp}>
        {breakdown(
          t('countriesChart'),
          smallNote(view.smallGroups.countries) ?? t('peopleActiveLead'),
          view.countries,
          (id) => name(names.countries, id),
          t('cols.country'),
        )}
        {breakdown(
          t('situationsChart'),
          smallNote(view.smallGroups.situations) ?? t('situationsChartLead'),
          view.situations,
          (id) => name(names.situations, id),
          t('cols.situation'),
        )}
      </div>

      {view.feedback.length ? (
        <Panel>
          <BarList
            title={t('feedbackChart')}
            description={t('feedbackChartLead')}
            headingLevel={3}
            items={view.feedback.map((f) => ({
              id: f.id,
              label: name(names.feedbackModules, f.id),
              value: f.avgRating ?? 0,
              note: t('ratings', { n: num(f.n) }),
            }))}
            max={5}
            formatValue={one}
            labels={{ ...labels, category: t('cols.part'), value: t('cols.rating') }}
          />
        </Panel>
      ) : null}
    </div>
  );
}
