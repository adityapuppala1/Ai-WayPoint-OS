'use client';

import { Button, LinkButton, Notice, toast } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, problemKey } from '@/lib/api';

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
  const errors = useTranslations('errors');
  const router = useRouter();
  const [gone, setGone] = useState(false);
  if (gone) return null;

  // Opening the note leaves the page, so nobody is told whether this arrived.
  const acted = () =>
    api(`/api/nudges/${nudge.id}`, { json: { action: 'acted' } }).catch(() => undefined);

  // Undo brings the note back as it was. By then this row may have left the page, so the
  // note returns with the refreshed list rather than by state here.
  const restore = async () => {
    try {
      await api(`/api/nudges/${nudge.id}`, { json: { action: 'restore' } });
      setGone(false);
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    }
  };

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
              onPress={() => void acted()}
            >
              {support ? t('nudgeSupport') : t('nudgeOpen')}
            </LinkButton>
          ) : null}
          <Button
            variant="quiet"
            size="sm"
            onPress={async () => {
              setGone(true);
              // Said to be dismissed only once it is: otherwise the note stays, and says why.
              try {
                await api(`/api/nudges/${nudge.id}`, { json: { action: 'dismissed' } });
              } catch (err) {
                setGone(false);
                toast({ title: errors(problemKey(err)), tone: 'danger' });
                return;
              }
              toast({
                title: t('nudgeDismissed'),
                description: nudge.title,
                action: { label: t('undo'), onAction: () => void restore() },
              });
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
