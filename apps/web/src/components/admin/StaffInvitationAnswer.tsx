'use client';

import { Button, toast } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, problemKey } from '@/lib/api';

/** Accept or decline an invitation to the staff. Accepting opens the console. */
export function StaffInvitationAnswer({ id }: { id: string }) {
  const t = useTranslations('admin.people');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const answer = async (choice: 'accept' | 'decline') => {
    setBusy(choice);
    try {
      await api(`/api/staff-invitations/${id}`, { method: 'POST', json: { answer: choice } });
      toast({ title: choice === 'accept' ? t('accepted') : t('declined'), tone: 'safe' });
      // A whole page: the console's frame is drawn for the new role.
      if (choice === 'accept') window.location.assign('/admin');
      else router.push('/' as Route);
    } catch (err) {
      toast({ title: errorsT(problemKey(err)), tone: 'danger' });
      setBusy(null);
    }
  };

  return (
    <div className="wp-row">
      <Button
        variant="primary"
        isBusy={busy === 'accept'}
        isDisabled={busy !== null}
        onPress={() => void answer('accept')}
      >
        {t('accept')}
      </Button>
      <Button
        variant="secondary"
        isBusy={busy === 'decline'}
        isDisabled={busy !== null}
        onPress={() => void answer('decline')}
      >
        {t('decline')}
      </Button>
    </div>
  );
}
