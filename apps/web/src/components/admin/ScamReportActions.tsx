'use client';

import { Button, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, problemKey } from '@/lib/api';

type Status = 'new' | 'reviewed' | 'published' | 'rejected';

/** Publish (warns people in that country in Shield), reject, or mark a report reviewed. */
export function ScamReportActions({ id, status }: { id: string; status: Status }) {
  const t = useTranslations('admin');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [busy, setBusy] = useState<Status | null>(null);

  const review = async (next: Exclude<Status, 'new'>) => {
    setBusy(next);
    try {
      await api(`/api/admin/scam-reports/${id}`, { json: { status: next } });
      toast(
        {
          title:
            next === 'published'
              ? t('publishedToast')
              : next === 'rejected'
                ? t('rejectedToast')
                : t('reviewedToast'),
          tone: 'safe',
        },
        3000,
      );
      router.refresh();
    } catch (err) {
      toast({ title: errors(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="wp-row">
      {status !== 'published' ? (
        <Button
          variant="primary"
          icon="flag"
          isBusy={busy === 'published'}
          isDisabled={busy !== null}
          onPress={() => void review('published')}
        >
          {t('publish')}
        </Button>
      ) : null}
      {status !== 'rejected' ? (
        <Button
          variant="secondary"
          icon="close"
          isBusy={busy === 'rejected'}
          isDisabled={busy !== null}
          onPress={() => void review('rejected')}
        >
          {t('reject')}
        </Button>
      ) : null}
      {status === 'new' ? (
        <Button
          variant="quiet"
          icon="check"
          isBusy={busy === 'reviewed'}
          isDisabled={busy !== null}
          onPress={() => void review('reviewed')}
        >
          {t('markReviewed')}
        </Button>
      ) : null}
    </div>
  );
}
