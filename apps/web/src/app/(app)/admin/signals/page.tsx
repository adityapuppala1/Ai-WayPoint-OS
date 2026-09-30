import { signals } from '@waypoint/api';
import { safeExternalHref } from '@waypoint/core/paths';
import { localeNames, locales } from '@waypoint/i18n';
import { EmptyState, Panel } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { SignalForm } from '@/components/admin/SignalForm';
import { SignalWithdraw } from '@/components/admin/SignalWithdraw';
import { requireAdmin } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('signalsTitle'), robots: { index: false } };
}

type Kind = (typeof signals.SIGNAL_SOURCE_KINDS)[number];

const DAY = 86_400_000;

/**
 * Signals staff have added, and the form to add one. A signal is what staff read somewhere
 * and summarised themselves, with the source: nothing on this page writes one for them.
 */
export default async function AdminSignalsPage() {
  const viewer = await requireAdmin('/admin/signals');
  const [t, words, today, format, locale] = await Promise.all([
    getTranslations('admin'),
    getTranslations('forecasts'),
    getTranslations('today'),
    getFormatter(),
    getLocale(),
  ]);
  const list = await signals.adminSignals(viewer.db);
  const countries = new Intl.DisplayNames([locale], { type: 'region' });
  const places = new Intl.ListFormat(locale, { type: 'conjunction' });
  // A signal's day is a calendar day staff chose (stored as midnight UTC): shown as that day.
  const day = (iso: string, chosen = false) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      ...(chosen ? { timeZone: 'UTC' } : {}),
    });
  const kind = (k: string) =>
    (signals.SIGNAL_SOURCE_KINDS as readonly string[]).includes(k) ? t(`sKinds.${k as Kind}`) : k;
  const now = Date.now();
  // "Today" for staff east of Greenwich is already tomorrow's date there: allow it.
  const latest = new Date(now + DAY).toISOString().slice(0, 10);
  const earliest = new Date(now - (signals.SIGNAL_WINDOW_DAYS - 1) * DAY)
    .toISOString()
    .slice(0, 10);

  return (
    <>
      <Panel title={t('signalsTitle')} description={t('signalsLead')} as="section">
        {list.items.length ? (
          <ul className={styles.items}>
            {list.items.map((s) => {
              const named = s.regions.filter((r) => /^[A-Z]{2}$/.test(r) && r !== 'ZZ');
              const href = safeExternalHref(s.sourceUrl);
              return (
                <li key={s.id} className={styles.item}>
                  <p className={styles.itemHead}>
                    <span className="wp-tag">{kind(s.source)}</span>
                    <span>
                      {named.length
                        ? places.format(named.map((r) => countries.of(r) ?? r))
                        : words('everywhere')}
                    </span>
                    <time dateTime={s.publishedAt}>{day(s.publishedAt, true)}</time>
                    <span>{t('sImportanceValue', { value: s.importance })}</span>
                  </p>
                  <h3 className={styles.itemTitle} lang={s.language} dir="auto">
                    {s.title}
                  </h3>
                  <p className={styles.body} lang={s.language} dir="auto">
                    {s.summary}
                  </p>
                  <p className={styles.note}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {today('source', { name: s.sourceName })}
                      </a>
                    ) : (
                      today('source', { name: s.sourceName })
                    )}
                  </p>
                  {s.sectors.length ? (
                    <p className={styles.note}>
                      {t('sSectors')}: {places.format(s.sectors)}
                    </p>
                  ) : null}
                  <p className={styles.note}>
                    {t('sAdded', { date: day(s.createdAt) })}
                    {s.shown ? null : ` ${t('sNotShown')}`}
                  </p>
                  <SignalWithdraw id={s.id} title={s.title} />
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title={t('signalsEmpty')} />
        )}
      </Panel>

      <Panel id="add" title={t('signalNew')} as="section">
        <SignalForm
          kinds={signals.SIGNAL_SOURCE_KINDS.map((k) => ({ id: k, label: kind(k) }))}
          languages={locales.map((l) => ({ id: l, label: localeNames[l] }))}
          latest={latest}
          earliest={earliest}
        />
      </Panel>
    </>
  );
}
