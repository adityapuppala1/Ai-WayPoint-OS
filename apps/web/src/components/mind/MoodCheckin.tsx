'use client';

import type { CrisisResponsePlan } from '@waypoint/core';
import { Button, Segmented, TextField, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Label, Radio, RadioGroup, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { CrisisCard } from '@/components/support/CrisisCard';
import { api } from '@/lib/api';
import styles from './mind.module.css';

const MOODS = ['1', '2', '3', '4', '5'] as const;
const TAGS = [
  'sleep',
  'work',
  'money',
  'family',
  'friends',
  'health',
  'lonely',
  'study',
  'home',
  'news',
] as const;
const ENERGY = { low: 1, some: 3, lots: 5 } as const;

function Level({ n }: { n: number }) {
  return (
    <span className={styles.level} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} data-on={i <= n} style={{ blockSize: `${30 + i * 14}%` }} />
      ))}
    </span>
  );
}

/** Mood, energy, what it's about, and a private note — screened for danger as it's saved. */
export function MoodCheckin() {
  const t = useTranslations('mind');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [mood, setMood] = useState<string>('');
  const [energy, setEnergy] = useState<string>('');
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState<CrisisResponsePlan | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mood) return;
    setBusy(true);
    try {
      const res = await api<{ screening: { plan: CrisisResponsePlan | null } }>(
        '/api/mind/checkins',
        {
          json: {
            mood: Number(mood),
            energy: energy ? ENERGY[energy as keyof typeof ENERGY] : undefined,
            tags: [...tags],
            note: note.trim() || undefined,
          },
        },
      );
      if (res.screening.plan) setCrisis(res.screening.plan);
      else toast({ title: t('checkedIn'), tone: 'safe' }, 3000);
      setMood('');
      setEnergy('');
      setTags(new Set());
      setNote('');
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {crisis ? <CrisisCard plan={crisis} onStay={() => setCrisis(null)} /> : null}
      <form className={styles.form} onSubmit={submit}>
        <RadioGroup value={mood} onChange={setMood} className={styles.fieldset} isRequired>
          <Label className={styles.legend}>{t('mood')}</Label>
          <div className={styles.moods}>
            {MOODS.map((m) => (
              <Radio key={m} value={m} className={styles.mood}>
                <Level n={Number(m)} />
                <span>{t(`moods.${m}`)}</span>
              </Radio>
            ))}
          </div>
        </RadioGroup>

        <div className={styles.fieldset}>
          <p className={styles.legend} id="energy-label">
            {t('energy')} <span className={styles.hint}>({common('optional')})</span>
          </p>
          <Segmented
            label={t('energy')}
            value={energy}
            onChange={setEnergy}
            options={(['low', 'some', 'lots'] as const).map((k) => ({
              id: k,
              label: t(`energyLevels.${k}`),
            }))}
          />
        </div>

        <div className={styles.fieldset}>
          <p className={styles.legend}>
            {t('tagsLabel')} <span className={styles.hint}>({common('optional')})</span>
          </p>
          <ToggleButtonGroup
            aria-label={t('tagsLabel')}
            selectionMode="multiple"
            selectedKeys={tags}
            onSelectionChange={(keys) => setTags(new Set([...keys].map(String)))}
            className={styles.chips}
          >
            {TAGS.map((tag) => (
              <ToggleButton key={tag} id={tag} className={styles.chip}>
                {t(`tags.${tag}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        <TextField
          label={t('note')}
          description={t('noteHint')}
          optionalLabel={common('optional')}
          value={note}
          onChange={setNote}
          multiline
          rows={3}
          maxLength={1000}
        />

        <div className={styles.actions}>
          <Button type="submit" variant="primary" icon="check" isBusy={busy} isDisabled={!mood}>
            {t('checkin')}
          </Button>
        </div>
      </form>
    </>
  );
}
