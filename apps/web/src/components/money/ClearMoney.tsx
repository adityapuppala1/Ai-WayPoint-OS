'use client';

import { Button, ConfirmDialog, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';

/** Deletes the saved numbers after a confirmation; everything else stays. */
export function ClearMoney() {
  const t = useTranslations('money');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const clear = async () => {
    try {
      await api('/api/money', { method: 'DELETE' });
      toast({ title: t('cleared'), tone: 'safe' }, 2500);
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    }
  };

  return (
    <>
      <Button variant="quiet" icon="delete" onPress={() => setOpen(true)}>
        {t('clear')}
      </Button>
      <ConfirmDialog
        isOpen={open}
        onOpenChange={setOpen}
        title={t('clear')}
        confirmLabel={t('clear')}
        cancelLabel={common('cancel')}
        onConfirm={clear}
        tone="danger"
      >
        {t('clearConfirm')}
      </ConfirmDialog>
    </>
  );
}
