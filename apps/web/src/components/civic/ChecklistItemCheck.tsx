'use client';

import { Checkbox, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useOptimistic, useTransition } from 'react';
import { api } from '@/lib/api';

export function ChecklistItemCheck({
  event,
  country,
  itemId,
  title,
  status,
}: {
  event: string;
  country: string | null;
  itemId: string;
  title: string;
  status: string;
}) {
  const t = useTranslations('civic');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(status !== 'todo');
  const change = (next: boolean) =>
    startTransition(async () => {
      setDone(next);
      try {
        await api(`/api/civic/${event}/items/${itemId}`, {
          method: 'PUT',
          json: { status: next ? 'done' : 'todo', country: country ?? undefined },
        });
        router.refresh();
      } catch {
        toast({ title: errors('generic'), tone: 'danger' });
      }
    });
  return (
    <Checkbox
      isSelected={done}
      onChange={change}
      isDisabled={pending}
      aria-label={t('markDone', { title })}
    >
      <span className="wp-visually-hidden">{t('done')}</span>
    </Checkbox>
  );
}
