import { forecasts } from '@waypoint/api';
import { localeNames, locales } from '@waypoint/i18n';
import { EmptyState, LinkButton, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { ForecastActions } from '@/components/admin/ForecastActions';
import { ForecastConfirm } from '@/components/admin/ForecastConfirm';
import { ForecastForm } from '@/components/admin/ForecastForm';
import { wordKey } from '@/components/forecasts/words';
import { requireAdmin } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('forecastsTitle'), robots: { index: false } };
}

type Filter = forecasts.AdminForecastFilter;
type Category = (typeof forecasts.FORECAST_CATEGORIES)[number];

const DAY = 86_400_000;

export default async function AdminForecastsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const viewer = await requireAdmin('/admin/forecasts');
  const { state: asked } = await searchParams;
  const state: Filter = (forecasts.ADMIN_FORECAST_FILTERS as readonly string[]).includes(
    asked ?? '',
  )
    ? (asked as Filter)
    : 'open';
  const [t, words, format, locale] = await Promise.all([
    getTranslations('admin'),
    getTranslations('forecasts'),
    getFormatter(),
    getLocale(),
  ]);
  const list = await forecasts.adminForecasts(viewer.db, state, {
    locale,
    viewerId: viewer.user.id,
  });
  const countries = new Intl.DisplayNames([locale], { type: 'region' });
  const places = new Intl.ListFormat(locale, { type: 'conjunction' });
  const percent = (p: number) => format.number(p, { style: 'percent', maximumFractionDigits: 0 });
  // The judgement day is a calendar day (stored as midnight UTC): shown as that day everywhere.
  const day = (iso: string, chosen = false) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      ...(chosen ? { timeZone: 'UTC' } : {}),
    });
  const category = (c: string) =>
    (forecasts.FORECAST_CATEGORIES as readonly string[]).includes(c)
      ? words(`categories.${c as Category}`)
      : words('categories.other');
  // A forecast is judged at least a day after it is published (two, to be clear of time zones).
  const earliest = new Date(Date.now() + 2 * DAY).toISOString().slice(0, 10);

  return (
    <>
      <Panel title={t('forecastsTitle')} description={t('forecastsLead')} as="section">
        <div className="wp-stack">
          <nav aria-label={t('statusFilter')}>
            <ul className={styles.filters}>
              {forecasts.ADMIN_FORECAST_FILTERS.map((s) => (
                <li key={s}>
                  <Link
                    href={
                      (s === 'open' ? '/admin/forecasts' : `/admin/forecasts?state=${s}`) as Route
                    }
                    aria-current={s === state ? 'page' : undefined}
                  >
                    {t(`forecastStates.${s}`)}
                    <span className="wp-num">{format.number(list.counts[s] ?? 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {state === 'unchecked' ? <p className={styles.note}>{t('cLead')}</p> : null}
          {list.items.length ? (
            <ul className={styles.items}>
              {list.items.map((f) => {
                const judged = f.state === 'resolved' || f.state === 'annulled';
                // A verdict someone else recorded is waiting for this member of staff.
                const toConfirm = judged && f.doubleChecked === false && !f.judgedByYou;
                return (
                  <li
                    key={f.id}
                    className={styles.item}
                    data-tone={f.state === 'awaiting' || toConfirm ? 'caution' : undefined}
                  >
                    <p className={styles.itemHead}>
                      <span className="wp-tag">{category(f.category)}</span>
                      <span>
                        {f.regions.length
                          ? places.format(f.regions.map((r) => countries.of(r) ?? r))
                          : words('everywhere')}
                      </span>
                      <time dateTime={f.resolvesAt}>
                        {words('judgedOn', {
                          date: f.resolvedAt ? day(f.resolvedAt) : day(f.resolvesAt, true),
                        })}
                      </time>
                    </p>
                    <h3 className={styles.itemTitle} lang={f.language} dir="auto">
                      {f.question}
                    </h3>
                    <p className={styles.note}>
                      {judged
                        ? `${words(`outcome.${f.state === 'annulled' ? 'annulled' : (f.outcome ?? 'no')}`)}. `
                        : null}
                      {words('weSaid', {
                        chance: percent(f.probability),
                        words: words(`words.${wordKey(f.words)}`),
                      })}
                    </p>
                    <p className={styles.body} lang={f.language} dir="auto">
                      {f.resolutionCriteria}
                    </p>
                    {f.resolutionNote ? (
                      <p className={styles.note} dir="auto">
                        {f.resolutionNote}
                      </p>
                    ) : null}
                    {judged && f.resolutionSourceUrl ? (
                      <p className={styles.note}>
                        <a href={f.resolutionSourceUrl} target="_blank" rel="noopener noreferrer">
                          {words('checkIt')}
                        </a>
                      </p>
                    ) : null}
                    {judged ? (
                      <p className={styles.check} data-state={f.doubleChecked ? 'done' : 'waiting'}>
                        {f.doubleChecked
                          ? t('cChecked')
                          : f.judgedByYou
                            ? t('cYours')
                            : t('cWaiting')}
                      </p>
                    ) : null}
                    {toConfirm ? <ForecastConfirm id={f.id} question={f.question} /> : null}
                    {f.state === 'open' ? (
                      <div className="wp-row">
                        <LinkButton
                          href={`/admin/forecasts/${f.id}` as Route}
                          variant="secondary"
                          icon="edit"
                          aria-label={`${t('eEdit')}: ${f.question}`}
                        >
                          {t('eEdit')}
                        </LinkButton>
                      </div>
                    ) : null}
                    {f.state === 'open' || f.state === 'awaiting' ? (
                      <ForecastActions
                        id={f.id}
                        open={f.state === 'open'}
                        percent={Math.round(f.probability * 100)}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title={t('forecastsEmpty')} />
          )}
        </div>
      </Panel>

      <Panel id="publish" title={t('forecastNew')} as="section">
        <ForecastForm
          categories={forecasts.FORECAST_CATEGORIES.map((c) => ({ id: c, label: category(c) }))}
          languages={locales.map((l) => ({ id: l, label: localeNames[l] }))}
          earliest={earliest}
        />
      </Panel>
    </>
  );
}
