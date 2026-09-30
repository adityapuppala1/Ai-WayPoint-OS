'use client';

import type { OrgView } from '@waypoint/api/client';
import { ORG_KINDS, ORG_SIZE_BANDS, type OrgKind, type OrgSizeBand } from '@waypoint/core';
import {
  Button,
  ConfirmDialog,
  Notice,
  Panel,
  SelectField,
  Stepper,
  TextField,
  toast,
} from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import { SIZE_KEY } from './labels';
import styles from './org.module.css';

type Organisation = OrgView['organisation'];

export function OrgSettings({
  organisation: org,
  isOwner,
  countries,
}: {
  organisation: Organisation;
  isOwner: boolean;
  countries: Array<{ code: string; name: string }>;
}) {
  const t = useTranslations('org');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [kind, setKind] = useState<OrgKind>(org.kind);
  const [country, setCountry] = useState(org.country ?? 'none');
  const [size, setSize] = useState<OrgSizeBand | 'none'>(org.sizeBand ?? 'none');
  // The threshold can go up, never down: the current value is the lowest the stepper offers.
  const floor = Math.max(org.kAnonMin, org.platformK);
  const [threshold, setThreshold] = useState(floor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRaise, setConfirmRaise] = useState(false);
  const raising = Number.isFinite(threshold) && threshold > floor;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/org/${org.id}`, {
        method: 'PATCH',
        json: {
          name: name.trim(),
          kind,
          country: country === 'none' ? null : country,
          sizeBand: size === 'none' ? null : size,
          ...(raising ? { kAnonMin: threshold } : {}),
        },
      });
      toast({ title: t('saved'), tone: 'safe' }, 2000);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiProblem && err.code === 'k-lower'
          ? t('thresholdRaiseOnly')
          : err instanceof ApiProblem && err.status === 422
            ? (err.issues[0]?.message ?? err.message)
            : errors(problemKey(err)),
      );
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    // Raising the threshold cannot be undone, so it is confirmed first.
    if (raising) setConfirmRaise(true);
    else void send().catch(() => undefined);
  };

  return (
    <div className="wp-stack">
      <Panel title={t('settingsTitle')} as="section" id="settings">
        <form className={styles.form} onSubmit={save}>
          <TextField
            label={t('name')}
            value={name}
            onChange={setName}
            isRequired
            minLength={2}
            maxLength={80}
          />
          <div className={styles.pair}>
            <SelectField
              label={t('kind')}
              selectedKey={kind}
              onSelectionChange={(k) => k && setKind(k as OrgKind)}
              options={ORG_KINDS.map((k) => ({
                id: k,
                label: t(`kinds.${k}`),
                textValue: t(`kinds.${k}`),
              }))}
            />
            <SelectField
              label={t('country')}
              optionalLabel={common('optional')}
              selectedKey={country}
              onSelectionChange={(k) => setCountry(k ? String(k) : 'none')}
              options={[
                {
                  id: 'none',
                  label: common('unknownCountry'),
                  textValue: common('unknownCountry'),
                },
                ...countries.map((c) => ({ id: c.code, label: c.name, textValue: c.name })),
              ]}
            />
          </div>
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
          <div className="wp-stack">
            <div>
              <p className="wp-strong">{t('thresholdTitle')}</p>
              <p className={styles.hint}>
                {t('thresholdLead', { min: org.platformK })} {t('thresholdRaiseOnly')}
              </p>
            </div>
            <Stepper
              label={t('threshold')}
              value={threshold}
              onChange={setThreshold}
              minValue={floor}
              maxValue={1000}
              step={5}
              unit={t('thresholdUnit')}
              unitLabel={t('thresholdUnit')}
            />
          </div>
          {error ? <Notice tone="danger" role="alert" title={error} /> : null}
          <div>
            <Button
              type="submit"
              variant="primary"
              isBusy={busy}
              isDisabled={name.trim().length < 2}
            >
              {t('saveChanges')}
            </Button>
          </div>
        </form>
      </Panel>

      {isOwner ? (
        <Panel
          title={t('deleteTitle')}
          description={t('deleteBody')}
          as="section"
          className={styles.danger}
        >
          <div>
            <Button variant="danger" icon="delete" onPress={() => setConfirmDelete(true)}>
              {t('deleteButton')}
            </Button>
          </div>
        </Panel>
      ) : null}

      <ConfirmDialog
        isOpen={confirmRaise}
        onOpenChange={setConfirmRaise}
        title={t('thresholdRaiseTitle', { k: threshold })}
        confirmLabel={t('thresholdRaiseConfirm')}
        cancelLabel={common('cancel')}
        tone="primary"
        onConfirm={async () => {
          // Close either way: a problem shows in the form, next to the threshold.
          await send().catch(() => undefined);
        }}
      >
        <p>{t('thresholdRaiseBody', { from: floor, k: threshold })}</p>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('deleteTitle')}
        confirmLabel={t('deleteButton')}
        cancelLabel={common('cancel')}
        tone="danger"
        confirmWord={org.name}
        confirmWordLabel={t('deleteConfirmWord')}
        onConfirm={async () => {
          try {
            await api(`/api/org/${org.id}`, { method: 'DELETE' });
          } catch (err) {
            toast({ title: errors(problemKey(err)), tone: 'danger' });
            throw err;
          }
          toast({ title: t('deleted'), tone: 'safe' });
          router.push('/org' as Route);
          router.refresh();
        }}
      >
        <p>{t('deleteBody')}</p>
      </ConfirmDialog>
    </div>
  );
}
