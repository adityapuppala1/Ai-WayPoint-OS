'use client';

import { authClient } from '@waypoint/auth/client';
import { Button, type ButtonVariant, Notice, toast } from '@waypoint/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * Emails a link that confirms the person owns their address (it works for 24 hours). Opening
 * the link only confirms the address: it never signs anyone in.
 */
export function SendConfirmation({
  email,
  next,
  variant = 'primary',
}: {
  email: string;
  /** Where to go on from the confirmation page (a path on this site). */
  next?: string;
  variant?: ButtonVariant;
}) {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');

  const send = async () => {
    setState('busy');
    const res = await authClient
      .sendVerificationEmail({
        email,
        callbackURL: next
          ? `/email-confirmed?next=${encodeURIComponent(next)}`
          : '/email-confirmed',
      })
      .catch(() => ({ error: { status: 0 } }));
    if (res.error) {
      setState('idle');
      toast({
        title: res.error.status === 429 ? errors('tooMany') : errors('generic'),
        tone: 'danger',
      });
      return;
    }
    setState('sent');
  };

  if (state === 'sent')
    return <Notice tone="safe" role="status" title={t('confirmSent', { email })} />;
  return (
    <div>
      <Button variant={variant} icon="email" isBusy={state === 'busy'} onPress={() => void send()}>
        {t('confirmSend')}
      </Button>
    </div>
  );
}
