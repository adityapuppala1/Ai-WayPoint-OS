import { safeNextPath } from '@waypoint/core';
import { EmptyState, LinkButton } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { getTranslations } from 'next-intl/server';

type Props = { searchParams: Promise<{ next?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('errors');
  return { title: t('waitTitle'), robots: { index: false } };
}

/** Shown when a page was asked for too often in a short time (see pageRateLimit). */
export default async function WaitPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const t = await getTranslations('errors');
  // Only ever back to a page on this site.
  const back = safeNextPath(next);
  return (
    <div className="wp-page">
      <EmptyState
        title={t('waitTitle')}
        action={
          <LinkButton href={back as Route} variant="primary" icon="retry">
            {t('tryAgain')}
          </LinkButton>
        }
      >
        {t('tooMany')}
      </EmptyState>
    </div>
  );
}
