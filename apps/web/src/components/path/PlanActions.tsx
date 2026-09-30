'use client';

import { Button, ConfirmDialog, toast } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';

export function PlanActions({
  planId,
  status,
}: {
  planId: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
}) {
  const t = useTranslations('path');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = async (next: 'active' | 'paused' | 'archived') => {
    setBusy(true);
    try {
      await api(`/api/path/plans/${planId}`, { method: 'PATCH', json: { status: next } });
      if (next === 'archived') router.push('/path' as Route);
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wp-row">
      {status === 'active' ? (
        <Button variant="secondary" size="sm" onPress={() => set('paused')} isBusy={busy}>
          {t('pause')}
        </Button>
      ) : status === 'paused' || status === 'completed' ? (
        <Button variant="secondary" size="sm" onPress={() => set('active')} isBusy={busy}>
          {t('resume')}
        </Button>
      ) : null}
      <Button variant="quiet" size="sm" icon="delete" onPress={() => setConfirm(true)}>
        {t('archive')}
      </Button>
      <ConfirmDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title={t('archive')}
        confirmLabel={t('archive')}
        cancelLabel={common('cancel')}
        tone="danger"
        onConfirm={() => set('archived')}
      >
        <p>{t('archiveConfirm')}</p>
      </ConfirmDialog>
    </div>
  );
}
