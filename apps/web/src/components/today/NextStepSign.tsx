'use client';

import type { NextStep } from '@waypoint/api/client';
import { addNotNow, NOT_NOW_COOKIE } from '@waypoint/core/next-step';
import { Button, LinkButton, type ModuleKey, Sign, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { api } from '@/lib/api';

/** How a step is ticked off where it lives. */
type Done = NonNullable<NextStep['done']>;

/** The value of one cookie as the browser holds it, or undefined. */
function readCookie(name: string): string | undefined {
  const found = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
}

/**
 * Today's Next Step sign. The step comes from any module (a checklist, a reminder, money,
 * the plan, the weekly review). "Done" and "Not now" are the same size and say nothing
 * about each other: setting a step aside shows the next one for the rest of the day, and
 * either way the sign flips to the new step.
 */
export function NextStepSign({
  step,
  day,
  context,
}: {
  step: NextStep;
  /** The person's local date: "not now" is remembered for this day only. */
  day: string;
  context?: string;
}) {
  const t = useTranslations('today');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  /** Ticks the step off where it lives (the plan, the checklist, the note), or takes that back. */
  const record = (done: Done, undo: boolean) => {
    if (done.type === 'plan-step')
      return api(`/api/path/plans/${done.planId}/steps/${done.stepId}`, {
        method: 'PATCH',
        json: { status: undo ? 'todo' : 'done' },
      });
    if (done.type === 'checklist-item')
      return api(`/api/civic/${done.event}/items/${done.itemId}`, {
        method: 'PUT',
        json: { status: undo ? 'todo' : 'done' },
      });
    return api(`/api/nudges/${done.noteId}`, { json: { action: undo ? 'restore' : 'acted' } });
  };

  // Undo puts the same step back on the sign: it is open again where it lives.
  const undoDone = async (done: Done) => {
    try {
      await record(done, true);
      startTransition(() => router.refresh());
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    }
  };

  const markDone = async () => {
    const done = step.done;
    if (!done) return;
    setBusy(true);
    try {
      await record(done, false);
      toast({
        title: t('doneToast'),
        tone: 'safe',
        action: { label: t('undo'), onAction: () => void undoDone(done) },
      });
      startTransition(() => router.refresh());
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  // Kept in this browser only, as the day and a key that says nothing about the step. A day
  // and a half is long enough for any time zone; the server reads it for `day` alone.
  const notNow = () => {
    const value = addNotNow(readCookie(NOT_NOW_COOKIE), day, step.key);
    // biome-ignore lint/suspicious/noDocumentCookie: a small preference cookie the server page reads (like wp-theme)
    document.cookie = `${NOT_NOW_COOKIE}=${value}; path=/; max-age=129600; samesite=lax`;
    startTransition(() => router.refresh());
  };

  const details = [
    ...(step.minutes ? [{ label: t('time'), value: t('minutes', { count: step.minutes }) }] : []),
    ...(step.from
      ? [
          {
            label: t('from'),
            value: <span lang={step.titleLang ?? undefined}>{step.from}</span>,
          },
        ]
      : []),
    ...(step.why ? [{ label: t('whySeeing'), value: step.why }] : []),
  ];

  return (
    <Sign
      eyebrow={t('eyebrow')}
      title={<span lang={step.titleLang ?? undefined}>{step.title}</span>}
      flipKey={step.key}
      module={step.module as ModuleKey}
      context={context}
      details={details}
      headingLevel={2}
      actions={
        <>
          <LinkButton variant="primary" size="lg" icon="forward" href={step.href}>
            {t('startStep')}
          </LinkButton>
          {step.done ? (
            <Button variant="onSign" size="lg" icon="check" onPress={markDone} isBusy={busy}>
              {t('markDone')}
            </Button>
          ) : null}
          {step.canDefer ? (
            <Button variant="onSign" size="lg" onPress={notNow} isDisabled={busy}>
              {common('notNow')}
            </Button>
          ) : null}
        </>
      }
    >
      {step.detail ? <p lang={step.titleLang ?? undefined}>{step.detail}</p> : null}
    </Sign>
  );
}
