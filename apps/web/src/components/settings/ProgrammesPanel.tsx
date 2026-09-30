'use client';

import type { MyProgrammes } from '@waypoint/api/client';
import { Button, ConfirmDialog, LinkButton, Notice, Panel, Switch, toast } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api, problemKey } from '@/lib/api';
import styles from './settings.module.css';

type Programme = MyProgrammes['programmes'][number];

/**
 * Programmes the person joined: for each one, whether it may count them (their choice, per
 * programme) and a one-tap way out.
 */
export function ProgrammesPanel({
  programmes: initial,
  countingAllowed,
}: {
  programmes: Programme[];
  /** The account-wide switch: when off, no programme counts the person. */
  countingAllowed: boolean;
}) {
  const t = useTranslations('settings');
  const consents = useTranslations('consents');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();
  const [programmes, setProgrammes] = useState(initial);
  const [leaving, setLeaving] = useState<Programme | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  // Fresh from the server after every refresh (turning counting off resets every programme).
  useEffect(() => setProgrammes(initial), [initial]);

  const setCounted = async (p: Programme, counted: boolean) => {
    setSaving(p.id);
    setProgrammes((all) => all.map((x) => (x.id === p.id ? { ...x, counted } : x)));
    try {
      await api(`/api/me/programmes/${p.id}`, { method: 'PATCH', json: { counted } });
      toast(
        {
          title: counted
            ? t('programmeCountOn', { programme: p.name })
            : t('programmeCountOff', { programme: p.name }),
          tone: 'safe',
        },
        3000,
      );
      router.refresh();
    } catch (err) {
      setProgrammes((all) => all.map((x) => (x.id === p.id ? { ...x, counted: !counted } : x)));
      toast({ title: errors(problemKey(err)), tone: 'danger' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Panel
      title={t('programmesTitle')}
      description={t('programmesLead')}
      as="section"
      id="programmes"
    >
      <div className={styles.form}>
        {programmes.length && !countingAllowed ? (
          <Notice
            tone="info"
            title={t('programmesCountingOff', { setting: consents('org_aggregates') })}
          />
        ) : null}
        {programmes.length ? (
          <ul className={styles.programmes}>
            {programmes.map((p) => (
              <li key={p.id}>
                <div className={styles.programmeHead}>
                  <div>
                    <p className="wp-strong" dir="auto">
                      {p.name}
                    </p>
                    <p className="wp-secondary">
                      <span dir="auto">{p.organisation}</span> ·{' '}
                      {t('programmeJoined', {
                        date: format.dateTime(new Date(p.joinedAt), {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }),
                      })}
                      {p.archived ? ` · ${t('programmeClosed')}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="quiet"
                    size="sm"
                    onPress={() => setLeaving(p)}
                    aria-label={t('programmeLeaveLabel', { programme: p.name })}
                  >
                    {t('programmeLeave')}
                  </Button>
                </div>
                <Switch
                  isSelected={p.counted && countingAllowed}
                  isDisabled={saving === p.id}
                  onChange={(v) => void setCounted(p, v)}
                  description={t('programmeCountHint')}
                >
                  {t('programmeCountMe')}
                </Switch>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-secondary">{t('programmesEmpty')}</p>
        )}
        <div>
          <LinkButton href={'/join' as Route} variant="secondary" icon="ticket">
            {t('programmesJoin')}
          </LinkButton>
        </div>
      </div>

      <ConfirmDialog
        isOpen={leaving !== null}
        onOpenChange={(o) => {
          if (!o) setLeaving(null);
        }}
        title={t('programmeLeaveTitle', { programme: leaving?.name ?? '' })}
        confirmLabel={t('programmeLeave')}
        cancelLabel={common('cancel')}
        tone="danger"
        onConfirm={async () => {
          if (!leaving) return;
          try {
            await api(`/api/me/programmes/${leaving.id}`, { method: 'DELETE' });
          } catch (err) {
            toast({ title: errors(problemKey(err)), tone: 'danger' });
            throw err;
          }
          setProgrammes((all) => all.filter((x) => x.id !== leaving.id));
          toast({ title: t('programmeLeft', { programme: leaving.name }), tone: 'safe' }, 2500);
          router.refresh();
        }}
      >
        <p>{t('programmeLeaveBody', { organisation: leaving?.organisation ?? '' })}</p>
      </ConfirmDialog>
    </Panel>
  );
}
