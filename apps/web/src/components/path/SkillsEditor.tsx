'use client';

import { Button, IconButton, Panel, SearchField, Segmented, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import styles from '@/components/onboarding/onboarding.module.css';
import { api } from '@/lib/api';
import { matchesQuery } from '@/lib/search';

export function SkillsEditor({
  catalog,
  initial,
}: {
  catalog: Array<{ id: string; name: string; alt?: string; category: string }>;
  initial: Array<{ skillId: string; level: number }>;
}) {
  const t = useTranslations('start');
  const p = useTranslations('path');
  const common = useTranslations('common');
  const levels = useTranslations('skillLevels');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [picked, setPicked] = useState(initial);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const names = useMemo(() => new Map(catalog.map((s) => [s.id, s.name])), [catalog]);
  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const taken = new Set(picked.map((x) => x.skillId));
    return catalog
      .filter((s) => !taken.has(s.id) && matchesQuery(q, s.name, s.alt, s.id))
      .slice(0, 8);
  }, [query, catalog, picked]);
  const levelOptions = [1, 2, 3, 4].map((l) => ({
    id: String(l),
    label: levels(String(l) as '1'),
  }));

  const save = async () => {
    setBusy(true);
    try {
      await api('/api/path/skills', { method: 'PUT', json: { skills: picked, replace: true } });
      toast({ title: p('skillsSaved'), tone: 'safe' });
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <div className={styles.step}>
        <SearchField
          label={t('skillsSearch')}
          placeholder={t('skillsSearchPlaceholder')}
          value={query}
          onChange={setQuery}
        />
        {matches.length ? (
          <ul className={styles.chips}>
            {matches.map((s) => (
              <li key={s.id}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="add"
                  onPress={() => {
                    setPicked((all) => [...all, { skillId: s.id, level: 2 }]);
                    setQuery('');
                  }}
                >
                  {s.name}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="wp-meta" aria-live="polite">
          {t('skillsAdded', { count: picked.length })}
        </p>
        {picked.length ? (
          <ul className={styles.picked}>
            {picked.map((x) => {
              const label = names.get(x.skillId) ?? x.skillId;
              return (
                <li key={x.skillId} className={styles.pickedRow}>
                  <span className={styles.pickedName}>{label}</span>
                  <Segmented
                    label={t('levelFor', { skill: label })}
                    options={levelOptions}
                    value={String(Math.max(1, x.level))}
                    onChange={(v) =>
                      setPicked((all) =>
                        all.map((y) => (y.skillId === x.skillId ? { ...y, level: Number(v) } : y)),
                      )
                    }
                  />
                  <IconButton
                    icon="close"
                    label={`${common('remove')}: ${label}`}
                    onPress={() => setPicked((all) => all.filter((y) => y.skillId !== x.skillId))}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="wp-row">
          <Button variant="primary" icon="check" onPress={save} isBusy={busy}>
            {common('save')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
