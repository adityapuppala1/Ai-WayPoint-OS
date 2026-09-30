'use client';

import { Button, ConfirmDialog, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';

/**
 * The second check on a verdict, for a member of staff who did not record it. Confirming
 * changes nothing about the verdict; it takes away the "not yet double-checked" mark that
 * everyone sees next to it.
 */
export function ForecastConfirm({ id, question }: { id: string; question: string }) {
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  const confirm = async () => {
    try {
      await api(`/api/admin/forecasts/${id}/confirm`, { json: {} });
    } catch (err) {
      // Refused for a reason staff can read (it was their own verdict, or a colleague was
      // quicker): say it in the server's words rather than "something went wrong".
      toast({
        title:
          err instanceof ApiProblem && [403, 409].includes(err.status)
            ? err.message
            : errors(problemKey(err)),
        tone: 'danger',
      });
      if (err instanceof ApiProblem && err.status === 409) {
        router.refresh();
        return;
      }
      throw err;
    }
    toast({ title: t('cConfirmed'), tone: 'safe' }, 3000);
    router.refresh();
  };

  return (
    <div className="wp-row">
      <Button
        variant="primary"
        icon="check"
        aria-label={`${t('cConfirm')}: ${question}`}
        onPress={() => setAsking(true)}
      >
        {t('cConfirm')}
      </Button>
      <ConfirmDialog
        isOpen={asking}
        onOpenChange={setAsking}
        title={t('cConfirmTitle')}
        confirmLabel={t('cConfirm')}
        cancelLabel={common('cancel')}
        tone="primary"
        onConfirm={confirm}
      >
        <p>{t('cConfirmBody')}</p>
      </ConfirmDialog>
    </div>
  );
}
