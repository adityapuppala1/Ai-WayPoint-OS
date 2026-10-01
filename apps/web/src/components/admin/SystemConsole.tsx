'use client';

import type { system } from '@waypoint/api';
import {
  BarList,
  Button,
  Icon,
  Notice,
  Panel,
  StackedBarChart,
  StatStrip,
  StatTile,
  TimeSeriesChart,
  toast,
} from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { api, problemKey } from '@/lib/api';
import styles from './admin.module.css';

type View = system.System;
type RouteRow = View['api']['routes'][number];
type SortKey = 'requests' | 'errors' | 'avgMs' | 'p95Ms';

/** Server errors above this share of a day's requests are worth a look. */
const ERROR_RATE_ALERT = 0.02;
/** Work that has waited longer than this means the queue is not being worked. */
const BACKLOG_ALERT_MS = 15 * 60_000;

/** A route's share of requests that failed on the server. */
const errorsOf = (r: RouteRow) => (r.requests ? r.serverErrors / r.requests : 0);

/**
 * The console's System health page: a summary of what needs attention, the numbers that say
 * how the platform is doing, and the detail behind them. Failed work can be retried or
 * cancelled from here; everything else is read-only.
 */
export function SystemConsole({ view, at }: { view: View; at: string }) {
  const t = useTranslations('admin.sys');
  const chartT = useTranslations('admin.chart');
  const errorsT = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('requests');
  const now = new Date(at);

  // ── How numbers are written ──
  const num = (n: number) => format.number(n);
  const compact = (n: number) =>
    format.number(n, { notation: 'compact', maximumFractionDigits: 1 });
  const share = (r: number) =>
    format.number(r, { style: 'percent', maximumFractionDigits: r > 0 && r < 0.01 ? 2 : 1 });
  const ms = (v: number) =>
    v >= 1000
      ? format.number(v / 1000, { style: 'unit', unit: 'second', maximumFractionDigits: 1 })
      : format.number(v, { style: 'unit', unit: 'millisecond', maximumFractionDigits: 0 });
  const bytes = (b: number) => {
    const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;
    let i = 0;
    let v = b;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return format.number(v, {
      style: 'unit',
      unit: units[i],
      unitDisplay: 'short',
      maximumFractionDigits: v < 10 && i > 0 ? 1 : 0,
    });
  };
  const span = (seconds: number) => {
    const unit = (n: number, u: 'day' | 'hour' | 'minute') =>
      format.number(n, { style: 'unit', unit: u, unitDisplay: 'short' });
    const d = Math.floor(seconds / 86_400);
    const h = Math.floor((seconds % 86_400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d) return `${unit(d, 'day')} ${unit(h, 'hour')}`;
    if (h) return `${unit(h, 'hour')} ${unit(m, 'minute')}`;
    return unit(m, 'minute');
  };
  const ago = (iso: string | null) => (iso ? format.relativeTime(new Date(iso), now) : '—');
  const stamp = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const atHour = (h: string) =>
    format.dateTime(new Date(h), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const hourTick = (h: string) => format.dateTime(new Date(h), { hour: 'numeric' });
  const change = (now: number, before: number) => {
    if (!before) return undefined;
    const r = (now - before) / before;
    return {
      text: format.number(r, {
        style: 'percent',
        signDisplay: 'exceptZero',
        maximumFractionDigits: 0,
      }),
      direction:
        Math.abs(r) < 0.005 ? ('flat' as const) : r > 0 ? ('up' as const) : ('down' as const),
    };
  };
  const statusName = (s: string) =>
    t.has(`statuses.${s}` as 'statuses.queued') ? t(`statuses.${s}` as 'statuses.queued') : s;
  const chartLabels = {
    chart: chartT('chart'),
    table: chartT('table'),
    view: chartT('view'),
    keys: chartT('keys'),
    noData: chartT('noData'),
  };

  // ── What needs attention ──
  const { api: traffic, database, jobs, outbox, server } = view;
  const day = traffic.day;
  const errorRate = day.requests ? day.serverErrors / day.requests : 0;
  const waiting = jobs.byStatus.queued ?? 0;
  const failedJobs = jobs.byStatus.failed ?? 0;
  const backlog = jobs.oldestWaitingAt ? now.getTime() - Date.parse(jobs.oldestWaitingAt) : 0;
  const problems: string[] = [];
  if (!database.schemaCurrent) problems.push(t('problems.schema'));
  if (day.requests >= 50 && errorRate >= ERROR_RATE_ALERT)
    problems.push(t('problems.errors', { rate: share(errorRate) }));
  if (failedJobs) problems.push(t('problems.jobs', { n: failedJobs }));
  if (outbox.failed.length) problems.push(t('problems.messages', { n: outbox.failed.length }));
  if (backlog > BACKLOG_ALERT_MS)
    problems.push(t('problems.backlog', { when: ago(jobs.oldestWaitingAt) }));

  // ── Charts ──
  const hours = traffic.hourly.map((h) => h.hour);
  const requestSeries = [
    {
      id: 'ok',
      label: t('series.ok'),
      values: traffic.hourly.map((h) => h.requests - h.clientErrors - h.serverErrors),
    },
    { id: 'client', label: t('series.client'), values: traffic.hourly.map((h) => h.clientErrors) },
    { id: 'server', label: t('series.server'), values: traffic.hourly.map((h) => h.serverErrors) },
  ];
  const hasTraffic = traffic.hourly.some((h) => h.requests > 0);
  const routes = useMemo(() => {
    const value = (r: RouteRow) =>
      sort === 'errors' ? errorsOf(r) : sort === 'p95Ms' ? (r.p95Ms ?? -1) : r[sort];
    return [...traffic.routes].sort((a, b) => value(b) - value(a));
  }, [traffic.routes, sort]);
  const routeName = (r: Pick<RouteRow, 'method' | 'route'>) => `${r.method} ${r.route}`;

  const act = async (kind: 'jobs' | 'outbox', id: string, action: 'retry' | 'cancel') => {
    setBusy(`${id}:${action}`);
    try {
      await api(`/api/admin/${kind}/${id}`, { method: 'POST', json: { action } });
      toast({ title: action === 'retry' ? t('retried') : t('cancelled'), tone: 'safe' });
      startTransition(() => router.refresh());
    } catch (err) {
      toast({ title: errorsT(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const sortHeader = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort === key ? 'descending' : 'none'}>
      <button type="button" className={styles.sortButton} onClick={() => setSort(key)}>
        {label}
      </button>
    </th>
  );

  const requestsDelta = change(day.requests, view.api.previousDay.requests);

  return (
    <div className="wp-stack">
      <div className={styles.refreshRow}>
        <p className="wp-meta" role="status">
          {t('updated', { when: format.dateTime(now, { timeStyle: 'medium' }) })}
        </p>
        <Button
          size="sm"
          variant="secondary"
          icon="retry"
          isBusy={refreshing}
          onPress={() => startTransition(() => router.refresh())}
        >
          {t('refresh')}
        </Button>
      </div>

      {problems.length ? (
        <Notice tone="caution" title={t('attention', { n: problems.length })}>
          <ul className={styles.plainList}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
      ) : (
        <Notice tone="safe" title={t('allWell')} />
      )}
      {server.warnings.length ? (
        <Notice tone="info" title={t('setupNotes', { n: server.warnings.length })}>
          <p className="wp-meta">{t('setupNotesLead')}</p>
          <ul className={styles.plainList} lang="en" dir="ltr">
            {server.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <StatStrip label={t('glance')}>
        <StatTile
          label={t('tiles.requests')}
          value={compact(day.requests)}
          delta={
            requestsDelta
              ? { ...requestsDelta, period: t('vsDayBefore'), good: 'neither' }
              : undefined
          }
          trend={
            hasTraffic
              ? {
                  values: traffic.hourly.slice(-24).map((h) => h.requests),
                  label: t('tiles.requestsTrend', { n: num(day.requests) }),
                }
              : undefined
          }
        />
        <StatTile
          label={t('tiles.errorRate')}
          value={share(errorRate)}
          note={t('tiles.errorCount', {
            server: num(day.serverErrors),
            client: num(day.clientErrors),
          })}
        />
        <StatTile
          label={t('tiles.p95')}
          value={day.p95Ms === null ? '—' : ms(day.p95Ms)}
          note={day.p50Ms === null ? undefined : t('tiles.p50', { value: ms(day.p50Ms) })}
        />
        <StatTile
          label={t('tiles.database')}
          value={database.sizeBytes === null ? '—' : bytes(database.sizeBytes)}
          note={t(`dbKinds.${database.kind}`)}
        />
        <StatTile
          label={t('tiles.waiting')}
          value={num(waiting)}
          note={failedJobs ? t('tiles.failedJobs', { n: failedJobs }) : t('tiles.noneFailed')}
        />
        <StatTile
          label={t('tiles.uptime')}
          value={span(server.uptimeSeconds)}
          note={t('tiles.since', { when: stamp(server.startedAt) })}
        />
      </StatStrip>

      <Panel>
        <StackedBarChart
          title={t('requestsChart')}
          description={t('requestsChartLead')}
          headingLevel={3}
          x={hours}
          series={requestSeries}
          formatX={atHour}
          formatTick={hourTick}
          formatValue={num}
          labels={{ ...chartLabels, x: t('hour'), total: t('series.total') }}
        />
      </Panel>
      <Panel>
        <TimeSeriesChart
          title={t('latencyChart')}
          description={t('latencyChartLead')}
          headingLevel={3}
          x={hours}
          series={[
            { id: 'p95', label: t('series.p95'), values: traffic.hourly.map((h) => h.p95Ms) },
          ]}
          formatX={atHour}
          formatTick={hourTick}
          formatValue={ms}
          labels={{ ...chartLabels, x: t('hour') }}
        />
      </Panel>

      <section className={styles.intCard} aria-labelledby="routes-title">
        <h3 id="routes-title">{t('routesTitle')}</h3>
        <p className="wp-meta">{t('routesLead')}</p>
        {routes.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <caption className="wp-visually-hidden">{t('routesTitle')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('cols.route')}</th>
                  {sortHeader('requests', t('cols.requests'))}
                  {sortHeader('errors', t('cols.errors'))}
                  {sortHeader('avgMs', t('cols.avg'))}
                  {sortHeader('p95Ms', t('cols.p95'))}
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={routeName(r)} data-held={errorsOf(r) >= ERROR_RATE_ALERT || undefined}>
                    <th scope="row">
                      <code className={styles.code}>{routeName(r)}</code>
                    </th>
                    <td className="wp-num">{num(r.requests)}</td>
                    <td className="wp-num">
                      {share(errorsOf(r))}
                      {r.clientErrors ? (
                        <span className="wp-meta">
                          {' '}
                          {t('clientShort', { n: num(r.clientErrors) })}
                        </span>
                      ) : null}
                    </td>
                    <td className="wp-num">{ms(r.avgMs)}</td>
                    <td className="wp-num">{r.p95Ms === null ? '—' : ms(r.p95Ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="wp-meta">{t('noTraffic')}</p>
        )}
      </section>

      <section className={styles.intCard} aria-labelledby="errors-title">
        <h3 id="errors-title">{t('errorsTitle')}</h3>
        <p className="wp-meta">{t('errorsLead')}</p>
        {traffic.errors.length ? (
          <ul className={styles.rows}>
            {traffic.errors.map((e) => (
              <li key={e.id} className={styles.errorRow}>
                <span className={styles.tagRow}>
                  <span className={styles.statusPill} data-status="failing">
                    {e.status}
                  </span>
                  <code className={styles.code}>{routeName(e)}</code>
                  {e.code ? <span className="wp-tag">{e.code}</span> : null}
                </span>
                <span className={styles.errorMessage} lang="en" dir="ltr">
                  {e.message}
                </span>
                <span className="wp-meta">
                  {ago(e.at)}
                  {e.requestId ? ` · ${t('requestId', { id: e.requestId })}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-meta">
            <Icon name="check" size={16} /> {t('noErrors')}
          </p>
        )}
      </section>

      <div className={styles.twoUp}>
        <section className={styles.intCard} aria-labelledby="db-title">
          <h3 id="db-title">{t('dbTitle')}</h3>
          <dl className={styles.facts}>
            <div>
              <dt>{t('db.kind')}</dt>
              <dd>
                {t(`dbKinds.${database.kind}`)}
                {database.version ? ` ${database.version}` : ''}
              </dd>
            </div>
            <div>
              <dt>{t('db.size')}</dt>
              <dd>{database.sizeBytes === null ? '—' : bytes(database.sizeBytes)}</dd>
            </div>
            <div>
              <dt>{t('db.connections')}</dt>
              <dd>{database.connections === null ? '—' : num(database.connections)}</dd>
            </div>
            <div>
              <dt>{t('db.cache')}</dt>
              <dd>{database.cacheHitRatio === null ? '—' : share(database.cacheHitRatio)}</dd>
            </div>
            <div>
              <dt>{t('db.migrations')}</dt>
              <dd>
                {database.migrationsApplied === null ? '—' : num(database.migrationsApplied)}
                {database.lastMigrationAt ? ` · ${ago(database.lastMigrationAt)}` : ''}
              </dd>
            </div>
            <div>
              <dt>{t('db.schema')}</dt>
              <dd>
                <span
                  className={styles.statusPill}
                  data-status={database.schemaCurrent ? 'ok' : 'failing'}
                >
                  <Icon name={database.schemaCurrent ? 'check' : 'caution'} size={14} />
                  {database.schemaCurrent ? t('db.current') : t('db.behind')}
                </span>
              </dd>
            </div>
          </dl>
        </section>
        <Panel>
          <BarList
            title={t('tablesTitle')}
            description={t('tablesLead')}
            headingLevel={3}
            items={database.tables.slice(0, 10).map((tb) => ({
              id: tb.name,
              label: tb.name,
              value: tb.bytes,
              note: t('rows', { n: compact(tb.rows) }),
            }))}
            formatValue={bytes}
            labels={{ ...chartLabels, category: t('cols.table'), value: t('cols.size') }}
          />
        </Panel>
      </div>

      <section className={styles.intCard} aria-labelledby="work-title">
        <h3 id="work-title">{t('workTitle')}</h3>
        <p className="wp-meta">
          {t(server.worker === 'in-process' ? 'workInProcess' : 'workSeparate')}{' '}
          {t('workTimes', {
            waited: ago(jobs.oldestWaitingAt),
            finished: ago(jobs.lastFinishedAt),
          })}
        </p>
        <ul className={styles.filters} aria-label={t('byStatus')}>
          {Object.entries(jobs.byStatus).map(([s, n]) => (
            <li key={s}>
              <span className={styles.countChip}>
                {statusName(s)} <span className="wp-num">{num(n)}</span>
              </span>
            </li>
          ))}
        </ul>
        {jobs.waitingByKind.length ? (
          <p className="wp-meta">
            {t('waitingKinds')}{' '}
            {jobs.waitingByKind.map((k) => `${k.kind} (${num(k.n)})`).join(', ')}
          </p>
        ) : null}
        <h4>{t('failedJobsTitle')}</h4>
        {jobs.failed.length ? (
          <ul className={styles.rows}>
            {jobs.failed.map((j) => (
              <li key={j.id} className={styles.errorRow}>
                <span className={styles.tagRow}>
                  <code className={styles.code}>{j.kind}</code>
                  <span className="wp-meta">
                    {t('attempts', { n: j.attempts })} · {ago(j.at)}
                  </span>
                </span>
                {j.error ? (
                  <span className={styles.errorMessage} lang="en" dir="ltr">
                    {j.error}
                  </span>
                ) : null}
                <span className="wp-row">
                  <Button
                    size="sm"
                    variant="secondary"
                    isBusy={busy === `${j.id}:retry`}
                    isDisabled={busy !== null}
                    onPress={() => void act('jobs', j.id, 'retry')}
                  >
                    {t('retry')}
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    isBusy={busy === `${j.id}:cancel`}
                    isDisabled={busy !== null}
                    onPress={() => void act('jobs', j.id, 'cancel')}
                  >
                    {t('cancel')}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-meta">{t('noFailedJobs')}</p>
        )}
      </section>

      <section className={styles.intCard} aria-labelledby="outbox-title">
        <h3 id="outbox-title">{t('outboxTitle')}</h3>
        <p className="wp-meta">{t('outboxLead')}</p>
        {outbox.byChannel.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <caption className="wp-visually-hidden">{t('outboxTitle')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('cols.channel')}</th>
                  <th scope="col">{t('cols.state')}</th>
                  <th scope="col">{t('cols.count')}</th>
                </tr>
              </thead>
              <tbody>
                {outbox.byChannel.map((c) => (
                  <tr key={`${c.channel}-${c.status}`}>
                    <th scope="row">
                      {t.has(`channels.${c.channel}` as 'channels.email')
                        ? t(`channels.${c.channel}` as 'channels.email')
                        : c.channel}
                    </th>
                    <td>{statusName(c.status)}</td>
                    <td className="wp-num">{num(c.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="wp-meta">{t('noMessages')}</p>
        )}
        <h4>{t('failedMessagesTitle')}</h4>
        {outbox.failed.length ? (
          <ul className={styles.rows}>
            {outbox.failed.map((m) => (
              <li key={m.id} className={styles.errorRow}>
                <span className={styles.tagRow}>
                  <span className="wp-tag">
                    {t.has(`channels.${m.channel}` as 'channels.email')
                      ? t(`channels.${m.channel}` as 'channels.email')
                      : m.channel}
                  </span>
                  {m.template ? <code className={styles.code}>{m.template}</code> : null}
                  <span className="wp-meta">
                    {t('attempts', { n: m.attempts })} · {ago(m.at)}
                  </span>
                </span>
                {m.error ? (
                  <span className={styles.errorMessage} lang="en" dir="ltr">
                    {m.error}
                  </span>
                ) : null}
                <span className="wp-row">
                  <Button
                    size="sm"
                    variant="secondary"
                    isBusy={busy === `${m.id}:retry`}
                    isDisabled={busy !== null}
                    onPress={() => void act('outbox', m.id, 'retry')}
                  >
                    {t('sendAgain')}
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    isBusy={busy === `${m.id}:cancel`}
                    isDisabled={busy !== null}
                    onPress={() => void act('outbox', m.id, 'cancel')}
                  >
                    {t('cancel')}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-meta">{t('noFailedMessages')}</p>
        )}
      </section>

      <section className={styles.intCard} aria-labelledby="server-title">
        <h3 id="server-title">{t('serverTitle')}</h3>
        <dl className={styles.facts}>
          <div>
            <dt>{t('server.version')}</dt>
            <dd>
              {server.version ?? '—'}
              {server.commit ? (
                <>
                  {' · '}
                  <code className={styles.code}>{server.commit.slice(0, 7)}</code>
                </>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>{t('server.environment')}</dt>
            <dd>{server.environment}</dd>
          </div>
          <div>
            <dt>{t('server.runtime')}</dt>
            <dd>
              Node {server.node} · {server.platform}
            </dd>
          </div>
          <div>
            <dt>{t('server.started')}</dt>
            <dd>{stamp(server.startedAt)}</dd>
          </div>
          <div>
            <dt>{t('server.memory')}</dt>
            <dd>
              {t('server.memoryValue', {
                rss: bytes(server.memory.rssBytes),
                heap: bytes(server.memory.heapUsedBytes),
                total: bytes(server.memory.heapTotalBytes),
              })}
            </dd>
          </div>
          <div>
            <dt>{t('server.worker')}</dt>
            <dd>{t(server.worker === 'in-process' ? 'server.inProcess' : 'server.separate')}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
