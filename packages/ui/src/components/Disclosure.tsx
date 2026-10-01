'use client';

import type { ReactNode } from 'react';
import {
  Disclosure as AriaDisclosure,
  Button,
  DisclosurePanel,
  Heading,
} from 'react-aria-components';
import styles from './Disclosure.module.css';
import { Icon } from './Icon';

/** Progressive disclosure for secondary detail ("Why am I seeing this?", FAQs). */
export function Disclosure({
  title,
  children,
  defaultExpanded,
  headingLevel = 3,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  headingLevel?: 2 | 3 | 4;
}) {
  return (
    <AriaDisclosure className={styles.disclosure} defaultExpanded={defaultExpanded}>
      <Heading level={headingLevel} className={styles.heading}>
        <Button slot="trigger" className={styles.trigger}>
          {title}
          <span className={styles.chevron}>
            <Icon name="chevronDown" size={18} />
          </span>
        </Button>
      </Heading>
      <DisclosurePanel className={styles.panel}>
        <div className={styles.panelBody}>{children}</div>
      </DisclosurePanel>
    </AriaDisclosure>
  );
}
