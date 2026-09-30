'use client';

import type { WeeklyReview as Review } from '@waypoint/api/client';
import { Button, Radio, RadioGroup, TextField, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import styles from './goals.module.css';

/** This week's three questions. Saving again updates the same week. */
export function WeeklyReview({ initial }: { initial: Review | null }) {
  const t = useTranslations('goals');
  const mind = useTranslations('mind');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [editing, setEditing] = useState(!initial);
  const [wentWell, setWentWell] = useState(initial?.wentWell ?? '');
  const [gotInTheWay, setGotInTheWay] = useState(initial?.gotInTheWay ?? '');
  const [nextChange, setNextChange] = useState(initial?.nextChange ?? '');
  const [mood, setMood] = useState(initial?.mood ? String(initial.mood) : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/goals/review', {
        method: 'PUT',
        json: {
          wentWell: wentWell.trim() || undefined,
          gotInTheWay: gotInTheWay.trim() || undefined,
          nextChange: nextChange.trim() || undefined,
          mood: mood ? Number(mood) : undefined,
        },
      });
      toast({ title: t('reviewSaved'), tone: 'safe' }, 3000);
      setEditing(false);
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  if (initial && !editing) {
    return (
      <div className={styles.form}>
        <p className="wp-strong">{t('reviewDone')}</p>
        <dl className={styles.answers}>
          {initial.wentWell ? (
            <div>
              <dt>{t('wentWell')}</dt>
              <dd dir="auto">{initial.wentWell}</dd>
            </div>
          ) : null}
          {initial.gotInTheWay ? (
            <div>
              <dt>{t('gotInTheWay')}</dt>
              <dd dir="auto">{initial.gotInTheWay}</dd>
            </div>
          ) : null}
          {initial.nextChange ? (
            <div>
              <dt>{t('nextChange')}</dt>
              <dd dir="auto">{initial.nextChange}</dd>
            </div>
          ) : null}
        </dl>
        <div className={styles.actions}>
          <Button icon="edit" onPress={() => setEditing(true)}>
            {t('reviewEdit')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label={t('wentWell')}
        value={wentWell}
        onChange={setWentWell}
        multiline
        rows={2}
        maxLength={1000}
        optionalLabel={common('optional')}
      />
      <TextField
        label={t('gotInTheWay')}
        value={gotInTheWay}
        onChange={setGotInTheWay}
        multiline
        rows={2}
        maxLength={1000}
        optionalLabel={common('optional')}
      />
      <TextField
        label={t('nextChange')}
        value={nextChange}
        onChange={setNextChange}
        multiline
        rows={2}
        maxLength={1000}
        optionalLabel={common('optional')}
      />
      <RadioGroup
        label={t('reviewMood')}
        value={mood}
        onChange={setMood}
        orientation="horizontal"
        optionalLabel={common('optional')}
      >
        {(['1', '2', '3', '4', '5'] as const).map((m) => (
          <Radio key={m} value={m}>
            {mind(`moods.${m}`)}
          </Radio>
        ))}
      </RadioGroup>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" icon="check" isBusy={busy}>
          {t('reviewSave')}
        </Button>
        {initial ? (
          <Button variant="quiet" onPress={() => setEditing(false)}>
            {common('cancel')}
          </Button>
        ) : null}
      </div>
      <p className={styles.hint}>{t('reviewPrivate')}</p>
    </form>
  );
}
