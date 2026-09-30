'use client';

import type { NextStep } from '@waypoint/api/client';
import { Button, LinkButton, type ModuleKey, Sign, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { api } from '@/lib/api';

/** Today's Next Step sign. Marking a plan step done flips the sign to the next step. */
export function NextStepSign({
  step,
  context,
  fromLabel,
}: {
  step: NextStep;
  context?: string;
  fromLabel?: string;
}) {
  const t = useTranslations('today');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const markDone = async () => {
    if (!step.planId || !step.stepId) return;
    setBusy(true);
    try {
      await api(`/api/path/plans/${step.planId}/steps/${step.stepId}`, {
        method: 'PATCH',
        json: { status: 'done' },
      });
      toast({ title: t('doneToast'), tone: 'safe' });
      startTransition(() => router.refresh());
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const details = [
    ...(step.minutes ? [{ label: t('time'), value: t('minutes', { count: step.minutes }) }] : []),
    ...(fromLabel ? [{ label: t('from'), value: fromLabel }] : []),
  ];

  return (
    <Sign
      eyebrow={t('eyebrow')}
      title={step.title}
      flipKey={step.stepId ?? step.kind}
      module={step.module as ModuleKey}
      context={context}
      details={details}
      headingLevel={2}
      actions={
        <>
          <LinkButton variant="primary" size="lg" icon="forward" href={step.href}>
            {t('startStep')}
          </LinkButton>
          {step.kind === 'plan-step' ? (
            <Button variant="onSign" size="lg" icon="check" onPress={markDone} isBusy={busy}>
              {t('markDone')}
            </Button>
          ) : null}
        </>
      }
    >
      {step.detail ? <p>{step.detail}</p> : null}
    </Sign>
  );
}
