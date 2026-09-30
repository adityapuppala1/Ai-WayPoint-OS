'use client';

import { ORG_KINDS, ORG_SIZE_BANDS, type OrgKind, type OrgSizeBand } from '@waypoint/core';
import { Button, Notice, Radio, RadioGroup, SelectField, TextField } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import { SIZE_KEY } from './labels';
import styles from './org.module.css';

export function CreateOrgForm({
  countries,
  defaultCountry,
}: {
  countries: Array<{ code: string; name: string }>;
  defaultCountry: string | null;
}) {
  const t = useTranslations('org');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<OrgKind>('employer');
  const [country, setCountry] = useState<string>(defaultCountry ?? 'none');
  const [size, setSize] = useState<OrgSizeBand | 'none'>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>('/api/org', {
        json: {
          name: name.trim(),
          kind,
          country: country === 'none' ? null : country,
          sizeBand: size === 'none' ? null : size,
        },
      });
      router.push(`/org/${id}` as Route);
      router.refresh();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiProblem && err.code === 'limit')
        setError(t('limitReached', { limit: 5 }));
      else if (err instanceof ApiProblem && err.status === 422)
        setError(err.issues[0]?.message ?? errors('generic'));
      else setError(errors(problemKey(err)));
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label={t('name')}
        value={name}
        onChange={setName}
        isRequired
        minLength={2}
        maxLength={80}
        autoComplete="organization"
      />
      <RadioGroup label={t('kind')} value={kind} onChange={(v) => setKind(v as OrgKind)}>
        {ORG_KINDS.map((k) => (
          <Radio key={k} value={k}>
            {t(`kinds.${k}`)}
          </Radio>
        ))}
      </RadioGroup>
      <div className={styles.pair}>
        <SelectField
          label={t('country')}
          optionalLabel={common('optional')}
          selectedKey={country}
          onSelectionChange={(k) => setCountry(k ? String(k) : 'none')}
          options={[
            { id: 'none', label: common('unknownCountry'), textValue: common('unknownCountry') },
            ...countries.map((c) => ({ id: c.code, label: c.name, textValue: c.name })),
          ]}
        />
        <SelectField
          label={t('size')}
          optionalLabel={common('optional')}
          selectedKey={size}
          onSelectionChange={(k) => setSize((k as OrgSizeBand | 'none') ?? 'none')}
          options={[
            { id: 'none', label: common('unknownCountry'), textValue: common('unknownCountry') },
            ...ORG_SIZE_BANDS.map((b) => ({
              id: b,
              label: t(`sizes.${SIZE_KEY[b]}`),
              textValue: t(`sizes.${SIZE_KEY[b]}`),
            })),
          ]}
        />
      </div>
      {error ? <Notice tone="danger" role="alert" title={error} /> : null}
      <div>
        <Button
          type="submit"
          variant="primary"
          icon="org"
          isBusy={busy}
          isDisabled={name.trim().length < 2}
        >
          {t('create')}
        </Button>
      </div>
    </form>
  );
}
