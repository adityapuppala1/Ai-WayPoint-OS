'use client';

import {
  Button,
  Notice,
  Panel,
  Segmented,
  SelectField,
  SliderField,
  Switch,
  TextField,
} from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import styles from './path.module.css';

export function NewPlanForm({
  roles,
  initialRole,
  initialHours,
  canPersonalise,
}: {
  roles: Array<{ id: string; title: string; family: string; suggested: boolean }>;
  initialRole: string;
  initialHours: number;
  canPersonalise: boolean;
}) {
  const t = useTranslations('path');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [role, setRole] = useState(initialRole || 'none');
  const [hours, setHours] = useState(Math.max(1, Math.min(20, initialHours)));
  const [horizon, setHorizon] = useState('8');
  const [personalise, setPersonalise] = useState(false);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const plan = await api<{ id: string }>('/api/path/plans', {
        json: {
          roleId: role === 'none' ? undefined : role,
          hoursPerWeek: hours,
          horizonWeeks: Number(horizon),
          personalise: canPersonalise && personalise ? true : undefined,
          goal: goal.trim() || undefined,
        },
      });
      router.push(`/path/plans/${plan.id}` as Route);
      router.refresh();
    } catch {
      setError(errors('generic'));
      setBusy(false);
    }
  };

  const options = [
    { id: 'none', label: t('noRole'), textValue: t('noRole') },
    ...roles.map((r) => ({
      id: r.id,
      label: r.suggested ? `${r.title} (${t('suggestedTag')})` : r.title,
      textValue: r.title,
    })),
  ];

  return (
    <Panel>
      <form className={styles.form} onSubmit={submit}>
        <SelectField
          label={t('chooseRole')}
          options={options}
          selectedKey={role}
          onSelectionChange={(k) => setRole(k ? String(k) : 'none')}
        />
        <SliderField
          label={t('hours')}
          minValue={1}
          maxValue={20}
          step={1}
          value={hours}
          onChange={(v) => setHours(Array.isArray(v) ? (v[0] ?? 1) : v)}
        />
        <div className={styles.fieldGroup}>
          <p className={styles.fieldLabel} id="horizon-label">
            {t('horizon')}
          </p>
          <Segmented
            label={t('horizon')}
            value={horizon}
            onChange={setHorizon}
            options={[
              { id: '4', label: t('weeks4') },
              { id: '8', label: t('weeks8') },
              { id: '12', label: t('weeks12') },
            ]}
          />
        </div>
        {canPersonalise ? (
          <>
            <Switch
              isSelected={personalise}
              onChange={setPersonalise}
              description={t('personaliseHint')}
            >
              {t('personalise')}
            </Switch>
            {personalise ? (
              <TextField
                label={t('goal')}
                description={t('goalHint')}
                optionalLabel={common('optional')}
                multiline
                rows={2}
                value={goal}
                onChange={setGoal}
                maxLength={300}
              />
            ) : null}
          </>
        ) : null}
        {error ? <Notice tone="danger" role="alert" title={error} /> : null}
        <div className="wp-row">
          <Button type="submit" variant="primary" size="lg" icon="path" isBusy={busy}>
            {busy ? t('creating') : t('create')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
