'use client';

import { LinkButton, Sign } from '@waypoint/ui';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { startHref } from '@/app/welcome/start-href';

/** The welcome page's sign. `next` is where the person was heading when they were sent here. */
export function WelcomeSign({ next = '/' }: { next?: string }) {
  const t = useTranslations('welcome');
  const today = useTranslations('today');
  return (
    <Sign
      eyebrow={today('eyebrow')}
      title={today('onboardTitle')}
      module="today"
      details={[{ label: today('time'), value: today('minutes', { count: 2 }) }]}
      actions={
        <LinkButton variant="primary" size="lg" icon="forward" href={startHref(next) as Route}>
          {t('getStarted')}
        </LinkButton>
      }
    >
      <p>{t('getStartedHint')}</p>
    </Sign>
  );
}
