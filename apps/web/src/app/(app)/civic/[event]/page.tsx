import { civic } from '@waypoint/api';
import { type LifeEvent, listLifeEvents, normalizeCountry } from '@waypoint/content';
import { dbReady, getDb } from '@waypoint/db';
import { Icon, Panel, ProgressRing } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ChecklistItemCheck } from '@/components/civic/ChecklistItemCheck';
import styles from '@/components/civic/civic.module.css';
import { contentLang, EnglishContentNote } from '@/components/EnglishContentNote';
import { NextStops } from '@/components/NextStops';
import { getViewer, guessCountry } from '@/lib/server';

type Props = { params: Promise<{ event: string }>; searchParams: Promise<{ country?: string }> };

async function load(eventParam: string, q?: string) {
  if (!listLifeEvents().includes(eventParam as LifeEvent)) notFound();
  const viewer = await getViewer();
  const country = normalizeCountry(q) ?? (await guessCountry());
  await dbReady();
  const view = await civic.checklistFor(
    viewer?.db ?? getDb(),
    viewer?.user.id ?? null,
    eventParam as LifeEvent,
    country,
  );
  return { viewer, view, country };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { event } = await params;
  const { country } = await searchParams;
  const { view } = await load(event, country);
  return { title: view.title };
}

const ORDER = ['now', 'this-week', 'this-month', 'later'] as const;

export default async function ChecklistPage({ params, searchParams }: Props) {
  const { event } = await params;
  const { country: q } = await searchParams;
  const { viewer, view, country } = await load(event, q);
  const t = await getTranslations('civic');
  const common = await getTranslations('common');
  const today = await getTranslations('today');
  const format = await getFormatter();
  const lang = await contentLang();
  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <p className="wp-meta">
          <Link href={'/civic' as Route}>{t('title')}</Link>
        </p>
        <h1 lang={lang}>{view.title}</h1>
        <p className="wp-lead" lang={lang}>
          {view.intro}
        </p>
        <EnglishContentNote />
        <div className="wp-row">
          <ProgressRing
            value={view.progress.done}
            total={view.progress.total}
            module="civic"
            label={today('checklistTitle')}
            valueText={format.number(
              view.progress.total ? view.progress.done / view.progress.total : 0,
              { style: 'percent', maximumFractionDigits: 0 },
            )}
          />
          <p className="wp-secondary">
            {today('checklistProgress', { done: view.progress.done, total: view.progress.total })}
          </p>
        </div>
        {!viewer ? <p className="wp-secondary">{t('signInToSave')}</p> : null}
      </header>
      {ORDER.map((urgency) => {
        const items = view.items.filter((i) => i.urgency === urgency);
        if (!items.length) return null;
        return (
          <Panel key={urgency} title={t(`urgency.${urgency}`)} as="section">
            <ol className={styles.items}>
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`${styles.item} ${item.status !== 'todo' ? styles.closed : ''}`}
                >
                  {viewer ? (
                    <ChecklistItemCheck
                      event={view.event}
                      country={country}
                      itemId={item.id}
                      title={item.title}
                      status={item.status}
                    />
                  ) : (
                    <span className={styles.bullet} aria-hidden />
                  )}
                  <div className={styles.body} lang={lang}>
                    <h3 className={styles.title}>{item.title}</h3>
                    <p className="wp-secondary">{item.detail}</p>
                    {item.links.length ? (
                      <ul className={styles.links}>
                        {item.links.map((l) => (
                          <li key={l.url}>
                            <Icon name="external" size={14} />
                            <a href={l.url} target="_blank" rel="noopener noreferrer">
                              {l.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        );
      })}
      <NextStops stops={['money', 'ask']} />
      <p className="wp-meta">
        {common('sources')}:{' '}
        {view.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 ? ', ' : ''}
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
