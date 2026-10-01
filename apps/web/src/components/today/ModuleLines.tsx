'use client';

import { Icon, List, type ModuleKey, ModuleMark } from '@waypoint/ui';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { LinkRow } from '@/components/LinkRow';
import { MindLine } from './MindLine';
import styles from './ModuleLines.module.css';
import { SurroundingsGlance } from './SurroundingsGlance';

export interface ModuleLine {
  module: ModuleKey;
  href: string;
  /** What the person can do there, in a few words. */
  title: string;
  /** Where things stand (plan progress, runway, this week's review), or what the module is. */
  description: string;
  /** Set when the title is guidance that is still in English, so a screen reader switches voice. */
  lang?: string;
}

/** Phones show this many lines; the rest open under "All modules". */
const FIRST = 4;

/**
 * Every module as one list of rows, each with where things stand. The order follows the
 * person's situation. On a phone the first four show and the rest open on request, so Today
 * stays short; wider screens show them all.
 */
export function ModuleLines({
  lines,
  imperialDefault,
}: {
  lines: ModuleLine[];
  /** For the weather line, which is read from this device and never from the server. */
  imperialDefault: boolean;
}) {
  const shell = useTranslations('shell');
  const [open, setOpen] = useState(false);
  const restId = useId();

  const row = (line: ModuleLine) =>
    line.module === 'surroundings' ? (
      <SurroundingsGlance key={line.module} imperialDefault={imperialDefault} />
    ) : line.module === 'mind' ? (
      // Ten seconds, as it says: the check-in opens right here.
      <MindLine key={line.module} title={line.title} description={line.description} />
    ) : (
      <LinkRow
        key={line.module}
        href={line.href}
        leading={<ModuleMark module={line.module} size="sm" />}
        title={<span lang={line.lang}>{line.title}</span>}
        description={line.description}
      />
    );

  const rest = lines.slice(FIRST);
  return (
    <>
      <List>{lines.slice(0, FIRST).map(row)}</List>
      {rest.length ? (
        <>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={restId}
            onClick={() => setOpen(!open)}
          >
            <span>{shell('allModules')}</span>
            <Icon name="chevronDown" size={18} className={styles.chevron} />
          </button>
          <div id={restId} className={styles.rest} data-open={open || undefined}>
            <List>{rest.map(row)}</List>
          </div>
        </>
      ) : null}
    </>
  );
}
