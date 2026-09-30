'use client';

import { normalizeJoinCode } from '@waypoint/core';
import { Button, TextField } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

/** Type (or paste a link with) a programme's join code. */
export function JoinCodeForm({ initial = '' }: { initial?: string }) {
  const t = useTranslations('join');
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const normal = normalizeJoinCode(code);
    if (!normal) {
      setError(t('invalid'));
      return;
    }
    setBusy(true);
    router.push(`/join/${normal}` as Route);
  };

  return (
    <form className="wp-stack" onSubmit={submit}>
      <TextField
        label={t('codeLabel')}
        description={t('codeHint')}
        value={code}
        onChange={(v) => {
          setCode(v);
          setError(null);
        }}
        errorMessage={error ?? undefined}
        isInvalid={Boolean(error)}
        autoComplete="off"
        spellCheck="false"
        maxLength={200}
        isRequired
      />
      <div>
        <Button type="submit" variant="primary" icon="forward" isBusy={busy}>
          {t('find')}
        </Button>
      </div>
    </form>
  );
}
