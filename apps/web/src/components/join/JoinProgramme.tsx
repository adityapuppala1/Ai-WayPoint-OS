'use client';

import { authClient } from '@waypoint/auth/client';
import { Button, Checkbox, Notice } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';

/**
 * Joining: an optional choice to be counted in this programme's anonymous totals — always
 * unticked to begin with, whatever the person chose elsewhere — then one button. Without a
 * session, joining starts a guest session first.
 */
export function JoinProgramme({
  code,
  organisation,
  signedIn,
  guest,
}: {
  code: string;
  organisation: string;
  signedIn: boolean;
  /** Joining without an account: the choice is kept, and counts once they have one. */
  guest: boolean;
}) {
  const t = useTranslations('join');
  const auth = useTranslations('shell');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [countMe, setCountMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = encodeURIComponent(`/join/${code}`);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!signedIn) {
        const res = await authClient.signIn.anonymous();
        if (res.error) throw new Error(res.error.message);
      }
      await api(`/api/join/${code}`, { json: { countMe } });
      router.refresh();
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof ApiProblem && err.code === 'closed'
          ? t('closedNow')
          : errors(err instanceof ApiProblem ? problemKey(err) : 'generic'),
      );
    }
  };

  return (
    <div className="wp-stack">
      <Checkbox
        isSelected={countMe}
        onChange={setCountMe}
        description={t(guest ? 'countMeHintGuest' : 'countMeHint')}
      >
        {t('countMe', { organisation })}
      </Checkbox>
      {error ? <Notice tone="danger" role="alert" title={error} /> : null}
      <div className="wp-row">
        <Button
          variant="primary"
          size="lg"
          icon="forward"
          isBusy={busy}
          onPress={() => void join()}
        >
          {signedIn ? t('join') : t('joinGuest')}
        </Button>
      </div>
      {signedIn ? null : (
        <p className="wp-secondary">
          {t('haveAccount')} <Link href={`/sign-in?next=${next}` as Route}>{auth('signIn')}</Link>
        </p>
      )}
    </div>
  );
}
