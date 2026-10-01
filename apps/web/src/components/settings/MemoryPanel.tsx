'use client';

import type { Memory } from '@waypoint/api/client';
import { Button, ConfirmDialog, IconButton, Panel, toast } from '@waypoint/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ApiProblem, api } from '@/lib/api';
import styles from './memory.module.css';

/** Enough of a memory to tell the delete buttons apart when read aloud. */
const short = (text: string) => (text.length > 60 ? `${text.slice(0, 57)}…` : text);

/**
 * What the assistant was asked to remember: what, when, and a way to delete each one or all
 * of them. Shown whether or not memory is switched on, because switching it off deletes
 * nothing; the panel says so, so nobody believes something is gone while it is still kept.
 */
export function MemoryPanel({
  memories: initial,
  memoryOn,
}: {
  memories: Memory[];
  /** The "Remember things I ask you to" choice, as it is right now. */
  memoryOn: boolean;
}) {
  const t = useTranslations('settings');
  const c = useTranslations('consents');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const [memories, setMemories] = useState(initial);
  const [confirmAll, setConfirmAll] = useState(false);

  const forget = async (id: string) => {
    try {
      await api(`/api/me/memories/${id}`, { method: 'DELETE' });
    } catch (err) {
      // Already gone (deleted on another device): the list should simply stop showing it.
      if (!(err instanceof ApiProblem && err.status === 404)) {
        toast({ title: errors('generic'), tone: 'danger' });
        return;
      }
    }
    setMemories((all) => all.filter((m) => m.id !== id));
    toast({ title: t('memoryDeleted'), tone: 'safe' }, 2000);
  };

  const forgetAll = async () => {
    try {
      await api('/api/me/memories', { method: 'DELETE' });
    } catch (err) {
      toast({ title: errors('generic'), tone: 'danger' });
      throw err;
    }
    setMemories([]);
    toast({ title: t('memoryDeleted'), tone: 'safe' }, 2000);
  };

  return (
    <Panel title={t('memoryTitle')} description={t('memoryLead')} as="section" id="memory">
      <div className={styles.body}>
        {memoryOn ? null : (
          <p className="wp-secondary">{t('memoryOff', { setting: c('memory') })}</p>
        )}
        {memories.length ? (
          <ul className={styles.list}>
            {memories.map((m) => {
              const words = m.content ?? t('memoryUnreadable');
              return (
                <li key={m.id}>
                  <div className={styles.words}>
                    <p dir="auto">{words}</p>
                    <p className="wp-meta">
                      {t('memorySavedOn', {
                        date: format.dateTime(new Date(m.createdAt), {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }),
                      })}
                    </p>
                  </div>
                  <IconButton
                    icon="delete"
                    label={`${common('delete')}: ${short(words)}`}
                    onPress={() => void forget(m.id)}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="wp-secondary">{t('memoryEmpty')}</p>
        )}
        {memories.length ? (
          <div>
            <Button variant="quiet" icon="delete" onPress={() => setConfirmAll(true)}>
              {t('memoryForgetAll')}
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={confirmAll}
        onOpenChange={setConfirmAll}
        title={t('memoryForgetAll')}
        confirmLabel={t('memoryForgetAll')}
        cancelLabel={common('cancel')}
        tone="danger"
        onConfirm={forgetAll}
      >
        <p>{t('memoryForgetAllConfirm')}</p>
      </ConfirmDialog>
    </Panel>
  );
}
