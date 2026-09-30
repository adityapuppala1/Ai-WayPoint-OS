'use client';

import { Button, SelectField, TextField, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiProblem, api } from '@/lib/api';
import styles from './goals.module.css';

const AREAS = ['path', 'money', 'mind', 'health', 'civic', 'circles', 'goals'] as const;
const WHEN = { none: 0, '1w': 7, '1m': 30, '3m': 91, '6m': 182 } as const;
type When = keyof typeof WHEN;

/** A date `days` from today, as YYYY-MM-DD in the person's own time zone. */
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function GoalComposer({ defaultArea = 'goals' }: { defaultArea?: (typeof AREAS)[number] }) {
  const t = useTranslations('goals');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [area, setArea] = useState<string>(defaultArea);
  const [when, setWhen] = useState<When>('1m');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) return;
    setBusy(true);
    try {
      await api('/api/goals', {
        json: {
          title: title.trim(),
          why: why.trim() || undefined,
          area,
          targetDate: when === 'none' ? undefined : inDays(WHEN[when]),
        },
      });
      toast({ title: t('saved'), tone: 'safe' }, 2500);
      setTitle('');
      setWhy('');
      router.refresh();
    } catch (err) {
      toast({
        title: err instanceof ApiProblem && err.status === 409 ? t('limit') : errors('generic'),
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label={t('goalTitle')}
        placeholder={t('goalTitlePlaceholder')}
        value={title}
        onChange={setTitle}
        isRequired
        maxLength={120}
      />
      <TextField
        label={t('why')}
        description={t('whyHint')}
        optionalLabel={common('optional')}
        value={why}
        onChange={setWhy}
        multiline
        rows={2}
        maxLength={500}
      />
      <div className={styles.row}>
        <SelectField
          label={t('area')}
          options={AREAS.map((a) => ({
            id: a,
            label: t(`areas.${a}`),
            textValue: t(`areas.${a}`),
          }))}
          selectedKey={area}
          onSelectionChange={(k) => k && setArea(String(k))}
        />
        <SelectField
          label={t('when')}
          options={(Object.keys(WHEN) as When[]).map((w) => ({
            id: w,
            label: t(w === 'none' ? 'whenNone' : `when${w}`),
            textValue: t(w === 'none' ? 'whenNone' : `when${w}`),
          }))}
          selectedKey={when}
          onSelectionChange={(k) => k && setWhen(String(k) as When)}
        />
      </div>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" icon="add" isBusy={busy}>
          {t('save')}
        </Button>
      </div>
      <p className={styles.hint}>{t('private')}</p>
    </form>
  );
}
