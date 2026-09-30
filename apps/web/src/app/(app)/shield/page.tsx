import { aiAvailable } from '@waypoint/ai';
import { admin } from '@waypoint/api';
import { getReportChannels, getScamPatterns } from '@waypoint/content';
import { dbReady, getDb } from '@waypoint/db';
import { Disclosure, Panel } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { contentLang, EnglishContentNote } from '@/components/EnglishContentNote';
import { NextStops } from '@/components/NextStops';
import { ShieldChecker } from '@/components/shield/ShieldChecker';
import { getViewer, guessCountry } from '@/lib/server';
import styles from './shield.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('shield');
  return { title: t('title'), description: t('lead') };
}

export default async function ShieldPage() {
  const [viewer, country] = await Promise.all([getViewer(), guessCountry()]);
  const t = await getTranslations('shield');
  const patterns = getScamPatterns({ country }).slice(0, 12);
  const channels = getReportChannels(country);
  const lang = await contentLang();
  await dbReady();
  const [reported, format, locale] = await Promise.all([
    admin.reportedScams(viewer?.db ?? getDb(), country),
    getFormatter(),
    getLocale(),
  ]);
  const countryName = country
    ? (new Intl.DisplayNames([locale], { type: 'region' }).of(country) ?? country)
    : null;
  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <h1>{t('title')}</h1>
        <p className="wp-lead">{t('lead')}</p>
      </header>

      <ShieldChecker
        country={country}
        aiAvailable={aiAvailable()}
        aiConsented={viewer?.consents.ai_external ?? false}
        channels={channels}
        // After a high verdict: a person to talk to, and somewhere to think it through.
        afterHigh={<NextStops stops={['support', 'ask']} />}
      />

      {reported.categories.length ? (
        <Panel
          title={
            countryName ? t('reportedTitle', { country: countryName }) : t('reportedTitleAnywhere')
          }
          description={t('reportedLead')}
          as="section"
          id="reported"
        >
          <ul className={styles.reported}>
            {reported.categories.map((c) => (
              <li key={c.category}>
                <p className="wp-strong">{t(`categories.${c.category}`)}</p>
                {/* How many, then how recently: two facts, one line each. */}
                <p className="wp-meta">{t('reportedCount', { count: c.reports })}</p>
                <p className="wp-meta">
                  {t('reportedLatest', {
                    date: format.dateTime(new Date(`${c.latest}T12:00:00Z`), {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    }),
                  })}
                </p>
                {c.hosts.length ? (
                  <p className={styles.reportedHosts}>
                    <span className="wp-meta">{t('reportedHosts')}</span>
                    {c.hosts.map((h) => (
                      <span key={h} className={styles.host} dir="ltr">
                        {h}
                      </span>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title={t('libraryTitle')} description={t('libraryLead')} as="section">
        <EnglishContentNote />
        <div className={styles.library} lang={lang}>
          {patterns.map((p) => (
            <Disclosure key={p.id} title={p.title} headingLevel={3}>
              <div className={styles.pattern}>
                <p>{p.howItWorks}</p>
                <h4>{t('redFlags')}</h4>
                <ul>
                  {p.redFlags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <h4>{t('whatToDo')}</h4>
                <ol>
                  {p.whatToDo.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ol>
                <p className="wp-meta">
                  {p.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 ? ', ' : ''}
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.title}
                      </a>
                    </span>
                  ))}
                </p>
              </div>
            </Disclosure>
          ))}
        </div>
      </Panel>
    </div>
  );
}
