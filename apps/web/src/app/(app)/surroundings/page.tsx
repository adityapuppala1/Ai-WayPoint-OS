import { HEALTH_SOURCES } from '@waypoint/content';
import { usesFahrenheit } from '@waypoint/core';
import { Icon, PageHeader } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SurroundingsView } from '@/components/surroundings/SurroundingsView';
import { guessCountry } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('surroundings');
  return { title: t('title'), description: t('lead') };
}

/** Works without an account: the place and forecast live on the device, not on our servers. */
export default async function SurroundingsPage() {
  const [t, country] = await Promise.all([getTranslations('surroundings'), guessCountry()]);
  const sources = [
    HEALTH_SOURCES.heat,
    HEALTH_SOURCES.heatIndex,
    HEALTH_SOURCES.cold,
    HEALTH_SOURCES.air,
    HEALTH_SOURCES.uv,
    HEALTH_SOURCES.weatherData,
  ].map((s) => ({ url: s.url, title: s.title }));

  return (
    <div className="wp-page">
      <div className="wp-section">
        <PageHeader module="surroundings" title={t('title')} lead={t('lead')} />
        <p className="wp-secondary wp-row" style={{ gap: 'var(--wp-space-2)' }}>
          <Icon name="lock" size={16} />
          <span>{t('privacy')}</span>
        </p>
      </div>
      <SurroundingsView imperialDefault={usesFahrenheit(country)} sources={sources} />
    </div>
  );
}
