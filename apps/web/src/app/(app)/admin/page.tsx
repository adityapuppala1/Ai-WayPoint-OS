import { JUDGE_FEATURES } from '@waypoint/ai';
import { admin } from '@waypoint/api';
import { Notice, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';
import styles from '@/components/admin/admin.module.css';
import { requireAdmin } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('title'), robots: { index: false } };
}

const CHANNELS = ['sms', 'whatsapp', 'ussd', 'email'] as const;
const KINDS = ['safety', 'help', 'check', 'questions', 'settings', 'other'] as const;

/**
 * Usage names that have a label (admin.aiFeatures). "forecast" stays for rows an older version
 * may have recorded: no model writes a forecast. The judge's names come from where they are
 * recorded, so a new one cannot be forgotten here and shown as a code.
 */
const FEATURES: string[] = [
  'ask',
  'shield',
  'plan',
  'signal-summary',
  'forecast',
  'moderation',
  'embedding',
  'eval',
  ...JUDGE_FEATURES,
];

function Tile({
  value,
  label,
  children,
  tone,
}: {
  value: ReactNode;
  label: ReactNode;
  children?: ReactNode;
  tone?: 'caution' | 'danger';
}) {
  return (
    <li className={styles.tile} data-tone={tone}>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
      {children}
    </li>
  );
}

