'use client';

import { Checkbox, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useOptimistic, useTransition } from 'react';
import { api } from '@/lib/api';

export function StepCheck({
  planId,
  stepId,
  done,
  title,
}: {
  planId: string;
  stepId: string;
  done: boolean;
  title: string;
}) {
  const t = useTranslations('path');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(done);

  const change = (next: boolean) => {
    startTransition(async () => {
      setOptimistic(next);
      try {
        await api(`/api/path/plans/${planId}/steps/${stepId}`, {
          method: 'PATCH',
          json: { status: next ? 'done' : 'todo' },
        });
        router.refresh();
      } catch {
        toast({ title: errors('generic'), tone: 'danger' });
      }
    });
  };

  return (
    <Checkbox
      isSelected={optimistic}
      onChange={change}
      isDisabled={pending}
      aria-label={t('markStepDone', { title })}
    >
      <span className="wp-visually-hidden">{t('stepDone')}</span>
    </Checkbox>
  );
}
