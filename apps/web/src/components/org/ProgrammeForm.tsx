'use client';

import { Button, Checkbox, Dialog, Icon, Notice, TextField, toast } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useId, useMemo, useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import styles from './org.module.css';

export interface RoleOption {
  id: string;
  title: string;
  family: string;
}

export interface ProgrammeValues {
  name: string;
  description: string;
  targetRoleIds: string[];
  startsOn: string;
  endsOn: string;
}

const MAX_ROLES = 5;

function RolesPicker({
  roles,
  chosen,
  onChange,
}: {
  roles: RoleOption[];
  chosen: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations('org');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    const match = roles.filter(
      (r) =>
        !q ||
        r.title.toLocaleLowerCase(locale).includes(q) ||
        r.family.toLocaleLowerCase(locale).includes(q),
    );
    const map = new Map<string, RoleOption[]>();
    for (const r of match) map.set(r.family, [...(map.get(r.family) ?? []), r]);
    return [...map].sort((a, b) => a[0].localeCompare(b[0], locale));
  }, [roles, query, locale]);
  const full = chosen.length >= MAX_ROLES;
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...chosen, id].slice(0, MAX_ROLES) : chosen.filter((c) => c !== id));

  return (
    <fieldset className={styles.roles}>
      <legend>{t('targetRoles')}</legend>
      <p className={styles.hint}>
        {t('targetRolesHint')} {t('rolesChosen', { count: chosen.length })}
      </p>
      {chosen.length ? (
        <ul className={styles.chips}>
          {chosen.map((id) => {
            const title = byId.get(id)?.title ?? id;
            return (
              <li key={id} className={styles.chip}>
                {title}
                <button
                  type="button"
                  aria-label={t('removeRole', { role: title })}
                  onClick={() => toggle(id, false)}
                >
                  <Icon name="close" size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <TextField
        label={t('rolesSearch')}
        type="search"
        value={query}
        onChange={setQuery}
        autoComplete="off"
      />
      <div className={styles.roleList}>
        {groups.length ? (
          groups.map(([family, list]) => (
            <div key={family} className={styles.roleFamily}>
              <p>{family}</p>
              {list.map((r) => {
                const on = chosen.includes(r.id);
                return (
                  <Checkbox
                    key={r.id}
                    isSelected={on}
                    isDisabled={!on && full}
                    onChange={(v) => toggle(r.id, v)}
                  >
                    {r.title}
                  </Checkbox>
                );
              })}
            </div>
          ))
        ) : (
          <p className={styles.hint}>{t('rolesNone', { query })}</p>
        )}
      </div>
    </fieldset>
  );
}

function ProgrammeFields({
  roles,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  roles: RoleOption[];
  initial: ProgrammeValues;
  submitLabel: string;
  onSubmit: (values: ProgrammeValues) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations('org');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startId = useId();
  const endId = useId();
  const datesWrong = Boolean(values.startsOn && values.endsOn && values.endsOn < values.startsOn);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (datesWrong) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        description: values.description.trim(),
      });
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof ApiProblem && err.status === 422
          ? (err.issues[0]?.message ?? err.message)
          : err instanceof ApiProblem && err.code === 'limit'
            ? err.message
            : errors(problemKey(err)),
      );
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label={t('programmeName')}
        description={t('programmeNameHint')}
        value={values.name}
        onChange={(name) => setValues((v) => ({ ...v, name }))}
        isRequired
        minLength={2}
        maxLength={80}
      />
      <TextField
        label={t('programmeDescription')}
        description={t('programmeDescriptionHint')}
        optionalLabel={common('optional')}
        multiline
        rows={3}
        value={values.description}
        onChange={(description) => setValues((v) => ({ ...v, description }))}
        maxLength={600}
      />
      <RolesPicker
        roles={roles}
        chosen={values.targetRoleIds}
        onChange={(targetRoleIds) => setValues((v) => ({ ...v, targetRoleIds }))}
      />
      <div className={styles.pair}>
        <div className={styles.dateField}>
          <label htmlFor={startId}>
            {t('startsOn')} <span className="wp-meta">({common('optional')})</span>
          </label>
          <input
            id={startId}
            type="date"
            value={values.startsOn}
            onChange={(e) => setValues((v) => ({ ...v, startsOn: e.target.value }))}
          />
        </div>
        <div className={styles.dateField}>
          <label htmlFor={endId}>
            {t('endsOn')} <span className="wp-meta">({common('optional')})</span>
          </label>
          <input
            id={endId}
            type="date"
            value={values.endsOn}
            min={values.startsOn || undefined}
            aria-invalid={datesWrong || undefined}
            aria-describedby={datesWrong ? `${endId}-error` : undefined}
            onChange={(e) => setValues((v) => ({ ...v, endsOn: e.target.value }))}
          />
          {datesWrong ? (
            <p id={`${endId}-error`} className={styles.error}>
              {t('datesError')}
            </p>
          ) : null}
        </div>
      </div>
      {error ? <Notice tone="danger" role="alert" title={error} /> : null}
      <div className="wp-row">
        <Button
          type="submit"
          variant="primary"
          isBusy={busy}
          isDisabled={values.name.trim().length < 2 || datesWrong}
        >
          {submitLabel}
        </Button>
        <Button variant="quiet" onPress={onCancel} isDisabled={busy}>
          {common('cancel')}
        </Button>
      </div>
    </form>
  );
}

const empty: ProgrammeValues = {
  name: '',
  description: '',
  targetRoleIds: [],
  startsOn: '',
  endsOn: '',
};

const body = (v: ProgrammeValues) => ({
  name: v.name,
  description: v.description || null,
  targetRoleIds: v.targetRoleIds,
  startsOn: v.startsOn || null,
  endsOn: v.endsOn || null,
});

/** "Start a programme": opens the form, creates it, then shows the new programme. */
export function NewProgrammeButton({ orgId, roles }: { orgId: string; roles: RoleOption[] }) {
  const t = useTranslations('org');
  const common = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" icon="add" onPress={() => setOpen(true)}>
        {t('newProgramme')}
      </Button>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        title={t('newProgramme')}
        closeLabel={common('close')}
        variant="sheet"
      >
        <ProgrammeFields
          roles={roles}
          initial={empty}
          submitLabel={t('createProgramme')}
          onCancel={() => setOpen(false)}
          onSubmit={async (v) => {
            const { id } = await api<{ id: string }>(`/api/org/${orgId}/programmes`, {
              json: body(v),
            });
            toast({ title: t('programmeCreated'), tone: 'safe' });
            setOpen(false);
            router.push(`/org/${orgId}/programmes/${id}` as Route);
            router.refresh();
          }}
        />
      </Dialog>
    </>
  );
}

/** "Edit programme": the same form, filled in. */
export function EditProgrammeButton({
  orgId,
  programmeId,
  roles,
  initial,
}: {
  orgId: string;
  programmeId: string;
  roles: RoleOption[];
  initial: ProgrammeValues;
}) {
  const t = useTranslations('org');
  const common = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" icon="edit" onPress={() => setOpen(true)}>
        {t('editProgramme')}
      </Button>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        title={t('editProgramme')}
        closeLabel={common('close')}
        variant="sheet"
      >
        <ProgrammeFields
          roles={roles}
          initial={initial}
          submitLabel={t('saveProgramme')}
          onCancel={() => setOpen(false)}
          onSubmit={async (v) => {
            await api(`/api/org/${orgId}/programmes/${programmeId}`, {
              method: 'PATCH',
              json: body(v),
            });
            toast({ title: t('saved'), tone: 'safe' }, 2500);
            setOpen(false);
            router.refresh();
          }}
        />
      </Dialog>
    </>
  );
}
