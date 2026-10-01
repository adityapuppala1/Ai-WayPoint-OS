import { people } from '@waypoint/api';
import { EmptyState, LinkButton, Notice, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { StaffInvitationAnswer } from '@/components/admin/StaffInvitationAnswer';
import { getViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.people');
  return { title: t('answerTitle'), robots: { index: false } };
}

/**
 * An invitation to join Waypoint's staff, as its invitee sees it. Only someone signed in with
 * the invited address (confirmed) sees it; to anyone else it is not there. Someone not signed
 * in to an account (a guest, or no one) is sent to sign in first, and comes back here.
 */
export default async function StaffInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer || viewer.user.isGuest)
    redirect(`/sign-in?next=${encodeURIComponent(`/staff-invite/${id}`)}` as Route);
  const [t, format] = await Promise.all([getTranslations('admin.people'), getFormatter()]);
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const result = valid
    ? await people
        .staffInvitation(viewer.db, id, viewer.user.id)
        .then((invite) => ({ invite, problem: null }))
        .catch((err: { code?: string }) => ({ invite: null, problem: err.code ?? 'not-found' }))
    : { invite: null, problem: 'not-found' };

  return (
    <div className="wp-page">
      <h1>{t('answerTitle')}</h1>
      {result.invite ? (
        <Panel>
          <div className="wp-stack">
            <p className="wp-lead">
              {t('answerLead', {
                who: result.invite.invitedBy ?? t('someone'),
                role: t(`roles.${result.invite.role}`),
              })}
            </p>
            <p>{result.invite.role === 'admin' ? t('adminHint') : t('staffHint')}</p>
            <p className="wp-meta">
              {t('answerExpires', {
                when: format.dateTime(new Date(result.invite.expiresAt), { dateStyle: 'long' }),
              })}
            </p>
            <StaffInvitationAnswer id={id} />
          </div>
        </Panel>
      ) : result.problem === 'verify-first' ? (
        <Notice tone="caution" title={t('verifyFirst')}>
          <LinkButton href={'/settings' as Route} variant="secondary" size="sm">
            {t('openSettings')}
          </LinkButton>
        </Notice>
      ) : (
        <EmptyState
          title={t('answerGone')}
          action={
            <LinkButton href={'/' as Route} variant="secondary">
              {t('goToday')}
            </LinkButton>
          }
        />
      )}
    </div>
  );
}
