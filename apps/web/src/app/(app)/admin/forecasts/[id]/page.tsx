import { ApiError, forecasts } from '@waypoint/api';
import { localeNames, locales } from '@waypoint/i18n';
import { LinkButton, Notice, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { ForecastEditForm } from '@/components/admin/ForecastEditForm';
import { requireConsole } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('eTitle'), robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Edit an open forecast's details and add translations. What cannot change — the question,
 * how it is judged, the date — is shown as text, not in fields. Once the date has passed or
 * the forecast is judged, nothing can be edited and the page says so.
 */
export default async function EditForecastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireConsole('forecasts', `/admin/forecasts/${id}`);
  if (!UUID.test(id)) notFound();
  const [t, words, format] = await Promise.all([
    getTranslations('admin'),
    getTranslations('forecasts'),
    getFormatter(),
  ]);
  const forecast = await forecasts.adminForecast(viewer.db, id).catch((err: unknown) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });
  // The judgement day is a calendar day (stored as midnight UTC): shown as that day everywhere.
  const judgedOn = format.dateTime(new Date(forecast.resolvesAt), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <Panel
      title={t('eTitle')}
      description={words('judgedOn', { date: judgedOn })}
      as="section"
      actions={
        <LinkButton href={'/admin/forecasts' as Route} variant="quiet" icon="back">
          {t('eBack')}
        </LinkButton>
      }
    >
      {forecast.state === 'open' ? (
        <ForecastEditForm
          forecast={forecast}
          languages={locales.map((l) => ({ id: l, label: localeNames[l] }))}
        />
      ) : (
        <div className="wp-stack">
          <h3 className={styles.itemTitle} lang={forecast.language} dir="auto">
            {forecast.question}
          </h3>
          <Notice title={t('eClosed')} />
        </div>
      )}
    </Panel>
  );
}
