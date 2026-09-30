'use client';

import type { TrustedContact } from '@waypoint/api/client';
import { LinkButton } from '@waypoint/ui';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { ltr } from '@/lib/bidi';
import { callHref, emailHref, textHref } from './contact-links';
import styles from './crisis.module.css';

/**
 * The people someone chose to reach in a hard moment, each one tap away. Every button is an
 * ordinary link that opens the phone's own messaging, phone or mail app; Waypoint sends
 * nothing and nobody is contacted unless the person presses send there.
 */
export function TrustedContacts({
  title,
  contacts,
}: {
  /** The heading, in the language of the support card ("Message someone you trust"). */
  title: string;
  contacts: TrustedContact[];
}) {
  const t = useTranslations('support');
  const a11y = useTranslations('a11y');
  const titleId = useId();
  const message = t('contactMessage');

  return (
    <section className={styles.contacts} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.contactsTitle}>
        {title}
      </h3>
      <ul className={styles.contactList}>
        {contacts.map((c) => (
          <li key={c.id} className={styles.contact}>
            <p className={styles.contactName} dir="auto">
              {c.name}
            </p>
            {c.relation ? (
              <p className="wp-secondary" dir="auto">
                {c.relation}
              </p>
            ) : null}
            {/* The number or address itself, to dial or type from another device. */}
            {c.phone ? <p className="wp-secondary">{ltr(c.phone)}</p> : null}
            {c.email ? <p className={styles.contactAddress}>{c.email}</p> : null}
            <div className={styles.contactActions}>
              {c.phone ? (
                <>
                  <LinkButton href={textHref(c.phone, message)} variant="support" icon="text">
                    {a11y('text', { name: c.name })}
                  </LinkButton>
                  <LinkButton href={callHref(c.phone)} variant="secondary" icon="phone">
                    {a11y('call', { name: c.name })}
                  </LinkButton>
                </>
              ) : null}
              {c.email ? (
                <LinkButton
                  href={emailHref(c.email, t('contactSubject'), message)}
                  variant={c.phone ? 'quiet' : 'support'}
                  icon="email"
                >
                  {t('emailContact', { name: c.name })}
                </LinkButton>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.contactNote}>{t('contactNote')}</p>
    </section>
  );
}
