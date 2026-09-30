'use client';

import { Button, LinkButton, Notice } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';

export interface NudgeView {
  id: string;
  priority: string;
  title: string;
  body: string | null;
  href: string | null;
}

/** A gentle note for today. Opening or dismissing it marks it read so it doesn't come back. */
export function NudgeNotice({ nudge }: { nudge: NudgeView }) {
  const t = useTranslations('today');
  const router = useRouter();
  const [gone, setGone] = useState(false);
  if (gone) return null;

  const mark = (action: 'acted' | 'dismissed') =>
    api(`/api/nudges/${nudge.id}`, { json: { action } }).catch(() => undefined);

  const support = nudge.href === '/support';
  return (
    <Notice
      tone={support || nudge.priority === 'critical' ? 'support' : 'info'}
      title={nudge.title}
      actions={
        <>
          {nudge.href ? (
            <LinkButton
              href={nudge.href as Route}
              variant={support ? 'support' : 'secondary'}
              size="sm"
              icon={support ? 'support' : 'forward'}
              onPress={() => void mark('acted')}
            >
              {support ? t('nudgeSupport') : t('nudgeOpen')}
            </LinkButton>
          ) : null}
          <Button
            variant="quiet"
            size="sm"
            onPress={async () => {
              setGone(true);
              await mark('dismissed');
              router.refresh();
            }}
          >
            {t('nudgeDismiss')}
          </Button>
        </>
      }
    >
      {nudge.body ? <p>{nudge.body}</p> : null}
    </Notice>
  );
}
