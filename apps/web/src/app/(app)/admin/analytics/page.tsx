import { analytics } from '@waypoint/api';
import { LOCALES, SITUATIONS } from '@waypoint/core';
import { Notice } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { AnalyticsConsole, type AnalyticsNames } from '@/components/admin/AnalyticsConsole';
import styles from '@/components/admin/admin.module.css';
import { requireConsole } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.an');
  return { title: t('title'), robots: { index: false } };
}

type Query = Partial<Record<'range' | 'platform' | 'audience' | 'country' | 'locale', string>>;

/**
 * How Waypoint is used, in totals: how many people, how they find their way in, whether they
 * come back, which parts they open and when. Filters are plain links and a plain form, so
 * the page works before its script has run; groups of fewer than five people never show.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const viewer = await requireConsole('analytics', '/admin/analytics');
  const raw = await searchParams;
  const parsed = analytics.AnalyticsQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : analytics.AnalyticsQuerySchema.parse({});
  const [t, nav, settings, situationsT, format, locale, view] = await Promise.all([
    getTranslations('admin.an'),
    getTranslations('nav'),
    getTranslations('settings'),
    getTranslations('situations'),
    getFormatter(),
    getLocale(),
    analytics.analyticsView(viewer.db, query),
  ]);

  const href = (change: Query) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...raw, ...change })) if (v) next.set(k, v);
    const s = next.toString();
    return (s ? `/admin/analytics?${s}` : '/admin/analytics') as Route;
  };

  // Names are worked out here, once, so the page and its script always agree on them.
  const regions = new Intl.DisplayNames([locale], { type: 'region' });
  const languages = new Intl.DisplayNames([locale], { type: 'language' });
  const regionName = (code: string) => {
    try {
      return regions.of(code) ?? code;
    } catch {
      return code;
    }
  };
  const moduleName = (id: string) =>
    nav.has(id as 'today')
      ? nav(id as 'today')
      : t.has(`modules.${id}` as 'modules.other')
        ? t(`modules.${id}` as 'modules.other')
        : id;
  const countryIds = new Set([
    ...view.countries.map((c) => c.id),
    ...(query.country ? [query.country] : []),
  ]);
  const names: AnalyticsNames = {
    modules: Object.fromEntries(view.views.byModule.map((m) => [m.id, moduleName(m.id)])),
    feedbackModules: Object.fromEntries(
      view.feedback.map((f) => [
        f.id,
        f.id === 'other' ? settings('feedbackOther') : moduleName(f.id),
      ]),
    ),
    countries: Object.fromEntries(
      [...countryIds].map((c) => [c, c === 'unknown' ? t('notSaid') : regionName(c)]),
    ),
    languages: Object.fromEntries([
      ...LOCALES.map((l): [string, string] => [l, languages.of(l) ?? l]),
      ['unknown', t('notSaid')],
    ]),
    situations: Object.fromEntries([
      ...SITUATIONS.map((s) => [s, situationsT(s)] as const),
      ['unsaid', t('notSaid')] as const,
    ]),
    weekdays: Array.from({ length: 7 }, (_, i) =>
      // 1 January 2024 was a Monday.
      format.dateTime(new Date(Date.UTC(2024, 0, 1 + i)), { weekday: 'short', timeZone: 'UTC' }),
    ),
    hours: Array.from({ length: 24 }, (_, h) =>
      format.dateTime(new Date(Date.UTC(2024, 0, 1, h)), { hour: 'numeric', timeZone: 'UTC' }),
    ),
  };

  const chips = <K extends keyof Query>(key: K, values: readonly string[], fallback: string) => (
    <ul className={styles.filters} aria-label={t(`filters.${key}` as 'filters.range')}>
      {values.map((v) => (
        <li key={v}>
          <Link
            href={href({ [key]: v === fallback ? undefined : v } as Query)}
            aria-current={(query[key as keyof typeof query] ?? fallback) === v ? 'page' : undefined}
          >
            {t(`${key}.${v}` as 'range.30d')}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="wp-stack" aria-labelledby="analytics-title">
      <header className={styles.sectionHead}>
        <h2 id="analytics-title">{t('title')}</h2>
        <p className="wp-lead">{t('lead')}</p>
      </header>

      <div className={styles.filterGroups}>
        {chips('range', ['7d', '30d', '90d', '365d'], '30d')}
        {chips('platform', ['all', 'web', 'phone', 'text'], 'all')}
        {chips('audience', ['all', 'accounts', 'guests'], 'all')}
      </div>
      <search>
        <form className={styles.searchRow} action="/admin/analytics" method="get">
          {(['range', 'platform', 'audience'] as const).map((k) =>
            raw[k] ? <input key={k} type="hidden" name={k} value={raw[k]} /> : null,
          )}
          <label className={styles.inlineField}>
            <span>{t('filters.country')}</span>
            <select
              name="country"
              defaultValue={query.country ?? ''}
              className={styles.searchInput}
            >
              <option value="">{t('everywhere')}</option>
              {[...countryIds]
                .filter((c) => c !== 'unknown')
                .sort((a, b) => regionName(a).localeCompare(regionName(b), locale))
                .map((c) => (
                  <option key={c} value={c}>
                    {regionName(c)}
                  </option>
                ))}
            </select>
          </label>
          <label className={styles.inlineField}>
            <span>{t('filters.locale')}</span>
            <select name="locale" defaultValue={query.locale ?? ''} className={styles.searchInput}>
              <option value="">{t('everyLanguage')}</option>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {names.languages[l]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={styles.searchButton}>
            {t('apply')}
          </button>
        </form>
      </search>

      <p className="wp-meta">
        {t('period', {
          start: format.dateTime(new Date(`${view.range.start}T00:00:00Z`), {
            dateStyle: 'medium',
            timeZone: 'UTC',
          }),
          end: format.dateTime(new Date(`${view.range.end}T00:00:00Z`), {
            dateStyle: 'medium',
            timeZone: 'UTC',
          }),
        })}
      </p>

      {view.tooFew ? (
        <Notice tone="info" title={t('tooFew')}>
          <p>{t('tooFewBody')}</p>
        </Notice>
      ) : (
        <AnalyticsConsole view={view} names={names} />
      )}

      <p className="wp-meta">{t('privacy')}</p>
    </section>
  );
}
