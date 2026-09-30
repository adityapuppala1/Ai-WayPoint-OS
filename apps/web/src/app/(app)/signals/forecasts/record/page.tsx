import { forecasts } from '@waypoint/api';
import { getEnv } from '@waypoint/core/env';
import { dbReady, getDb } from '@waypoint/db';
import { EmptyState, LinkButton, Panel, Stat } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { ForecastCard } from '@/components/forecasts/ForecastCard';
import { ForesightNav } from '@/components/forecasts/ForesightNav';
import styles from '@/components/forecasts/forecasts.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('forecasts');
  return { title: t('recordTitle'), description: t('recordLead') };
}

/**
 * The public record: how many forecasts were judged, how close they were, and whether things
 * given a 70% chance happen about 7 times in 10. It says nothing about accuracy until enough
 * forecasts have been judged for the numbers to mean something.
 */
export default async function ForecastRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const asked = Number((await searchParams).page);
  const page = Number.isInteger(asked) && asked >= 1 && asked <= 100_000 ? asked : 1;
  const [t, format, locale] = await Promise.all([
    getTranslations('forecasts'),
    getFormatter(),
    getLocale(),
  ]);
  await dbReady();
  const db = getDb();
  // The same for everyone: no profile, so nothing personal decides the order.
  const [record, list] = await Promise.all([
    forecasts.forecastRecord(db),
    forecasts.listForecasts(
      db,
      { profile: null, matching: false },
      { locale, includeExamples: !getEnv().isProd, judgedPage: page },
    ),
  ]);
  const pages = Math.max(1, Math.ceil(list.judgedTotal / list.judgedPerPage));
  const to = (n: number) =>
    (n === 1 ? '/signals/forecasts/record' : `/signals/forecasts/record?page=${n}`) as Route;
  const percent = (p: number) => format.number(p, { style: 'percent', maximumFractionDigits: 0 });
  const score = (v: number) =>
    format.number(v, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const nothingYet = record.judged === 0 && record.annulled === 0;

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <h1>{t('recordTitle')}</h1>
        <p className="wp-lead">{t('recordLead')}</p>
      </header>
      <ForesightNav current="/signals/forecasts/record" />

      {nothingYet ? (
        <Panel>
          <EmptyState
            title={t('recordEmpty')}
            action={
              <LinkButton href={'/signals/forecasts' as Route} variant="secondary">
                {t('recordEmptyAction')}
              </LinkButton>
            }
          />
        </Panel>
      ) : (
        <>
          <Panel>
            <div className={styles.stats}>
              <Stat value={format.number(record.judged)} label={t('countJudged')} />
              <Stat value={format.number(record.happened)} label={t('countHappened')} />
              <Stat value={format.number(record.open)} label={t('countOpen')} />
              <Stat value={format.number(record.awaiting)} label={t('countAwaiting')} />
              <Stat value={format.number(record.annulled)} label={t('countAnnulled')} />
            </div>
            {record.unchecked ? (
              <p className={styles.note}>{t('uncheckedCount', { count: record.unchecked })}</p>
            ) : null}
            {record.since ? (
              <p className={styles.note}>
                {t('since', {
                  date: format.dateTime(new Date(record.since), {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }),
                })}
              </p>
            ) : null}
          </Panel>

          <Panel id="score" title={t('scoreTitle')}>
            {record.brier !== null ? (
              <div className={styles.score}>
                <Stat
                  value={score(record.brier)}
                  label={t('scoreLabel')}
                  note={t('scoreExplain')}
                />
                {record.reference !== null ? (
                  <p className={styles.note}>
                    {t('referenceLine', { score: score(record.reference) })}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className={styles.note}>
                {t('tooFew', { count: record.judged, min: record.minForScore })}
              </p>
            )}
          </Panel>

          <Panel id="calibration" title={t('calibrationTitle')} description={t('calibrationLead')}>
            {record.calibration?.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('calSaid')}</th>
                      <th scope="col" className={styles.num}>
                        {t('calHappened')}
                      </th>
                      <th scope="col" className={styles.num}>
                        {t('calCount')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.calibration.map((band) => (
                      <tr key={band.from}>
                        <th scope="row">
                          {t('calAverage', {
                            from: percent(band.from),
                            to: percent(band.to),
                            mean: percent(band.meanPredicted),
                          })}
                        </th>
                        <td className={styles.num}>{percent(band.observed)}</td>
                        <td className={styles.num}>{format.number(band.n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.note}>
                {t('calibrationTooFew', { min: record.minForCalibration })}
              </p>
            )}
          </Panel>
        </>
      )}

      <Panel id="how" title={t('howTitle')}>
        <ol className={styles.how}>
          <li>{t('how1')}</li>
          <li>{t('how2')}</li>
          <li>{t('how3')}</li>
          <li>{t('how4')}</li>
          <li>{t('how5')}</li>
          <li>{t('how6')}</li>
        </ol>
      </Panel>

      {list.judged.length ? (
        <Panel flush id="judged" title={t('judgedTitle')}>
          {list.judged.map((f) => (
            <ForecastCard key={f.id} forecast={f} />
          ))}
          {pages > 1 ? (
            <nav className={styles.pager} aria-label={t('pagesLabel')}>
              <p>{t('pageOf', { page, pages })}</p>
              <ul>
                {page > 1 ? (
                  <li>
                    <LinkButton href={to(page - 1)} variant="quiet" size="sm" icon="back">
                      {t('newer')}
                    </LinkButton>
                  </li>
                ) : null}
                {page < pages ? (
                  <li>
                    <LinkButton href={to(page + 1)} variant="quiet" size="sm">
                      {t('older')}
                    </LinkButton>
                  </li>
                ) : null}
              </ul>
            </nav>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
