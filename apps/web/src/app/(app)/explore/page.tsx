import { List, ModuleMark } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LinkRow } from '@/components/LinkRow';
import { NAV } from '@/components/shell/nav-items';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('explore');
  return { title: t('title') };
}

export default async function ExplorePage() {
  const t = await getTranslations('explore');
  const nav = await getTranslations('nav');
  const modules = await getTranslations('modules');
  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <h1>{t('title')}</h1>
        <p className="wp-lead">{t('lead')}</p>
      </header>
      <div className="wp-panel-flat">
        <List>
          {NAV.map((item) => (
            <LinkRow
              key={item.key}
              href={item.href}
              leading={<ModuleMark module={item.key} size="md" />}
              title={nav(item.key as 'today')}
              description={modules(item.key as 'today')}
              meta={item.ready ? undefined : t('soon')}
            />
          ))}
        </List>
      </div>
      <section className="wp-section" aria-labelledby="explore-more">
        <h2 id="explore-more">{t('moreTitle')}</h2>
        <div className="wp-panel-flat">
          <List>
            <LinkRow
              href="/join"
              leading={<ModuleMark module="org" size="md" />}
              title={t('joinProgramme')}
              description={t('joinProgrammeHint')}
            />
            <LinkRow
              href="/org"
              leading={<ModuleMark module="org" size="md" />}
              title={t('forOrganisations')}
              description={t('forOrganisationsHint')}
            />
          </List>
        </div>
      </section>
    </div>
  );
}
