import type { CirclePost } from '@waypoint/api/client';
import { Icon } from '@waypoint/ui';
import type { CSSProperties } from 'react';
import styles from './circles.module.css';

export type Author = NonNullable<CirclePost['author']>;

function firstLetter(name: string): string {
  const trimmed = name.trim();
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const first = seg.segment(trimmed)[Symbol.iterator]().next().value?.segment;
    if (first) return first.toLocaleUpperCase();
  } catch {
    // Older engines: fall back to the first code point.
  }
  return (Array.from(trimmed)[0] ?? '?').toLocaleUpperCase();
}

/**
 * A person's mark in a circle: the first letter of the name they chose, on one of six hues picked
 * from their member number, so a conversation is easy to follow. Decorative (the name is in text).
 */
export function Person({ author, size }: { author: Author | null; size?: 'sm' }) {
  const hue = `var(--wp-series-${((author?.number ?? 0) % 6) + 1})`;
  return (
    <span
      className={styles.person}
      data-size={size}
      style={{ '--hue': hue } as CSSProperties}
      aria-hidden="true"
    >
      {author?.name ? firstLetter(author.name) : <Icon name="account" size={size ? 16 : 18} />}
    </span>
  );
}
