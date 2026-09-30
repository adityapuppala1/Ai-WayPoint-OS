'use client';

import type { Key, ReactNode } from 'react';
import {
  Tab as AriaTab,
  TabList as AriaTabList,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
  type TabsProps as AriaTabsProps,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components';
import { cn } from '../cn';
import type { IconName } from '../icons';
import { Icon } from './Icon';
import styles from './Tabs.module.css';

export function Tabs({
  className,
  ...rest
}: Omit<AriaTabsProps, 'className'> & { className?: string }) {
  return <AriaTabs {...rest} className={cn(styles.tabs, className)} />;
}

export function TabList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <AriaTabList className={styles.list} aria-label={label}>
      {children}
    </AriaTabList>
  );
}

export function Tab({ id, children, icon }: { id: string; children: ReactNode; icon?: IconName }) {
  return (
    <AriaTab id={id} className={styles.tab}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </AriaTab>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AriaTabPanel id={id} className={styles.panel}>
      {children}
    </AriaTabPanel>
  );
}

export interface SegmentedOption {
  id: string;
  label: ReactNode;
  icon?: IconName;
}

/** A small set of mutually exclusive views or modes (e.g. theme). */
export function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys: Set<Key>) => {
        const next = [...keys][0];
        if (next !== undefined) onChange(String(next));
      }}
      className={styles.segmented}
    >
      {options.map((o) => (
        <ToggleButton key={o.id} id={o.id} className={styles.segment}>
          {o.icon ? <Icon name={o.icon} size={18} /> : null}
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
