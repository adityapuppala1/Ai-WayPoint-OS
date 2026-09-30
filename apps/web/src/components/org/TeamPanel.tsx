'use client';

import type { OrgView } from '@waypoint/api/client';
import type { OrgRole } from '@waypoint/core';
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  LinkButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Notice,
  Radio,
  RadioGroup,
  TextField,
  toast,
} from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import styles from './org.module.css';

type Member = OrgView['members'][number];
type Invitation = OrgView['invitations'][number];

function InviteDialog({
  orgId,
  baseUrl,
  canInviteAdmin,
  isOpen,
  onOpenChange,
}: {
  orgId: string;
  baseUrl: string;
  /** Only an owner decides who else may manage the organisation. */
  canInviteAdmin: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('org');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; url: string } | null>(null);

  const close = (open: boolean) => {
    if (!open) {
      setSent(null);
      setError(null);
      setEmail('');
    }
    onOpenChange(open);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id: string; path: string }>(`/api/org/${orgId}/invitations`, {
        json: { email: email.trim(), role },
      });
      setSent({ email: email.trim(), url: `${baseUrl}${res.path}` });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiProblem && err.code === 'already-member'
          ? t('alreadyMember')
          : err instanceof ApiProblem && err.code === 'verify-email'
            ? t('verifyToInvite')
            : err instanceof ApiProblem && err.status === 422
              ? (err.issues[0]?.message ?? err.message)
              : err instanceof ApiProblem && err.code === 'limit'
                ? err.message
                : errors(problemKey(err)),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={close} title={t('invite')} closeLabel={common('close')}>
      {sent ? (
        <div className={styles.form}>
          <Notice tone="safe" role="status" title={t('inviteSent', { email: sent.email })}>
            <p>{t('inviteLead')}</p>
          </Notice>
          <p className={styles.linkValue} dir="ltr">
            {sent.url}
          </p>
          <div className="wp-row">
            <Button
              variant="secondary"
              icon="copy"
              onPress={async () =>
                toast(
                  (await copyText(sent.url))
                    ? { title: t('linkCopied'), tone: 'safe' }
                    : { title: errors('generic'), tone: 'danger' },
                  2500,
                )
              }
            >
              {t('copyLink')}
            </Button>
            <Button variant="primary" onPress={() => close(false)}>
              {common('done')}
            </Button>
          </div>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <p className={styles.hint}>{t('inviteLead')}</p>
          <TextField
            label={t('email')}
            type="email"
            value={email}
            onChange={setEmail}
            isRequired
            autoComplete="off"
            maxLength={254}
          />
          <RadioGroup
            label={t('role')}
            value={role}
            onChange={(v) => setRole(v as 'member' | 'admin')}
          >
            <Radio value="member" description={t('roleHints.member')}>
              {t('roles.member')}
            </Radio>
            {canInviteAdmin ? (
              <Radio value="admin" description={t('roleHints.admin')}>
                {t('roles.admin')}
              </Radio>
            ) : null}
          </RadioGroup>
          {error ? <Notice tone="danger" role="alert" title={error} /> : null}
          <div className="wp-row">
            <Button
              type="submit"
              variant="primary"
              icon="send"
              isBusy={busy}
              isDisabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
            >
              {t('sendInvite')}
            </Button>
            <Button variant="quiet" onPress={() => close(false)}>
              {common('cancel')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function TeamPanel({
  orgId,
  organisation,
  myRole,
  canManage,
  canInvite,
  members,
  invitations,
  baseUrl,
}: {
  orgId: string;
  organisation: string;
  myRole: OrgRole;
  canManage: boolean;
  /** The viewer's own email address is confirmed (invitations go out in their name). */
  canInvite: boolean;
  members: Member[];
  invitations: Invitation[];
  baseUrl: string;
}) {
  const t = useTranslations('org');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  const fail = (err: unknown) => {
    toast({
      title:
        err instanceof ApiProblem && err.code === 'last-owner'
          ? t('lastOwner')
          : errors(problemKey(err)),
      tone: 'danger',
    });
  };

  const setRole = async (m: Member, role: OrgRole) => {
    try {
      await api(`/api/org/${orgId}/members/${m.id}`, { method: 'PATCH', json: { role } });
      toast(
        { title: t('roleChanged', { name: m.name, role: t(`roles.${role}`) }), tone: 'safe' },
        2500,
      );
      router.refresh();
    } catch (err) {
      fail(err);
    }
  };

  const date = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'short' });

  return (
    <div className="wp-stack">
      <ul className={styles.people}>
        {members.map((m) => {
          const canRemove = !m.isMe && canManage && (m.role !== 'owner' || myRole === 'owner');
          const canRole = !m.isMe && myRole === 'owner';
          return (
            <li key={m.id} className={styles.person}>
              <Avatar name={m.name} size={36} />
              <div className={styles.personText}>
                <span className={styles.personName}>
                  {m.name}
                  {m.isMe ? <span className="wp-meta"> · {common('you')}</span> : null}
                </span>
                <span className={styles.personMeta} dir="ltr">
                  {m.email}
                </span>
              </div>
              <div className={styles.personActions}>
                <span className="wp-tag" data-tone={m.role === 'member' ? undefined : 'info'}>
                  {t(`roles.${m.role}`)}
                </span>
                {m.isMe || canRemove || canRole ? (
                  <Menu
                    label={t('memberOptions', { name: m.name })}
                    trigger={
                      <IconButton
                        icon="more"
                        label={t('memberOptions', { name: m.name })}
                        tooltip={false}
                      />
                    }
                  >
                    {canRole
                      ? (['owner', 'admin', 'member'] as const)
                          .filter((r) => r !== m.role)
                          .map((r) => (
                            <MenuItem
                              key={r}
                              id={`role-${r}`}
                              icon="account"
                              onAction={() => void setRole(m, r)}
                            >
                              {r === 'owner'
                                ? t('makeOwner')
                                : r === 'admin'
                                  ? t('makeAdmin')
                                  : t('makeMember')}
                            </MenuItem>
                          ))
                      : null}
                    {canRole && canRemove ? <MenuSeparator /> : null}
                    {canRemove || m.isMe ? (
                      <MenuItem
                        id="remove"
                        icon={m.isMe ? 'signOut' : 'delete'}
                        tone="danger"
                        onAction={() => setRemoving(m)}
                      >
                        {m.isMe ? t('leave') : t('removeMember')}
                      </MenuItem>
                    ) : null}
                  </Menu>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {canManage && invitations.length ? (
        <div>
          <h3 className={styles.subhead}>{t('pendingTitle')}</h3>
          <ul className={styles.people}>
            {invitations.map((i) => (
              <li key={i.id} className={styles.person}>
                <Avatar name={i.email} size={36} />
                <div className={styles.personText}>
                  <span className={styles.personName} dir="ltr">
                    {i.email}
                  </span>
                  <span className={styles.personMeta}>
                    {t(`roles.${i.role}`)} · {t('pendingExpires', { date: date(i.expiresAt) })}
                  </span>
                </div>
                <div className={styles.personActions}>
                  <IconButton
                    icon="copy"
                    label={t('copyLink')}
                    onPress={async () =>
                      toast(
                        (await copyText(`${baseUrl}/org/invite/${i.id}`))
                          ? { title: t('linkCopied'), tone: 'safe' }
                          : { title: errors('generic'), tone: 'danger' },
                        2500,
                      )
                    }
                  />
                  <IconButton
                    icon="close"
                    label={t('cancelInviteLabel', { email: i.email })}
                    onPress={async () => {
                      try {
                        await api(`/api/org/${orgId}/invitations/${i.id}`, { method: 'DELETE' });
                        toast({ title: t('inviteCanceled'), tone: 'info' }, 2500);
                        router.refresh();
                      } catch (err) {
                        fail(err);
                      }
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canManage && canInvite ? (
        <div>
          <Button variant="secondary" icon="add" onPress={() => setInviting(true)}>
            {t('invite')}
          </Button>
        </div>
      ) : canManage ? (
        <Notice
          title={t('verifyToInvite')}
          actions={
            <LinkButton href={'/settings#account' as Route} variant="secondary" icon="account">
              {t('verifyToInviteAction')}
            </LinkButton>
          }
        />
      ) : null}

      <InviteDialog
        orgId={orgId}
        baseUrl={baseUrl}
        canInviteAdmin={myRole === 'owner'}
        isOpen={inviting}
        onOpenChange={setInviting}
      />

      <ConfirmDialog
        isOpen={removing !== null}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
        title={
          removing?.isMe
            ? t('leaveTitle', { organisation })
            : t('removeTitle', { name: removing?.name ?? '' })
        }
        confirmLabel={removing?.isMe ? t('leave') : t('removeMember')}
        cancelLabel={common('cancel')}
        tone="danger"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api(`/api/org/${orgId}/members/${removing.id}`, { method: 'DELETE' });
          } catch (err) {
            fail(err);
            throw err;
          }
          if (removing.isMe) {
            router.push('/org' as Route);
          } else {
            toast({ title: t('removed', { name: removing.name }), tone: 'info' }, 2500);
          }
          router.refresh();
        }}
      >
        <p>{removing?.isMe ? t('leaveBody') : t('removeBody')}</p>
      </ConfirmDialog>
    </div>
  );
}
