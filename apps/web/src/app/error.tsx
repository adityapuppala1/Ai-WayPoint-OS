'use client';

import { Button, LinkButton } from '@waypoint/ui';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const nav = useTranslations('nav');
  useEffect(() => {
    // The digest lets support match this to server logs without exposing details.
    console.error('Waypoint error', error.digest ?? '');
  }, [error]);
  return (
    <main id="main" className="wp-center" style={{ padding: 'var(--wp-space-6)' }}>
      <div className="wp-stack" style={{ maxInlineSize: '32rem', alignItems: 'center' }}>
        <h1>{t('generic')}</h1>
        {error.digest ? <p className="wp-meta">{error.digest}</p> : null}
        <div className="wp-cluster" style={{ justifyContent: 'center' }}>
          <Button variant="primary" icon="retry" onPress={reset}>
            {t('tryAgain')}
          </Button>
          <LinkButton href={'/support' as Route} variant="support" icon="support">
            {nav('support')}
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
