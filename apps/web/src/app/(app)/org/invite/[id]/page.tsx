import { ApiError, org } from '@waypoint/api';
import { dbReady, getDb } from '@waypoint/db';
import { LinkButton, ModuleMark, Notice, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SendConfirmation } from '@/components/auth/SendConfirmation';
import { InvitationAnswer } from '@/components/org/InvitationAnswer';
import styles from '@/components/org/org.module.css';
import { getViewer, pageRateLimit } from '@/lib/server';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('org');
  return { title: t('title'), robots: { index: false } };
}

export default async function InvitationPage({ params }: Props) {
  const { id } = await params;
  if (!/^[\w-]{8,64}$/.test(id)) notFound();
  await pageRateLimit('invitation-page', 60, 3600);
  const viewer = await getViewer();
  await dbReady();
  const db = viewer?.db ?? getDb();
  let view: org.InvitationView;
  try {
    view = await org.invitationView(
      db,
      viewer
        ? { id: viewer.user.id, email: viewer.user.email, isGuest: viewer.user.isGuest }
        : null,
      id,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const t = await getTranslations('org');
  const shell = await getTranslations('shell');
  const i = view;
  const next = encodeURIComponent(`/org/invite/${id}`);
  const signedInAccount = Boolean(viewer && !viewer.user.isGuest);

  let body: ReactNode;
  if (i.status === 'pending' && i.forYou && i.needsVerification) {
    // The link may have been seen by others: answering needs the confirmed owner of the address.
    body = (
      <Notice title={t('invitation.verifyTitle')}>
        <div className="wp-stack">
          <p>{t('invitation.verifyBody', { email: i.emailHint })}</p>
          <SendConfirmation email={viewer?.user.email ?? ''} next={`/org/invite/${i.id}`} />
        </div>
      </Notice>
    );
  } else if (i.status === 'pending' && i.forYou) {
    body = <InvitationAnswer invitationId={i.id} organisation={i.organisation.name} />;
  } else if (i.status === 'pending' && !signedInAccount) {
    body = (
      <Notice
        title={t('invitation.signInTitle')}
        actions={
          <div className="wp-row">
            <LinkButton href={`/sign-in?next=${next}` as Route} variant="primary" icon="account">
              {shell('signIn')}
            </LinkButton>
            <LinkButton href={`/sign-up?next=${next}` as Route} variant="secondary">
              {shell('createAccount')}
            </LinkButton>
          </div>
        }
      >
        <p>{t('invitation.signInBody', { email: i.emailHint })}</p>
      </Notice>
    );
  } else if (i.status === 'pending') {
    body = <Notice tone="caution" title={t('invitation.wrongAccount', { email: i.emailHint })} />;
  } else if (i.status === 'expired') {
    body = <Notice tone="caution" title={t('invitation.expired', { inviter: i.inviter })} />;
  } else if (i.status === 'canceled') {
    body = <Notice tone="caution" title={t('invitation.canceled')} />;
  } else {
    body = (
      <Notice
        title={t('invitation.answered')}
        actions={
          i.organisationId ? (
            <LinkButton href={`/org/${i.organisationId}` as Route} variant="primary" icon="forward">
              {t('invitation.openOrganisation', { organisation: i.organisation.name })}
            </LinkButton>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <div className="wp-row">
          <ModuleMark module="org" size="lg" />
          <h1 className={styles.pageTitle}>
            {t('invitation.title', { organisation: i.organisation.name })}
          </h1>
        </div>
        <p className="wp-lead">
          {t('invitation.body', { inviter: i.inviter, organisation: i.organisation.name })}
        </p>
        <p className={styles.metaLine}>
          <span>{t(`kinds.${i.organisation.kind}`)}</span>
          <span>{t('invitation.yourRole', { role: t(`roles.${i.role}`) })}</span>
        </p>
      </header>
      <Panel as="section">{body}</Panel>
    </div>
  );
}
