'use client';

import { Button, toast } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';

/** Accept or decline an invitation to an organisation's team. */
export function InvitationAnswer({
  invitationId,
  organisation,
}: {
  invitationId: string;
  organisation: string;
}) {
  const t = useTranslations('org');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const answer = async (choice: 'accept' | 'decline') => {
    setBusy(choice);
    try {
      const { organisationId } = await api<{ organisationId: string }>(
        `/api/invitations/${invitationId}/${choice}`,
        { method: 'POST' },
      );
      if (choice === 'accept') {
        toast({ title: t('joinedTeam', { organisation }), tone: 'safe' });
        router.push(`/org/${organisationId}` as Route);
      } else {
        toast({ title: t('declinedInvite'), tone: 'info' }, 3000);
      }
      router.refresh();
    } catch (err) {
      setBusy(null);
      toast({
        title:
          err instanceof ApiProblem && err.status === 409
            ? t('invitation.answered')
            : err instanceof ApiProblem && err.code === 'verify-email'
              ? t('invitation.verifyTitle')
              : errors(problemKey(err)),
        tone: 'danger',
      });
      router.refresh();
    }
  };

  return (
    <div className="wp-row">
      <Button
        variant="primary"
        icon="check"
        isBusy={busy === 'accept'}
        isDisabled={busy !== null}
        onPress={() => void answer('accept')}
      >
        {t('acceptInvite')}
      </Button>
      <Button
        variant="quiet"
        isBusy={busy === 'decline'}
        isDisabled={busy !== null}
        onPress={() => void answer('decline')}
      >
        {t('declineInvite')}
      </Button>
    </div>
  );
}
