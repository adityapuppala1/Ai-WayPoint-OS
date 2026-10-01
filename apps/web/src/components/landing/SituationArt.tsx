import { type ModuleKey, moduleColours } from '@waypoint/ui';
import type { CSSProperties, ReactNode } from 'react';
import styles from './landing.module.css';

export type Situation = 'job' | 'scam' | 'money' | 'hardDay' | 'moving' | 'caring';

/** The module each situation leads to; its line colour marks the drawing, as on a transit map. */
export const SITUATION_MODULE: Record<Situation, ModuleKey> = {
  job: 'path',
  scam: 'shield',
  money: 'money',
  hardDay: 'support',
  moving: 'civic',
  caring: 'circles',
};

/*
 * Pictograms, not people: an object from each situation, drawn in the text colour with one
 * mark in the module's line colour on its pale tint (the profile's rule for line colours).
 * 120 × 90, 3-unit strokes with round ends, like the icon set.
 */
const DRAWINGS: Record<Situation, ReactNode> = {
  // A briefcase, and a dashed way out of it to a sign.
  job: (
    <>
      <rect x="18" y="38" width="44" height="32" rx="5" />
      <path d="M32 38v-6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6M18 52h44" />
      <path
        className={styles.artLine}
        d="M62 60c14 0 18-6 22-14s8-14 18-14"
        strokeDasharray="1 7"
      />
      <circle className={styles.artFill} cx="100" cy="21" r="3" />
      <path className={styles.artFill} d="M100 26h10l4 4.5-4 4.5h-10z" />
      <path className={styles.artLine} d="M100 26v18" />
    </>
  ),
  // A phone with a message on it, and a warning sign beside it.
  scam: (
    <>
      <rect x="26" y="12" width="40" height="66" rx="7" />
      <path d="M41 70h10" />
      <rect x="32" y="24" width="28" height="18" rx="4" />
      <path d="M37 31h14M37 36h9" />
      <path className={styles.artFill} d="M84 36 103 70H65z" />
      <path className={styles.artInk} d="M84 47v10M84 63v.5" />
    </>
  ),
  // Coins, and how long they last drawn as a route: solid weeks, dashed ahead.
  money: (
    <>
      <ellipse cx="34" cy="64" rx="16" ry="5" />
      <path d="M18 64v-8c0 3 7 5 16 5s16-2 16-5v8M18 56v-8c0 3 7 5 16 5s16-2 16-5v8" />
      <ellipse cx="34" cy="48" rx="16" ry="5" />
      <path className={styles.artLine} d="M60 40h18" />
      <path className={styles.artLine} d="M78 40h28" strokeDasharray="1 7" />
      <circle className={styles.artFill} cx="62" cy="40" r="4" />
      <circle className={styles.artFill} cx="78" cy="40" r="4" />
      <circle className={styles.artDot} cx="106" cy="40" r="4" />
    </>
  ),
  // A cloud with rain, and the sun coming out from behind it.
  hardDay: (
    <>
      <circle className={styles.artFill} cx="78" cy="30" r="12" />
      <path d="M34 60h44a12 12 0 0 0 0-24 18 18 0 0 0-34 4 10 10 0 0 0-10 20z" />
      <path d="M44 70l-3 8M58 70l-3 8M72 70l-3 8" />
    </>
  ),
  // A suitcase, and a dashed flight to a station on the other side.
  moving: (
    <>
      <rect x="16" y="40" width="34" height="36" rx="5" />
      <path d="M27 40v-6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6M27 48v20M39 48v20" />
      <path className={styles.artLine} d="M56 44C66 20 92 16 102 30" strokeDasharray="1 7" />
      <circle className={styles.artFill} cx="104" cy="36" r="5" />
      <path className={styles.artLine} d="M104 41v12" />
    </>
  ),
  // A home with a heart in it.
  caring: (
    <>
      <path d="M30 44 60 20l30 24M36 40v36h48V40" />
      <path
        className={styles.artFill}
        d="M60 69c-8-6-13-10-13-16a6.5 6.5 0 0 1 13-2 6.5 6.5 0 0 1 13 2c0 6-5 10-13 16z"
      />
    </>
  ),
};

/** A situation's picture, decorative (its heading says what it is). */
export function SituationArt({ situation }: { situation: Situation }) {
  const { line, tint } = moduleColours(SITUATION_MODULE[situation]);
  return (
    <svg
      className={styles.situationArt}
      viewBox="0 0 120 90"
      width="120"
      height="90"
      aria-hidden="true"
      focusable="false"
      style={{ '--line': line, '--tint': tint } as CSSProperties}
    >
      <rect className={styles.artTile} width="120" height="90" rx="12" />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {DRAWINGS[situation]}
      </g>
    </svg>
  );
}
