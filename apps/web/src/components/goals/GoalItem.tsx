'use client';

import type { Goal } from '@waypoint/api/client';
import {
  ConfirmDialog,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  type ModuleKey,
  ModuleMark,
  toast,
} from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import styles from './goals.module.css';

const AREA_MARK: Record<Goal['area'], ModuleKey> = {
  path: 'path',
  money: 'money',
  mind: 'mind',
  health: 'health',
  civic: 'civic',
  circles: 'circles',
  goals: 'goals',
};

/** One goal: what it is, why, when, and a progress marker the person moves themselves. */
export function GoalItem({ goal }: { goal: Goal }) {
  const t = useTranslations('goals');
  const common = useTranslations('common');
  const today = useTranslations('today');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();
  const [progress, setProgress] = useState(goal.progress);
  const [confirm, setConfirm] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setProgress(goal.progress), [goal.progress]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const patch = async (json: Record<string, unknown>) => {
    try {
      await api(`/api/goals/${goal.id}`, { method: 'PATCH', json });
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    }
  };

  /**
   * Done, paused or let go: said in a toast, with Undo to put the goal back as it was. The
   * goal moves between lists at once, so the toast is where it can be taken back.
   */
  const setStatus = async (status: 'done' | 'paused' | 'dropped') => {
    const before = goal.status;
    try {
      await api(`/api/goals/${goal.id}`, { method: 'PATCH', json: { status } });
      toast({
        title: t(`status.${status}`),
        description: goal.title,
        tone: status === 'done' ? 'safe' : 'info',
        action: { label: today('undo'), onAction: () => void patch({ status: before }) },
      });
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    }
  };

  const onProgress = (value: number) => {
    setProgress(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => patch({ progress: value }), 600);
  };

  const remove = async () => {
    try {
      await api(`/api/goals/${goal.id}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    }
  };

  const open = goal.status === 'active';
  return (
    <li className={styles.goal} data-status={goal.status}>
      <ModuleMark module={AREA_MARK[goal.area]} size="sm" />
      <div className={styles.goalBody}>
        <p className={styles.goalTitle} dir="auto">
          {goal.title}
        </p>
        {goal.why ? (
          <p className="wp-secondary" dir="auto">
            {goal.why}
          </p>
        ) : null}
        <p className={styles.meta}>
          <span>{t(`areas.${goal.area}`)}</span>
          {goal.targetDate ? (
            <span>
              {t('by', {
                date: format.dateTime(new Date(`${goal.targetDate}T12:00:00`), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }),
              })}
            </span>
          ) : null}
          {open ? null : <span>{t(`status.${goal.status}`)}</span>}
        </p>
        {open ? (
          <div className={styles.progress}>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={progress}
              aria-label={`${t('progress')}: ${goal.title}`}
              aria-valuetext={t('progressValue', { value: progress / 100 })}
              onChange={(e) => onProgress(Number(e.target.value))}
            />
            <span className={styles.progressValue}>
              {format.number(progress / 100, { style: 'percent' })}
            </span>
          </div>
        ) : null}
      </div>
      <Menu
        label={t('actions', { title: goal.title })}
        trigger={
          <IconButton icon="more" label={t('actions', { title: goal.title })} tooltip={false} />
        }
      >
        {open ? (
          <MenuItem id="done" icon="check" onAction={() => void setStatus('done')}>
            {t('markDone')}
          </MenuItem>
        ) : null}
        {open ? (
          <MenuItem id="pause" icon="time" onAction={() => void setStatus('paused')}>
            {t('pause')}
          </MenuItem>
        ) : (
          <MenuItem id="resume" icon="retry" onAction={() => patch({ status: 'active' })}>
            {t('resume')}
          </MenuItem>
        )}
        {open ? (
          <MenuItem id="drop" icon="close" onAction={() => void setStatus('dropped')}>
            {t('drop')}
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuItem id="delete" icon="delete" tone="danger" onAction={() => setConfirm(true)}>
          {t('delete')}
        </MenuItem>
      </Menu>
      <ConfirmDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title={t('delete')}
        confirmLabel={t('delete')}
        cancelLabel={common('cancel')}
        onConfirm={remove}
        tone="danger"
      >
        {t('deleteConfirm')}
      </ConfirmDialog>
    </li>
  );
}
