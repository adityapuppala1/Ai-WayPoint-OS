'use client';

/**
 * Sign in, or create an account. Creating one always ends with "check your email", whether or
 * not the address already has an account (its owner is emailed instead), so the form never
 * tells anyone who uses Waypoint. An account is signed in to once its address is confirmed.
 *
 * On a device with a guest session open, what the guest did moves into the account created
 * from it at its first sign-in here. Signing in to any other account brings it along only if
 * the person asks: on a shared device, the guest may have been someone else.
 */
import { authClient } from '@waypoint/auth/client';
import { KEEP_GUEST_HEADER } from '@waypoint/core/headers';
import { Button, Checkbox, LinkButton, Notice, Panel, TextField } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import styles from './auth.module.css';

type Failure = { status?: number; code?: string } | null | undefined;

/** Who is at the form: nobody signed in, a guest, or a guest whose account awaits sign-in. */
export type AuthVisitor = 'visitor' | 'guest' | 'guest-with-account';

export function AuthForm({
  mode,
  next,
  visitor = 'visitor',
}: {
  mode: 'sign-in' | 'sign-up';
  next: string;
  visitor?: AuthVisitor;
}) {
  const t = useTranslations('auth');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepGuest, setKeepGuest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    text: string;
    help?: string;
    tone: 'danger' | 'caution';
  } | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const signUp = mode === 'sign-up';
  const signInPath = `/sign-in?next=${encodeURIComponent(next)}`;
  const sentHeading = useRef<HTMLHeadingElement>(null);

  // The form is replaced by "check your email": move focus there so it is announced.
  useEffect(() => {
    if (sentTo) sentHeading.current?.focus();
  }, [sentTo]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const address = email.trim();
    if (signUp) {
      const res = await authClient.signUp
        .email({
          email: address,
          password,
          name: name.trim() || address.split('@')[0] || 'Friend',
          // Where the confirmation link leads once it has done its work.
          callbackURL: `/email-confirmed?next=${encodeURIComponent(next)}`,
        })
        .catch(() => ({ error: { status: 0 } as Failure }));
      setBusy(false);
      if (res.error) {
        setError({
          text: res.error.status === 429 ? errors('tooMany') : t('signUpFailed'),
          tone: 'danger',
        });
        return;
      }
      setPassword('');
      setSentTo(address);
      return;
    }
    const res = await authClient.signIn
      .email(
        { email: address, password },
        keepGuest && visitor === 'guest' ? { headers: { [KEEP_GUEST_HEADER]: '1' } } : undefined,
      )
      .catch(() => ({ error: { status: 0 } as Failure }));
    if (res.error) {
      setBusy(false);
      const { status } = res.error;
      // A wrong password, an unknown address and an address not confirmed yet get the same
      // answer from the API (otherwise signing in would show whether an address already had an
      // account), so the message covers all three: the last one also emails a fresh link.
      setError(
        status === 429
          ? { text: errors('tooMany'), tone: 'danger' }
          : status === 401
            ? { text: t('failed'), help: t('failedHelp', { email: address }), tone: 'caution' }
            : { text: errors('generic'), tone: 'danger' },
      );
      return;
    }
    router.push(next as Route);
    router.refresh();
  };

  const guest = async () => {
    setBusy(true);
    router.push('/start' as Route);
  };

  if (sentTo)
    return (
      <div className={styles.wrap}>
        <header className={styles.head}>
          <h1 ref={sentHeading} tabIndex={-1}>
            {t('checkTitle')}
          </h1>
        </header>
        <Panel>
          <div className={styles.form}>
            <Notice
              tone="safe"
              role="status"
              icon="email"
              title={t('checkBody', { email: sentTo })}
            >
              <p>{t('checkExisting')}</p>
            </Notice>
            <p className={styles.small}>{t('checkSpam')}</p>
            {visitor !== 'visitor' ? <p className={styles.small}>{t('checkGuest')}</p> : null}
            <LinkButton href={signInPath as Route} variant="primary" icon="account">
              {t('checkSignIn')}
            </LinkButton>
          </div>
        </Panel>
      </div>
    );

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1>{signUp ? t('signUpTitle') : t('signInTitle')}</h1>
        <p className="wp-lead">{signUp ? t('signUpLead') : t('signInLead')}</p>
      </header>
      <Panel>
        <form className={styles.form} onSubmit={submit}>
          {signUp ? (
            <TextField
              label={t('name')}
              value={name}
              onChange={setName}
              autoComplete="name"
              maxLength={60}
            />
          ) : null}
          <TextField
            label={t('email')}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            isRequired
          />
          <TextField
            label={t('password')}
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={signUp ? 'new-password' : 'current-password'}
            description={signUp ? t('passwordHint') : undefined}
            minLength={signUp ? 10 : undefined}
            isRequired
          />
          {!signUp ? (
            <p className={styles.forgot}>
              <Link href={'/forgot-password' as Route}>{t('forgotLink')}</Link>
            </p>
          ) : null}
          {!signUp && visitor === 'guest-with-account' ? (
            <Notice title={t('guestPending')} />
          ) : null}
          {!signUp && visitor === 'guest' ? (
            <Checkbox
              isSelected={keepGuest}
              onChange={setKeepGuest}
              description={t('guestKeepHint')}
            >
              {t('guestKeep')}
            </Checkbox>
          ) : null}
          {error ? (
            <Notice tone={error.tone} role="alert" title={error.text}>
              {error.help ? <p>{error.help}</p> : null}
            </Notice>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isBusy={busy}
            isDisabled={!email.trim() || (signUp ? password.length < 10 : !password)}
          >
            {signUp ? t('submitSignUp') : t('submitSignIn')}
          </Button>
          {signUp ? (
            <p className={styles.agree}>
              {t.rich('agree', {
                terms: (chunks) => <Link href={'/terms' as Route}>{chunks}</Link>,
                privacy: (chunks) => <Link href={'/privacy' as Route}>{chunks}</Link>,
              })}
            </p>
          ) : null}
        </form>
      </Panel>
      <p className={styles.alt}>
        {signUp ? (
          <>
            {t('haveAccount')} <Link href={signInPath as Route}>{t('submitSignIn')}</Link>
          </>
        ) : (
          <>
            {t('noAccount')}{' '}
            <Link href={`/sign-up?next=${encodeURIComponent(next)}` as Route}>
              {t('submitSignUp')}
            </Link>
          </>
        )}
      </p>
      {!signUp && visitor === 'visitor' ? (
        <Button variant="quiet" onPress={guest} isDisabled={busy}>
          {t('orGuest')}
        </Button>
      ) : null}
    </div>
  );
}
