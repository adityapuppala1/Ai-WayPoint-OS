'use client';

import type { HealthDay } from '@waypoint/api/client';
import type { CrisisResponsePlan } from '@waypoint/core';
import { Button, Stepper, TextField, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { CrisisCard } from '@/components/support/CrisisCard';
import { api, problemKey } from '@/lib/api';
import styles from './health.module.css';

const num = (v: number | null) => (v === null ? Number.NaN : v);
const val = (v: number) => (Number.isNaN(v) ? null : v);

/** Sleep, movement, water and a private note for one day. Empty means "not logged". */
export function DayCheckin({ day }: { day: HealthDay }) {
  const t = useTranslations('health');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [sleep, setSleep] = useState(num(day.sleep));
  const [activity, setActivity] = useState(num(day.activity));
  const [water, setWater] = useState(num(day.water));
  const [note, setNote] = useState(day.note ?? '');
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState<CrisisResponsePlan | null>(null);

  // Take fresh values after a save (or a new day).
  useEffect(() => {
    setSleep(num(day.sleep));
    setActivity(num(day.activity));
    setWater(num(day.water));
    setNote(day.note ?? '');
  }, [day.sleep, day.activity, day.water, day.note]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ screening: { plan: CrisisResponsePlan | null } }>(
        '/api/wellbeing/day',
        {
          method: 'PUT',
          json: {
            date: day.date,
            sleep: val(sleep),
            activity: val(activity),
            water: val(water),
            note: note.trim() || null,
          },
        },
      );
      if (res.screening.plan) setCrisis(res.screening.plan);
      else toast({ title: t('saved'), tone: 'safe' }, 2500);
      router.refresh();
    } catch (err) {
      toast({ title: errors(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const unit = (key: 'sleepUnit' | 'activityUnit' | 'waterUnit', v: number) =>
    t(key, { value: Number.isNaN(v) ? 2 : v });

  return (
    <>
      {crisis ? <CrisisCard plan={crisis} onStay={() => setCrisis(null)} /> : null}
      <form className={styles.form} onSubmit={save}>
        <div className={styles.steppers}>
          <Stepper
            label={t('sleep')}
            value={sleep}
            onChange={setSleep}
            minValue={0}
            maxValue={16}
            step={0.5}
            startValue={7}
            unit={unit('sleepUnit', sleep)}
            unitLabel={unit('sleepUnit', Number.NaN)}
          />
          <Stepper
            label={t('activity')}
            description={t('activityHint')}
            value={activity}
            onChange={setActivity}
            minValue={0}
            maxValue={600}
            step={5}
            startValue={20}
            unit={unit('activityUnit', activity)}
            unitLabel={unit('activityUnit', Number.NaN)}
          />
          <Stepper
            label={t('water')}
            value={water}
            onChange={setWater}
            minValue={0}
            maxValue={30}
            step={1}
            startValue={1}
            unit={unit('waterUnit', water)}
            unitLabel={unit('waterUnit', Number.NaN)}
          />
        </div>
        <TextField
          label={t('note')}
          description={t('noteHint')}
          optionalLabel={common('optional')}
          value={note}
          onChange={setNote}
          multiline
          rows={3}
          maxLength={2000}
        />
        <div className={styles.actions}>
          <Button type="submit" variant="primary" icon="check" isBusy={busy}>
            {t('save')}
          </Button>
        </div>
      </form>
    </>
  );
}
