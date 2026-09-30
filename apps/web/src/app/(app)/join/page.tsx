import { ModuleMark, Panel } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JoinCodeForm } from '@/components/join/JoinCodeForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('join');
  return { title: t('title'), description: t('lead') };
}

export default async function JoinPage() {
  const t = await getTranslations('join');
  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <div className="wp-row">
          <ModuleMark module="org" size="lg" />
          <h1>{t('title')}</h1>
        </div>
        <p className="wp-lead">{t('lead')}</p>
      </header>
      <Panel as="section">
        <JoinCodeForm />
      </Panel>
    </div>
  );
}
