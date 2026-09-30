'use client';

import { LinkButton, Sign } from '@waypoint/ui';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';

export function WelcomeSign() {
  const t = useTranslations('welcome');
  const today = useTranslations('today');
  return (
    <Sign
      eyebrow={today('eyebrow')}
      title={today('onboardTitle')}
      module="today"
      details={[{ label: today('time'), value: today('minutes', { count: 2 }) }]}
      actions={
        <LinkButton variant="primary" size="lg" icon="forward" href={'/start' as Route}>
          {t('getStarted')}
        </LinkButton>
      }
    >
      <p>{t('getStartedHint')}</p>
    </Sign>
  );
}
