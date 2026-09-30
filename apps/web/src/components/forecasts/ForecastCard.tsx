import { forecasts } from '@waypoint/api';
import { Disclosure, Icon, Probability } from '@waypoint/ui';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import styles from './forecasts.module.css';
import { wordKey } from './words';

type Forecast = forecasts.ForecastView;

type Category = (typeof forecasts.FORECAST_CATEGORIES)[number];
type Reason = 'country' | 'region' | 'sector';

/**
 * One forecast: the question, the chance in a number and in words, what to do about it, where
 * the chance comes from and the day it will be judged — or, once judged, how it turned out.
 */
export async function ForecastCard({
  forecast: f,
  headingLevel = 3,
}: {
  forecast: Forecast;
  headingLevel?: 2 | 3;
}) {
  const [t, today, reasons, common, format, locale] = await Promise.all([
    getTranslations('forecasts'),
    getTranslations('today'),
    getTranslations('relevanceReasons'),
    getTranslations('common'),
    getFormatter(),
    getLocale(),
  ]);
  const Heading = `h${headingLevel}` as 'h3';
  const below = (headingLevel + 1) as 3 | 4;
  const percent = (p: number) => format.number(p, { style: 'percent', maximumFractionDigits: 0 });
  const day = (iso: string) =>
    format.dateTime(new Date(iso), { day: 'numeric', month: 'long', year: 'numeric' });
  const words = t(`words.${wordKey(f.words)}`);
  const category = (forecasts.FORECAST_CATEGORIES as readonly string[]).includes(f.category)
    ? t(`categories.${f.category as Category}`)
    : t('categories.other');
  // "ZZ" marks example rows that belong to no country; it is not a place to name.
  const countries = new Intl.DisplayNames([locale], { type: 'region' });
  const named = f.regions.filter((r) => /^[A-Z]{2}$/.test(r) && r !== 'ZZ');
  const places = named.length
    ? new Intl.ListFormat(locale, { type: 'conjunction' }).format(
        named.map((r) => countries.of(r) ?? r),
      )
    : f.regions.length
      ? null
      : t('everywhere');
  const otherLanguage =
    f.language !== locale
      ? (new Intl.DisplayNames([locale], { type: 'language' }).of(f.language) ?? f.language)
      : null;
  const judged = f.state === 'resolved' || f.state === 'annulled';
  const judgedOn = judged && f.resolvedAt ? f.resolvedAt : f.resolvesAt;

  return (
    <article className={styles.item} data-state={f.state}>
      <div className={styles.head}>
        <p className={styles.topic}>
          <span>{category}</span>
          {places ? (
            <>
              <span aria-hidden className={styles.sep} />
              <span>{places}</span>
            </>
          ) : null}
          {f.isDemo ? (
            <span className="wp-tag" data-tone="demo">
              {common('demoData')}
            </span>
          ) : null}
        </p>
        {/* Staff's own words carry the language they were written in, for screen readers. */}
        <Heading className={styles.question} lang={f.language} dir="auto">
          {f.question}
        </Heading>
        {otherLanguage ? (
          <p className={styles.topic}>{t('writtenIn', { language: otherLanguage })}</p>
        ) : null}
        {f.description ? (
          <p className={styles.description} lang={f.language} dir="auto">
            {f.description}
          </p>
        ) : null}
      </div>

      {judged ? (
        <div className={styles.outcome}>
          <p className={styles.verdict} data-outcome={f.outcome ?? 'annulled'}>
            {t(`outcome.${f.state === 'annulled' ? 'annulled' : (f.outcome ?? 'no')}`)}
          </p>
          <p className={styles.said}>{t('weSaid', { chance: percent(f.probability), words })}</p>
          {f.resolutionNote ? (
            <p className={styles.description} dir="auto">
              {f.resolutionNote}
            </p>
          ) : null}
          {f.resolutionSourceUrl ? (
            <p>
              <a href={f.resolutionSourceUrl} target="_blank" rel="noopener noreferrer">
                {t('checkIt')}
              </a>
            </p>
          ) : null}
        </div>
      ) : (
        <Probability
          className={styles.chance}
          value={f.probability}
          valueText={percent(f.probability)}
          words={words}
          baseRate={f.baseRate ?? undefined}
          baseRateText={f.baseRate !== null ? percent(f.baseRate) : undefined}
          baseRateLabel={t('usual')}
          label={t('chanceLabel')}
        />
      )}

      {!judged && f.whatToDo ? (
        <div className={styles.advice}>
          <p className={styles.factName}>{t('whatToDo')}</p>
          <p lang={f.language} dir="auto">
            {f.whatToDo}
          </p>
        </div>
      ) : null}

      <p className={styles.when}>
        <Icon name="calendar" size={18} />
        <time dateTime={judgedOn}>{t('judgedOn', { date: day(judgedOn) })}</time>
      </p>

      {f.sources.length ? (
        <div className={styles.fact}>
          <p className={styles.factName}>{common('sources')}</p>
          <ul className={styles.sources}>
            {f.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" dir="auto">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.more}>
        <Disclosure title={t('judgedHow')} headingLevel={below}>
          <p lang={f.language} dir="auto">
            {f.resolutionCriteria}
          </p>
        </Disclosure>
        {f.rationale ? (
          <Disclosure title={t('why')} headingLevel={below}>
            <p dir="auto">{f.rationale}</p>
            <p className={styles.note}>{t('updated', { date: day(f.updatedAt) })}</p>
          </Disclosure>
        ) : null}
        {f.reasons.length ? (
          <Disclosure title={today('whySeeing')} headingLevel={below}>
            <ul className={styles.reasons}>
              {f.reasons.map((r) => (
                <li key={r}>{reasons(r as Reason)}</li>
              ))}
            </ul>
          </Disclosure>
        ) : null}
      </div>
    </article>
  );
}
