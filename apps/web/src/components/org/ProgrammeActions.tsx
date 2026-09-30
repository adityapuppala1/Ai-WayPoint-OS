'use client';

import { Button, ConfirmDialog, toast } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, problemKey } from '@/lib/api';

/** Close, reopen or delete a programme (owners and admins). */
export function ProgrammeActions({
  orgId,
  programmeId,
  programme,
  closed,
}: {
  orgId: string;
  programmeId: string;
  programme: string;
  closed: boolean;
}) {
  const t = useTranslations('org');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [confirm, setConfirm] = useState<'close' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const url = `/api/org/${orgId}/programmes/${programmeId}`;

  const fail = (err: unknown) => {
    toast({ title: errors(problemKey(err)), tone: 'danger' });
    throw err;
  };

  return (
    <div className="wp-row">
      {closed ? (
        <Button
          variant="secondary"
          icon="retry"
          isBusy={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await api(url, { method: 'PATCH', json: { archived: false } });
              toast({ title: t('programmeReopened'), tone: 'safe' }, 2500);
              router.refresh();
            } catch (err) {
              toast({ title: errors(problemKey(err)), tone: 'danger' });
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('reopenProgramme')}
        </Button>
      ) : (
        <Button variant="secondary" icon="lock" onPress={() => setConfirm('close')}>
          {t('closeProgramme')}
        </Button>
      )}
      <Button variant="quiet" icon="delete" onPress={() => setConfirm('delete')}>
        {t('deleteProgramme')}
      </Button>

      <ConfirmDialog
        isOpen={confirm === 'close'}
        onOpenChange={(o) => setConfirm(o ? 'close' : null)}
        title={t('closeTitle')}
        confirmLabel={t('closeProgramme')}
        cancelLabel={common('cancel')}
        tone="primary"
        onConfirm={async () => {
          await api(url, { method: 'PATCH', json: { archived: true } }).catch(fail);
          toast({ title: t('programmeClosed'), tone: 'safe' }, 2500);
          router.refresh();
        }}
      >
        <p>{t('closeBody')}</p>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={confirm === 'delete'}
        onOpenChange={(o) => setConfirm(o ? 'delete' : null)}
        title={t('deleteProgrammeTitle', { programme })}
        confirmLabel={t('deleteProgramme')}
        cancelLabel={common('cancel')}
        tone="danger"
        onConfirm={async () => {
          await api(url, { method: 'DELETE' }).catch(fail);
          toast({ title: t('programmeDeleted'), tone: 'safe' }, 2500);
          router.push(`/org/${orgId}` as Route);
          router.refresh();
        }}
      >
        <p>{t('deleteProgrammeBody')}</p>
      </ConfirmDialog>
    </div>
  );
}
