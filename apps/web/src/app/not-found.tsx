import { LinkButton } from '@waypoint/ui';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <main id="main" className="wp-center" style={{ padding: 'var(--wp-space-6)' }}>
      <div className="wp-stack" style={{ maxInlineSize: '32rem', alignItems: 'center' }}>
        <h1>{t('notFoundTitle')}</h1>
        <p className="wp-lead">{t('notFoundBody')}</p>
        <LinkButton href={'/' as Route} variant="primary" icon="back">
          {t('backToToday')}
        </LinkButton>
      </div>
    </main>
  );
}
