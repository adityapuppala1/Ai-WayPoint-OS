'use client';

import type { people } from '@waypoint/api';
import { Button, Icon, SelectField, TextField, toast } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useState, useTransition } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import styles from './admin.module.css';

type View = Awaited<ReturnType<typeof people.staffView>>;

/** The staff, an invitation form, and the invitations sent (with a way to withdraw them). */
export function StaffConsole({ view, at }: { view: View; at: string }) {
  const t = useTranslations('admin.people');
  const errorsT = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const now = new Date(at);
  const when = (iso: string | null) => (iso ? format.relativeTime(new Date(iso), now) : '—');

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('invite');
    setProblem(null);
    try {
      await api('/api/admin/staff/invitations', { method: 'POST', json: { email, role } });
      toast({ title: t('invited', { email }), tone: 'safe' });
      setEmail('');
      startTransition(() => router.refresh());
    } catch (err) {
      if (err instanceof ApiProblem && (err.status === 400 || err.status === 409))
        setProblem(err.status === 409 ? t('alreadyStaff') : t('badAddress'));
      else toast({ title: errorsT(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (id: string) => {
    setBusy(id);
    try {
      await api(`/api/admin/staff/invitations/${id}`, { method: 'DELETE' });
      toast({ title: t('withdrawn'), tone: 'safe' });
      startTransition(() => router.refresh());
    } catch (err) {
      toast({ title: errorsT(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="wp-stack">
      <section className={styles.intCard} aria-labelledby="team-title">
        <h3 id="team-title">{t('teamTitle', { n: view.staff.length })}</h3>
        <ul className={styles.rows}>
          {view.staff.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/users/${m.id}` as Route} className={styles.rowLink}>
                <span className={styles.rowName} dir="auto">
                  {m.name}
                </span>
                <span className="wp-meta">{m.email}</span>
              </Link>
              <span className={styles.tagRow}>
                <span className="wp-tag">{t(`roles.${m.role}`)}</span>
                {m.lastActiveAt ? (
                  <span className="wp-meta">{t('lastActive', { when: when(m.lastActiveAt) })}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.intCard} aria-labelledby="invite-title">
        <h3 id="invite-title">{t('inviteTitle')}</h3>
        <p className="wp-meta">{t('inviteLead')}</p>
        <form className={styles.intForm} onSubmit={invite} noValidate>
          <div className={styles.pair}>
            <TextField
              label={t('inviteEmail')}
              type="email"
              autoComplete="off"
              value={email}
              onChange={(v) => {
                setEmail(v);
                setProblem(null);
              }}
              errorMessage={problem ?? undefined}
              isInvalid={Boolean(problem)}
              isRequired
            />
            <SelectField
              label={t('role')}
              options={[
                { id: 'staff', label: t('roles.staff') },
                { id: 'admin', label: t('roles.admin') },
              ]}
              selectedKey={role}
              onSelectionChange={(k) => setRole(k as 'staff' | 'admin')}
              description={role === 'admin' ? t('adminHint') : t('staffHint')}
            />
          </div>
          <div className="wp-row">
            <Button
              type="submit"
              variant="primary"
              icon="send"
              isBusy={busy === 'invite'}
              isDisabled={!email.includes('@')}
            >
              {t('invite')}
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.intCard} aria-labelledby="invitations-title">
        <h3 id="invitations-title">{t('invitationsTitle')}</h3>
        {view.invitations.length ? (
          <ul className={styles.rows}>
            {view.invitations.map((i) => (
              <li key={i.id}>
                <span className={styles.rowLink}>
                  <span className={styles.rowName}>{i.email}</span>
                  <span className="wp-meta">
                    {t('invitedBy', {
                      role: t(`roles.${i.role}`),
                      who: i.invitedBy ?? '—',
                      when: when(i.createdAt),
                    })}
                  </span>
                </span>
                <span className={styles.tagRow}>
                  <span
                    className={styles.statusPill}
                    data-status={
                      i.status === 'accepted'
                        ? 'ok'
                        : i.status === 'pending'
                          ? 'untested'
                          : undefined
                    }
                  >
                    {i.status === 'accepted' ? <Icon name="check" size={14} /> : null}
                    {t(`invitationStates.${i.status}`)}
                  </span>
                  {i.status === 'pending' ? (
                    <Button
                      size="sm"
                      variant="quiet"
                      isBusy={busy === i.id}
                      onPress={() => void withdraw(i.id)}
                    >
                      {t('withdraw')}
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-meta">{t('noInvitations')}</p>
        )}
      </section>
    </div>
  );
}
