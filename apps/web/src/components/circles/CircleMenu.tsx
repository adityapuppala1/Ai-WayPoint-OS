'use client';

import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  TextField,
  toast,
} from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';

/** Your place in a circle: the name you use here, reminders, and leaving. */
export function CircleMenu({
  circleId,
  name,
  memberLabel,
  muted,
}: {
  circleId: string;
  name: string | null;
  /** "Member 1234" in the reader's language: what others see if the name is empty. */
  memberLabel: string;
  muted: boolean;
}) {
  const t = useTranslations('circles');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deletePosts, setDeletePosts] = useState(false);

  const saveName = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setNameError(null);
    try {
      await api(`/api/circles/${circleId}/name`, {
        method: 'PUT',
        json: { name: draft.trim() || undefined },
      });
      setRenaming(false);
      toast({ title: t('nameSaved'), tone: 'safe' }, 2500);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiProblem && err.status === 422) setNameError(t('nameContact'));
      else toast({ title: errors(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const setMuted = async (next: boolean) => {
    try {
      await api(`/api/circles/${circleId}/mute`, { method: 'PUT', json: { muted: next } });
      toast({ title: next ? t('mutedToast') : t('unmutedToast'), tone: 'safe' }, 2500);
      router.refresh();
    } catch (err) {
      toast({ title: errors(problemKey(err)), tone: 'danger' });
    }
  };

  const leave = async () => {
    try {
      await api(`/api/circles/${circleId}/leave`, { json: { deletePosts } });
    } catch (err) {
      toast({ title: errors(problemKey(err)), tone: 'danger' });
      throw err;
    }
    toast({ title: t('leftToast'), tone: 'safe' }, 3000);
    router.push('/circles' as Route);
    router.refresh();
  };

  return (
    <>
      <Menu
        label={t('circleOptions')}
        trigger={<IconButton icon="more" label={t('circleOptions')} tone="outlined" />}
      >
        <MenuItem
          id="name"
          icon="edit"
          onAction={() => {
            setDraft(name ?? '');
            setNameError(null);
            setRenaming(true);
          }}
        >
          {t('changeName')}
        </MenuItem>
        <MenuItem id="mute" icon={muted ? 'bell' : 'bellOff'} onAction={() => setMuted(!muted)}>
          {muted ? t('unmute') : t('mute')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem id="leave" icon="signOut" tone="danger" onAction={() => setLeaving(true)}>
          {t('leave')}
        </MenuItem>
      </Menu>

      <Dialog
        isOpen={renaming}
        onOpenChange={setRenaming}
        title={t('changeName')}
        closeLabel={common('close')}
        footer={
          <>
            <Button variant="secondary" onPress={() => setRenaming(false)} isDisabled={busy}>
              {common('cancel')}
            </Button>
            <Button variant="primary" onPress={() => saveName()} isBusy={busy}>
              {t('saveName')}
            </Button>
          </>
        }
      >
        <form onSubmit={saveName}>
          <TextField
            label={t('nameLabel')}
            description={t('nameHint', { member: memberLabel })}
            value={draft}
            onChange={(v) => {
              setDraft(v);
              setNameError(null);
            }}
            maxLength={40}
            autoComplete="off"
            isInvalid={nameError !== null}
            errorMessage={nameError}
            autoFocus
          />
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={leaving}
        onOpenChange={(open) => {
          setLeaving(open);
          if (!open) setDeletePosts(false);
        }}
        title={t('leaveTitle')}
        confirmLabel={t('leave')}
        cancelLabel={common('cancel')}
        onConfirm={leave}
        tone="danger"
      >
        <p>{t('leaveBody')}</p>
        <Checkbox
          isSelected={deletePosts}
          onChange={setDeletePosts}
          description={t('leaveDeleteHint')}
        >
          {t('leaveDeletePosts')}
        </Checkbox>
      </ConfirmDialog>
    </>
  );
}
