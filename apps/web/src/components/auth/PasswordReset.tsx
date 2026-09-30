'use client';

/**
 * Forgotten passwords: ask for a link by email, then choose a new password with it. The first
 * step answers the same whether or not an account uses the address, so it never tells anyone
 * who has a Waypoint account. Changing the password signs the account out everywhere.
 */
import { authClient } from '@waypoint/auth/client';
import { Button, LinkButton, Notice, Panel, TextField } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import styles from './auth.module.css';

type Failure = { status?: number; code?: string } | null | undefined;

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const address = email.trim();
    const res = await authClient
      .requestPasswordReset({ email: address, redirectTo: '/reset-password' })
      .catch(() => ({ error: { status: 0 } as Failure }));
    setBusy(false);
    if (res.error) {
      setError(res.error.status === 429 ? errors('tooMany') : errors('generic'));
      return;
    }
    setSent(address);
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1>{t('forgotTitle')}</h1>
        <p className="wp-lead">{t('forgotLead')}</p>
      </header>
      <Panel>
        {sent ? (
          <Notice tone="safe" role="status" title={t('forgotSent', { email: sent })} />
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <TextField
              label={t('email')}
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              isRequired
            />
            {error ? <Notice tone="danger" role="alert" title={error} /> : null}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isBusy={busy}
              isDisabled={!email.trim()}
            >
              {t('forgotSubmit')}
            </Button>
          </form>
        )}
      </Panel>
      <p className={styles.alt}>
        <Link href={'/sign-in' as Route}>{t('backToSignIn')}</Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'invalid'>(token ? 'form' : 'invalid');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    const res = await authClient
      .resetPassword({ newPassword: password, token })
      .catch(() => ({ error: { status: 0 } as Failure }));
    setBusy(false);
    if (!res.error) {
      setState('done');
      return;
    }
    if (res.error.code === 'INVALID_TOKEN') setState('invalid');
    else setError(res.error.status === 429 ? errors('tooMany') : errors('generic'));
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1>{t('resetTitle')}</h1>
      </header>
      <Panel>
        {state === 'done' ? (
          <div className={styles.form}>
            <Notice tone="safe" role="status" title={t('resetDone')} />
            <LinkButton href={'/sign-in' as Route} variant="primary" icon="account">
              {t('submitSignIn')}
            </LinkButton>
          </div>
        ) : state === 'invalid' ? (
          <div className={styles.form}>
            <Notice tone="caution" role="alert" title={t('resetInvalid')} />
            <LinkButton href={'/forgot-password' as Route} variant="primary" icon="email">
              {t('resetAgain')}
            </LinkButton>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <TextField
              label={t('newPassword')}
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              description={t('passwordHint')}
              minLength={10}
              isRequired
            />
            {error ? <Notice tone="danger" role="alert" title={error} /> : null}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isBusy={busy}
              isDisabled={password.length < 10}
            >
              {t('resetSubmit')}
            </Button>
          </form>
        )}
      </Panel>
    </div>
  );
}
