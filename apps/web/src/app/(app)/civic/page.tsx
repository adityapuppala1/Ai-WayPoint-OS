import { civic } from '@waypoint/api';
import { COUNTRIES, normalizeCountry } from '@waypoint/content';
import { dbReady, getDb } from '@waypoint/db';
import { List, PageHeader, Panel } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { contentLang, EnglishContentNote } from '@/components/EnglishContentNote';
import { LinkRow } from '@/components/LinkRow';
import { CountryPicker } from '@/components/support/CountryPicker';
import { getViewer, guessCountry } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('civic');
  return { title: t('title') };
}

export default async function CivicPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country: q } = await searchParams;
  const [viewer, locale] = await Promise.all([getViewer(), getLocale()]);
  const country = normalizeCountry(q) ?? (await guessCountry());
  const t = await getTranslations('civic');
  await dbReady();
  const view = await civic.civicOverview(viewer?.db ?? getDb(), viewer?.user.id ?? null, country);
  const names = new Intl.DisplayNames([locale, 'en'], { type: 'region' });
  const countries = COUNTRIES.map((c) => ({ code: c.code, name: names.of(c.code) ?? c.name })).sort(
    (a, b) => a.name.localeCompare(b.name, locale),
  );
  const countryName = view.country ? (names.of(view.country) ?? view.countryName) : null;
  const suffix = view.country ? `?country=${view.country}` : '';
  const lang = await contentLang();
  return (
    <div className="wp-page">
      <PageHeader module="civic" title={t('title')} lead={t('lead')} />
      <div style={{ maxInlineSize: '20rem' }}>
        <CountryPicker label={t('country')} countries={countries} value={view.country} />
      </div>
      <EnglishContentNote />
      <Panel title={t('eventsTitle')} flush>
        <List>
          {view.events.map((e) => (
            <LinkRow
              key={e.event}
              href={`/civic/${e.event}${suffix}`}
              title={<span lang={lang}>{e.title}</span>}
              description={
                e.localised && countryName ? t('localised', { country: countryName }) : t('generic')
              }
              meta={e.started ? t('started') : undefined}
            />
          ))}
        </List>
      </Panel>
      {view.portals.length ? (
        <Panel
          title={
            countryName ? t('portalsTitleCountry', { country: countryName }) : t('portalsTitle')
          }
          flush
        >
          <List>
            {view.portals.map((p) => (
              <LinkRow
                key={p.url}
                href={p.url}
                external
                title={p.name}
                description={<span lang={lang}>{p.what}</span>}
              />
            ))}
          </List>
        </Panel>
      ) : null}
      <p className="wp-meta">{t('disclaimer')}</p>
    </div>
  );
}
