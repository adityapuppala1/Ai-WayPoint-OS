import { me } from '@waypoint/api';
import { safeNextPath } from '@waypoint/core';
import { EmptyState, LinkButton, ModuleMark } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { getViewer } from '@/lib/server';

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('confirmedTitle'), robots: { index: false } };
}

/**
 * Where the link in a confirmation email lands. Opening it confirms the address and nothing
 * more: it never signs anyone in, so the person signs in next — on this device, if a guest
 * session here holds what they did before creating the account.
 */
export default async function EmailConfirmedPage({ searchParams }: Props) {
  const { error, next } = await searchParams;
  const [t, shell, viewer] = await Promise.all([
    getTranslations('auth'),
    getTranslations('shell'),
    getViewer(),
  ]);
  const signedIn = Boolean(viewer && !viewer.user.isGuest);
  const guestWithAccount =
    !error && viewer?.user.isGuest
      ? await me.guestAccountPending(viewer.db, viewer.user.id)
      : false;
  // Only ever on to a page on this site.
  const onward = safeNextPath(next);
  const signIn = `/sign-in?next=${encodeURIComponent(onward)}`;

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <div className="wp-row">
          <ModuleMark module={error ? 'support' : 'org'} size="lg" />
          <h1>{error ? t('confirmFailedTitle') : t('confirmedTitle')}</h1>
        </div>
      </header>
      <EmptyState
        title={error ? t('confirmFailedLead') : t('confirmedLead')}
        action={
          <div className="wp-row">
            {signedIn ? (
              <LinkButton
                href={(error ? '/settings#account' : onward) as Route}
                variant="primary"
                icon="forward"
              >
                {error ? t('confirmSendAgain') : t('confirmedContinue')}
              </LinkButton>
            ) : (
              <LinkButton href={signIn as Route} variant="primary" icon="account">
                {shell('signIn')}
              </LinkButton>
            )}
          </div>
        }
      >
        {error
          ? signedIn
            ? t('confirmFailedBodySignedIn')
            : t('confirmFailedBody')
          : signedIn
            ? t('confirmedBodySignedIn')
            : `${t('confirmedBody')}${guestWithAccount ? ` ${t('confirmedGuest')}` : ''}`}
      </EmptyState>
    </div>
  );
}
