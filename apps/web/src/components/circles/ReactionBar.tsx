'use client';

import type { CirclePost } from '@waypoint/api/client';
import { Icon, type IconName, toast } from '@waypoint/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ToggleButton } from 'react-aria-components';
import { api, problemKey } from '@/lib/api';
import styles from './circles.module.css';

const REACTIONS = ['support', 'helpful', 'celebrate'] as const;
type Reaction = (typeof REACTIONS)[number];

const ICON: Record<Reaction, IconName> = {
  support: 'heart',
  helpful: 'idea',
  celebrate: 'celebrate',
};

type Counts = Record<Reaction, number>;

/** Support, helpful and celebrate: a quiet way to say "I read this" without writing a reply. */
export function ReactionBar({
  postId,
  reactions,
}: {
  postId: string;
  reactions: CirclePost['reactions'];
}) {
  const t = useTranslations('circles');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const [counts, setCounts] = useState<Counts>({
    support: reactions.support,
    helpful: reactions.helpful,
    celebrate: reactions.celebrate,
  });
  const [mine, setMine] = useState<Set<Reaction>>(() => new Set(reactions.mine));
  const [pending, setPending] = useState<Set<Reaction>>(() => new Set());

  // Take fresh numbers from the server after a refresh.
  const serverMine = reactions.mine.join(',');
  useEffect(() => {
    setCounts({
      support: reactions.support,
      helpful: reactions.helpful,
      celebrate: reactions.celebrate,
    });
    setMine(new Set(serverMine ? (serverMine.split(',') as Reaction[]) : []));
  }, [reactions.support, reactions.helpful, reactions.celebrate, serverMine]);

  const apply = (kind: Reaction, on: boolean) => {
    setMine((prev) => {
      const next = new Set(prev);
      if (on) next.add(kind);
      else next.delete(kind);
      return next;
    });
    setCounts((prev) => ({ ...prev, [kind]: Math.max(0, prev[kind] + (on ? 1 : -1)) }));
  };

  const toggle = async (kind: Reaction) => {
    if (pending.has(kind)) return;
    const on = !mine.has(kind);
    apply(kind, on);
    setPending((p) => new Set(p).add(kind));
    try {
      const res = await api<{ on: boolean }>(`/api/circles/posts/${postId}/reactions`, {
        json: { kind },
      });
      if (res.on !== on) apply(kind, res.on);
    } catch (err) {
      apply(kind, !on);
      toast({ title: errors(problemKey(err)), tone: 'danger' });
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(kind);
        return next;
      });
    }
  };

  return (
    <fieldset className={styles.reactions}>
      <legend className="wp-visually-hidden">{t('reactionsLabel')}</legend>
      {REACTIONS.map((kind) => {
        const label = t(`reactions.${kind}`);
        const selected = mine.has(kind);
        return (
          <ToggleButton
            key={kind}
            className={styles.reaction}
            isSelected={selected}
            onChange={() => toggle(kind)}
            aria-label={
              counts[kind] ? t('reactionCount', { reaction: label, count: counts[kind] }) : label
            }
          >
            <Icon name={ICON[kind]} size={16} weight={selected ? 'fill' : 'regular'} />
            <span>{label}</span>
            {counts[kind] ? (
              <span className={styles.reactionCount}>{format.number(counts[kind])}</span>
            ) : null}
          </ToggleButton>
        );
      })}
    </fieldset>
  );
}
