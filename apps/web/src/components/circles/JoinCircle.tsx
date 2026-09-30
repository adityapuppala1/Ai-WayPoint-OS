'use client';

import { Button, Checkbox, TextField, toast } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import styles from './circles.module.css';

/** Choose the name people see here, agree to the guidelines, and join. */
export function JoinCircle({
  circleId,
  memberLabel,
}: {
  circleId: string;
  /** "Member 1234" in the reader's language: how the person appears without a name. */
  memberLabel: string;
}) {
  const t = useTranslations('circles');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [name, setName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!accepted) return;
    setBusy(true);
    setNameError(null);
    try {
      const res = await api<{ circleId: string }>(`/api/circles/${circleId}/join`, {
        json: { name: name.trim() || undefined, acceptGuidelines: true },
      });
      if (res.circleId !== circleId) {
        toast({ title: t('joinedToast'), description: t('joinedNew'), tone: 'safe' }, 8000);
        router.push(`/circles/${res.circleId}` as Route);
      } else {
        toast({ title: t('joinedToast'), tone: 'safe' }, 3000);
        router.refresh();
        // The join form was at the bottom; take the new member to the top of their circle.
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
      }
    } catch (err) {
      if (err instanceof ApiProblem && err.status === 422 && err.code === 'name-contact') {
        setNameError(t('nameContact'));
      } else if (err instanceof ApiProblem && err.status === 409) {
        toast({ title: t('joinLimit'), tone: 'caution' }, 8000);
      } else {
        toast({ title: errors(problemKey(err)), tone: 'danger' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={join}>
      <TextField
        label={t('nameLabel')}
        description={t('nameHint', { member: memberLabel })}
        optionalLabel={common('optional')}
        value={name}
        onChange={(v) => {
          setName(v);
          setNameError(null);
        }}
        maxLength={40}
        autoComplete="off"
        isInvalid={nameError !== null}
        errorMessage={nameError}
      />
      <Checkbox isSelected={accepted} onChange={setAccepted}>
        {t('accept')}
      </Checkbox>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" icon="add" isBusy={busy} isDisabled={!accepted}>
          {t('join')}
        </Button>
      </div>
    </form>
  );
}
