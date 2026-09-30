'use client';

import {
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  toast,
} from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, problemKey } from '@/lib/api';

const REASONS = ['harassment', 'scam', 'spam', 'worried', 'other'] as const;
type Reason = (typeof REASONS)[number];

/** Report a post (anonymously) or delete one you're allowed to remove. */
export function PostMenu({
  postId,
  authorName,
  canReport,
  canDelete,
}: {
  postId: string;
  /** Who wrote it, so each options button has its own name for screen readers. */
  authorName: string;
  canReport: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations('circles');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<Reason | ''>('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!canReport && !canDelete) return null;

  const sendReport = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      const res = await api<{ hidden: boolean }>(`/api/circles/posts/${postId}/report`, {
        json: { reason },
      });
      setReporting(false);
      setReason('');
      toast(
        { title: res.hidden ? t('reportedHiddenToast') : t('reportedToast'), tone: 'safe' },
        5000,
      );
      router.refresh();
    } catch (err) {
      toast({ title: errors(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await api(`/api/circles/posts/${postId}`, { method: 'DELETE' });
    } catch (err) {
      toast({ title: errors(problemKey(err)), tone: 'danger' });
      throw err;
    }
    toast({ title: t('deletedToast'), tone: 'safe' }, 3000);
    router.refresh();
  };

  return (
    <>
      <Menu
        label={t('postOptionsFor', { name: authorName })}
        trigger={
          <IconButton
            icon="more"
            label={t('postOptionsFor', { name: authorName })}
            tooltip={false}
          />
        }
      >
        {canReport ? (
          <MenuItem id="report" icon="flag" onAction={() => setReporting(true)}>
            {t('report')}
          </MenuItem>
        ) : null}
        {canDelete ? (
          <MenuItem id="delete" icon="delete" tone="danger" onAction={() => setDeleting(true)}>
            {t('deletePost')}
          </MenuItem>
        ) : null}
      </Menu>

      <Dialog
        isOpen={reporting}
        onOpenChange={(open) => {
          setReporting(open);
          if (!open) setReason('');
        }}
        title={t('reportTitle')}
        closeLabel={common('close')}
        footer={
          <>
            <Button variant="secondary" onPress={() => setReporting(false)} isDisabled={busy}>
              {common('cancel')}
            </Button>
            <Button variant="primary" onPress={sendReport} isBusy={busy} isDisabled={!reason}>
              {t('sendReport')}
            </Button>
          </>
        }
      >
        <div className="wp-stack">
          <p className="wp-secondary">{t('reportLead')}</p>
          <RadioGroup
            label={t('reportReason')}
            value={reason}
            onChange={(v) => setReason(v as Reason)}
          >
            {REASONS.map((r) => (
              <Radio
                key={r}
                value={r}
                description={
                  r === 'worried' ? t('worriedHint') : r === 'scam' ? t('scamHint') : undefined
                }
              >
                {t(`reasons.${r}`)}
              </Radio>
            ))}
          </RadioGroup>
        </div>
      </Dialog>

      <ConfirmDialog
        isOpen={deleting}
        onOpenChange={setDeleting}
        title={t('deleteTitle')}
        confirmLabel={t('deletePost')}
        cancelLabel={common('cancel')}
        onConfirm={remove}
        tone="danger"
      >
        <p>{t('deleteBody')}</p>
      </ConfirmDialog>
    </>
  );
}