export default async function AdminOverviewPage() {
  const viewer = await requireAdmin('/admin');
  const [t, format, locale] = await Promise.all([
    getTranslations('admin'),
    getFormatter(),
    getLocale(),
  ]);
  const [o, waiting] = await Promise.all([
    admin.adminOverview(viewer.db),
    admin.adminCounts(viewer.db),
  ]);
  const n = (v: number) => format.number(v);
  const usd = (v: number) =>
    format.number(v, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const shortDay = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  const share = o.ai.budgetUsd > 0 ? o.ai.monthSpendUsd / o.ai.budgetUsd : 0;
  const meterTone = share >= 1 ? 'danger' : share >= 0.8 ? 'caution' : undefined;
  const maxCalls = Math.max(1, ...o.ai.daily.map((d) => d.calls));
  const peak = o.ai.daily.reduce((a, b) => (b.calls > a.calls ? b : a), o.ai.daily[0]!);
  const providerNames = new Intl.ListFormat(locale, { type: 'conjunction' });
  const texts = new Map(o.channels.byChannel.map((c) => [c.channel as string, c]));
  const textsIn = o.channels.byChannel.reduce((sum, c) => sum + c.in, 0);
  const textsOut = o.channels.byChannel.reduce((sum, c) => sum + c.out, 0);
  const anyChannel = o.channels.ready.sms || o.channels.ready.whatsapp || o.channels.ready.ussd;

  return (
    <>
      <p className={styles.note}>
        {t('generatedAt', {
          time: format.dateTime(new Date(o.generatedAt), { hour: 'numeric', minute: '2-digit' }),
        })}
      </p>

      <div className={styles.grid2}>
        <Panel title={t('peopleTitle')} as="section">
          <div className="wp-stack">
            <ul className={styles.tiles}>
              <Tile value={n(o.people.accounts)} label={t('accounts')} />
              <Tile value={n(o.people.guests)} label={t('guests')} />
              <Tile value={n(o.people.active7d)} label={t('active7d')} />
            </ul>
            <p className={styles.note}>
              {t('newThisWeek', {
                accounts: n(o.people.newAccounts7d),
                guests: n(o.people.newGuests7d),
              })}
            </p>
          </div>
        </Panel>

        <Panel title={t('safetyTitle')} as="section">
          <ul className={styles.tiles}>
            <Tile value={n(o.safety.crisis7d.total)} label={t('crisis7d')}>
              <span className={styles.note}>
                {t('crisisTiers', {
                  urgent: n(o.safety.crisis7d.tier3),
                  high: n(o.safety.crisis7d.tier2),
                  distress: n(o.safety.crisis7d.tier1),
                })}
              </span>
            </Tile>
            <Tile
              value={n(o.safety.followUpsDue)}
              label={t('followUpsDue')}
              tone={o.safety.followUpsDue ? 'caution' : undefined}
            />
            <Tile value={n(o.safety.heldForSafety)} label={t('heldForSafety')} />
            <Tile
              value={n(waiting.moderation)}
              label={t('toReview')}
              tone={waiting.moderation ? 'caution' : undefined}
            >
              <Link href={'/admin/moderation' as Route} className={styles.tileLink}>
                {t('openModeration')}
              </Link>
            </Tile>
            <Tile
              value={n(waiting.reports)}
              label={t('scamNew')}
              tone={waiting.reports ? 'caution' : undefined}
            >
              <Link href={'/admin/reports' as Route} className={styles.tileLink}>
                {t('openReports')}
              </Link>
            </Tile>
          </ul>
        </Panel>
      </div>

      <Panel title={t('aiTitle')} as="section">
        <div className="wp-stack">
          {o.ai.providers.length ? (
            <p className={styles.note}>
              {t('aiProviders', { list: providerNames.format(o.ai.providers) })}
            </p>
          ) : (
            <Notice tone="info" title={t('aiNone')} />
          )}
          <div className={styles.meter} data-tone={meterTone}>
            <p className="wp-strong">
              {t('aiSpend', { spent: usd(o.ai.monthSpendUsd), budget: usd(o.ai.budgetUsd) })}
            </p>
            {/* The sentence above carries the numbers; the bar is its picture. */}
            <span className={styles.meterTrack} aria-hidden="true">
              <span
                className={styles.meterFill}
                style={{ inlineSize: `${Math.min(100, share * 100)}%` } as CSSProperties}
              />
            </span>
          </div>

          <div className={styles.grid2}>
            <div className="wp-stack">
              <p className="wp-strong">{t('aiCalls', { count: o.ai.calls30d })}</p>
              <ul className={styles.rows}>
                {Object.entries(o.ai.byStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <li key={status} className={styles.row}>
                      <span>
                        {['ok', 'fallback', 'error', 'offline', 'blocked'].includes(status)
                          ? t(`aiStatus.${status as 'ok'}`)
                          : status}
                      </span>
                      <span className={styles.rowValue}>{n(count)}</span>
                    </li>
                  ))}
              </ul>
              {o.ai.byFeature.length ? (
                <>
                  <p className="wp-strong">{t('aiByFeature')}</p>
                  <ul className={styles.rows}>
                    {o.ai.byFeature.map((f) => (
                      <li key={f.feature} className={styles.row}>
                        <span>
                          {FEATURES.includes(f.feature)
                            ? t(`aiFeatures.${f.feature as 'ask'}`)
                            : f.feature}
                        </span>
                        <span className={styles.rowValue}>
                          {t('aiFeatureRow', { count: f.calls, cost: usd(f.costUsd) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>

            <figure className={styles.chart}>
              <figcaption className="wp-strong">{t('aiDaily')}</figcaption>
              <ol className={styles.columns} aria-hidden="true">
                {o.ai.daily.map((d) => (
                  <li key={d.date} className={styles.column} data-zero={d.calls === 0}>
                    <span
                      className={styles.columnBar}
                      style={{ blockSize: `${(d.calls / maxCalls) * 100}%` }}
                    />
                    <span className={styles.tip}>
                      {shortDay(d.date)} ·{' '}
                      {t('aiFeatureRow', { count: d.calls, cost: usd(d.costUsd) })}
                    </span>
                  </li>
                ))}
              </ol>
              <div className={styles.axis} aria-hidden="true">
                <span>{shortDay(o.ai.daily[0]!.date)}</span>
                {peak.calls ? (
                  <span>{t('peak', { count: n(peak.calls), date: shortDay(peak.date) })}</span>
                ) : null}
                <span>{shortDay(o.ai.daily.at(-1)!.date)}</span>
              </div>
              <details>
                <summary className={styles.note}>{t('showTable')}</summary>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('day')}</th>
                      <th scope="col">{t('calls')}</th>
                      <th scope="col">{t('cost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.ai.daily.map((d) => (
                      <tr key={d.date}>
                        <th scope="row">{shortDay(d.date)}</th>
                        <td>{n(d.calls)}</td>
                        <td>{usd(d.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </figure>
          </div>
        </div>
      </Panel>

      <div className={styles.grid2}>
        <Panel title={t('deliveryTitle')} as="section">
          <div className="wp-stack">
            <ul className={styles.tiles}>
              <Tile value={n(o.delivery.queued)} label={t('queued')} />
              <Tile
                value={n(o.delivery.failed)}
                label={t('failed')}
                tone={o.delivery.failed ? 'caution' : undefined}
              />
              <Tile
                value={n(o.delivery.jobsFailed)}
                label={t('jobsFailed')}
                tone={o.delivery.jobsFailed ? 'caution' : undefined}
              />
            </ul>
            {o.delivery.lastError ? (
              <p className={styles.note}>{t('lastError', { error: o.delivery.lastError })}</p>
            ) : null}
          </div>
        </Panel>

        <Panel title={t('orgsTitle')} as="section">
          <ul className={styles.tiles}>
            <Tile value={n(o.organisations.organisations)} label={t('orgs')} />
            <Tile value={n(o.organisations.programmes)} label={t('programmes')} />
            <Tile value={n(o.organisations.enrolments)} label={t('enrolments')} />
          </ul>
        </Panel>
      </div>

      <Panel title={t('channelsTitle')} description={t('channelsLead')} as="section" id="channels">
        <div className={styles.grid2}>
          <div className="wp-stack">
            <ul className={styles.rows}>
              {CHANNELS.map((c) => {
                const on = o.channels.ready[c];
                const counts = texts.get(c);
                return (
                  <li key={c} className={styles.row}>
                    <span className={styles.status} data-on={on}>
                      {t(`channelNames.${c}`)}
                      <span className="wp-visually-hidden">: </span>
                      <span className={styles.statusText}>
                        {on ? t('channelOn') : t('channelOff')}
                      </span>
                    </span>
                    {counts ? (
                      <span className={styles.rowValue}>
                        {t('channelRow', { in: n(counts.in), out: n(counts.out) })}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {anyChannel ? null : (
              <Notice tone="info" title={t('channelsNone')}>
                {t('channelsNoneBody')}
              </Notice>
            )}
          </div>
          <div className="wp-stack">
            <ul className={styles.tiles}>
              <Tile value={n(textsIn)} label={t('channelIn')} />
              <Tile value={n(textsOut)} label={t('channelOut')} />
              <Tile value={n(o.channels.numbers30d)} label={t('channelNumbers')} />
            </ul>
            <p className="wp-strong">{t('channelKindsTitle')}</p>
            <ul className={styles.rows}>
              {KINDS.map((k) => (
                <li key={k} className={styles.row}>
                  <span>{t(`channelKinds.${k}`)}</span>
                  <span className={styles.rowValue}>{n(o.channels.byKind[k])}</span>
                </li>
              ))}
            </ul>
            <p className={styles.note}>
              {t('channelOutNote', { ai: o.channels.aiAnswers, codes: o.channels.codes })}
            </p>
          </div>
        </div>
      </Panel>

      <Panel title={t('contentTitle')} description={t('contentLead')} as="section" id="content">
        <div className={styles.grid2}>
          <ul className={styles.rows}>
            {o.content.collections.map((c) => (
              <li key={c.collection} className={styles.row} data-stale={c.stale > 0}>
                <span>{t(`collections.${c.collection as 'support'}`)}</span>
                <span className={styles.rowValue}>
                  {t('contentRow', { total: n(c.total), stale: n(c.stale) })}
                  {c.unsourced && c.stale < c.unsourced
                    ? ` · ${t('contentGeneral', { count: c.unsourced })}`
                    : ''}
                  {c.oldest
                    ? ` · ${t('contentOldest', {
                        date: format.dateTime(new Date(`${c.oldest}T12:00:00Z`), {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'UTC',
                        }),
                      })}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
          <div className="wp-stack">
            <p className="wp-strong">{t('staleTitle')}</p>
            {o.content.staleLifelines.length ? (
              <ul className={styles.rows}>
                {o.content.staleLifelines.slice(0, 50).map((s) => (
                  <li key={`${s.collection}:${s.id}`} className={styles.row} data-stale="true">
                    <span>
                      {s.name}
                      {s.country ? ` (${s.country})` : ''}
                    </span>
                    <span className={styles.rowValue}>
                      {t('checkedOn', { date: s.checkedAt })}
                      {s.url ? (
                        <>
                          {' · '}
                          <a href={s.url} target="_blank" rel="noopener noreferrer">
                            {t('openSource')}
                          </a>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.note}>{t('allFresh')}</p>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
