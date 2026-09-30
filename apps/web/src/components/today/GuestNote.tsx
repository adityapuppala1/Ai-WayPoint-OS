'use client';

import { Button, LinkButton, Notice } from '@waypoint/ui';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { savePreferences } from '@/lib/preferences';

/**
 * One honest note for a guest, once they have saved something of their own: it is kept with
 * this browser's guest session, and an account keeps it on any device. Said once. "Not now"
 * is remembered and the note does not come back; it never blocks the page or asks twice.
 */
export function GuestNote() {
  const shell = useTranslations('shell');
  const common = useTranslations('common');
  const [gone, setGone] = useState(false);
  if (gone) return null;

  const notNow = () => {
    setGone(true);
    // The server sets the cookie, for a year: one the page wrote itself, Safari and every
    // browser on an iPhone would forget after seven days, and the note would come back.
    void savePreferences({ guestNote: 'off' });
  };

  return (
    <section aria-label={shell('account')}>
      <Notice
        title={shell('guestNotice')}
        actions={
          <>
            <LinkButton href={'/sign-up' as Route} variant="secondary" size="sm" icon="account">
              {shell('createAccount')}
            </LinkButton>
            <Button variant="quiet" size="sm" onPress={notNow}>
              {common('notNow')}
            </Button>
          </>
        }
      />
    </section>
  );
}
