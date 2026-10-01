'use client';

import { Button, ConfirmDialog, SelectField, TextField, toast } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import styles from './admin.module.css';

type Dialog = 'hold' | 'sign-out' | 'delete' | null;

/**
 * What an admin can do to an account: hold it back (with a reason, and an end if it should
 * end), let it back in, sign it out everywhere, change its role, or delete it. Each is asked
 * about first, in words that say what will happen; deleting needs the address typed.
 */
export function AccountActions({
  id,
  held,
  isGuest,
  isStaff,
  role,
  confirmWord,
}: {
  id: string;
  held: boolean;
  isGuest: boolean;
  isStaff: boolean;
  role: string | null;
  /** What to type to delete: the address, or "guest". */
  confirmWord: string;
}) {
  const t = useTranslations('admin.people');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [nextRole, setNextRole] = useState(role ?? 'member');
  const [busy, setBusy] = useState(false);

  const act = async (json: Record<string, unknown>, done: string, after?: Route) => {
    setBusy(true);
    try {
      await api(`/api/admin/users/${id}`, { method: 'POST', json });
      toast({ title: done, tone: 'safe' });
      if (after) router.push(after);
      else startTransition(() => router.refresh());
    } catch (err) {
      const message =
        err instanceof ApiProblem && err.status === 409 ? err.message : errorsT(problemKey(err));
      toast({ title: message, tone: 'danger' });
      throw err;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wp-stack">
      <div className="wp-row">
        {held ? (
          <Button
            variant="secondary"
            isBusy={busy}
            onPress={() => void act({ action: 'release' }, t('released')).catch(() => undefined)}
          >
            {t('release')}
          </Button>
        ) : !isStaff ? (
          <Button variant="secondary" onPress={() => setOpen('hold')}>
            {t('hold')}
          </Button>
        ) : null}
        <Button variant="secondary" onPress={() => setOpen('sign-out')}>
          {t('signOut')}
        </Button>
        {!isStaff ? (
          <Button variant="danger" onPress={() => setOpen('delete')}>
            {t('delete')}
          </Button>
        ) : null}
      </div>

      {!isGuest ? (
        <form
          className={styles.roleRow}
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: 'role', role: nextRole }, t('roleChanged')).catch(() => undefined);
          }}
        >
          <SelectField
            label={t('role')}
            description={t('roleHint')}
            options={[
              { id: 'member', label: t('roles.member') },
              { id: 'staff', label: t('roles.staff') },
              { id: 'admin', label: t('roles.admin') },
            ]}
            selectedKey={nextRole}
            onSelectionChange={(k) => setNextRole(String(k))}
          />
          <Button
            type="submit"
            variant="secondary"
            isDisabled={nextRole === (role ?? 'member')}
            isBusy={busy}
          >
            {t('changeRole')}
          </Button>
        </form>
      ) : null}

      <ConfirmDialog
        isOpen={open === 'hold'}
        onOpenChange={(o) => setOpen(o ? 'hold' : null)}
        title={t('holdTitle')}
        confirmLabel={t('hold')}
        cancelLabel={t('cancel')}
        onConfirm={() =>
          act(
            { action: 'hold', reason, until: until ? new Date(until).toISOString() : null },
            t('heldDone'),
          )
        }
      >
        <p>{t('holdBody')}</p>
        <TextField
          label={t('reason')}
          description={t('reasonHint')}
          value={reason}
          onChange={setReason}
          maxLength={300}
          isRequired
        />
        <div className={styles.dateField}>
          <label htmlFor={`${id}-until`}>{t('holdUntil')}</label>
          <input
            id={`${id}-until`}
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={open === 'sign-out'}
        onOpenChange={(o) => setOpen(o ? 'sign-out' : null)}
        title={t('signOutTitle')}
        confirmLabel={t('signOut')}
        cancelLabel={t('cancel')}
        tone="primary"
        onConfirm={() => act({ action: 'sign-out' }, t('signedOut'))}
      >
        <p>{t('signOutBody')}</p>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={open === 'delete'}
        onOpenChange={(o) => setOpen(o ? 'delete' : null)}
        title={t('deleteTitle')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        confirmWord={confirmWord}
        confirmWordLabel={t('typeToDelete', { word: confirmWord })}
        onConfirm={() =>
          act({ action: 'delete', confirm: confirmWord }, t('deleted'), '/admin/users' as Route)
        }
      >
        <p>{t('deleteBody')}</p>
      </ConfirmDialog>
    </div>
  );
}
