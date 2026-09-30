'use client';

import { Button, ConfirmDialog, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, problemKey } from '@/lib/api';

/** Keep (make visible, close the reports) or remove a post. The writer is told either way. */
export function ModerationActions({ postId }: { postId: string }) {
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const act = async (action: 'restore' | 'remove') => {
    await api(`/api/admin/moderation/${postId}`, { json: { action } });
    toast({ title: action === 'remove' ? t('removed') : t('kept'), tone: 'safe' }, 3000);
    router.refresh();
  };

  return (
    <div className="wp-row">
      <Button
        variant="secondary"
        icon="check"
        isBusy={busy}
        aria-label={t('keepLabel')}
        onPress={async () => {
          setBusy(true);
          try {
            await act('restore');
          } catch (err) {
            toast({ title: errors(problemKey(err)), tone: 'danger' });
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('keep')}
      </Button>
      <Button variant="quiet" icon="delete" onPress={() => setConfirm(true)} isDisabled={busy}>
        {t('remove')}
      </Button>
      <ConfirmDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title={t('removeTitle')}
        confirmLabel={t('remove')}
        cancelLabel={common('cancel')}
        tone="danger"
        onConfirm={async () => {
          try {
            await act('remove');
          } catch (err) {
            toast({ title: errors(problemKey(err)), tone: 'danger' });
            throw err;
          }
        }}
      >
        <p>{t('removeBody')}</p>
      </ConfirmDialog>
    </div>
  );
}
