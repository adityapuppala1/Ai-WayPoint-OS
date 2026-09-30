'use client';

import type { CrisisResponsePlan } from '@waypoint/core';
import { Button, Icon, ModuleMark, toast } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { CrisisCard } from '@/components/support/CrisisCard';
import { api } from '@/lib/api';
import styles from './MindLine.module.css';

const MOODS = ['1', '2', '3', '4', '5'] as const;

/**
 * Today's Mind line: the way into Mind, and beside it "Check in", which opens the five moods
 * right here. One tap saves; the row then closes and says thank you in a toast. How someone
 * felt is never shown on Today afterwards: Today may be read over a shoulder.
 */
export function MindLine({ title, description }: { title: string; description: string }) {
  const t = useTranslations('mind');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [crisis, setCrisis] = useState<CrisisResponsePlan | null>(null);
  const panelId = useId();

  const save = async (mood: string) => {
    setSaving(mood);
    try {
      const res = await api<{ screening: { plan: CrisisResponsePlan | null } }>(
        '/api/mind/checkins',
        { json: { mood: Number(mood), tags: [] } },
      );
      setOpen(false);
      if (res.screening.plan) setCrisis(res.screening.plan);
      else toast({ title: t('checkedIn'), tone: 'safe' });
      // The sign may have been asking for this check-in.
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <li className={styles.line}>
      <div className={styles.head}>
        <Link href={'/mind' as Route} className={styles.link}>
          <ModuleMark module="mind" size="sm" />
          <span className={styles.text}>
            <span className={styles.title}>{title}</span>
            <span className={styles.description}>{description}</span>
          </span>
        </Link>
        <Button
          variant="quiet"
          className={styles.open}
          aria-expanded={open}
          aria-controls={panelId}
          onPress={() => setOpen(!open)}
        >
          {t('checkin')}
          <Icon name="chevronDown" size={16} className={styles.chevron} />
        </Button>
      </div>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.question}>{t('checkinTitle')}</legend>
          <div className={styles.moods}>
            {MOODS.map((m) => (
              <Button
                key={m}
                variant="secondary"
                isBusy={saving === m}
                isDisabled={saving !== null && saving !== m}
                onPress={() => void save(m)}
              >
                {t(`moods.${m}`)}
              </Button>
            ))}
          </div>
        </fieldset>
      </div>
      {crisis ? (
        <div className={styles.panel}>
          <CrisisCard plan={crisis} onStay={() => setCrisis(null)} />
        </div>
      ) : null}
    </li>
  );
}
