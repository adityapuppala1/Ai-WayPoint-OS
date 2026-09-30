'use client';

import { Button, ConfirmDialog, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';

/** Take a signal down for everyone, after saying what that means. */
export function SignalWithdraw({ id, title }: { id: string; title: string }) {
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  const withdraw = async () => {
    try {
      await api(`/api/admin/signals/${id}`, { method: 'DELETE' });
    } catch (err) {
      // Already withdrawn by a colleague: the list only needs to catch up.
      if (!(err instanceof ApiProblem && err.status === 404)) {
        toast({ title: errors(problemKey(err)), tone: 'danger' });
        throw err;
      }
    }
    toast({ title: t('sWithdrawn'), tone: 'safe' }, 3000);
    router.refresh();
  };

  return (
    <div className="wp-row">
      <Button
        variant="secondary"
        icon="delete"
        aria-label={`${t('sWithdraw')}: ${title}`}
        onPress={() => setAsking(true)}
      >
        {t('sWithdraw')}
      </Button>
      <ConfirmDialog
        isOpen={asking}
        onOpenChange={setAsking}
        title={t('sWithdrawTitle')}
        confirmLabel={t('sWithdraw')}
        cancelLabel={common('cancel')}
        tone="danger"
        onConfirm={withdraw}
      >
        <p>{t('sWithdrawBody')}</p>
      </ConfirmDialog>
    </div>
  );
}
