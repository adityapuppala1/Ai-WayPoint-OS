import { MODULE_IDS } from '@waypoint/core';
import { LinkButton, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { FeedbackForm } from '@/components/settings/FeedbackForm';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('feedbackTitle') };
}

/** What feedback can be about: every module, getting help, settings, or something else. */
const ABOUT = [...MODULE_IDS, 'support', 'settings', 'other'] as const;
type About = (typeof ABOUT)[number];

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ about?: string }>;
}) {
  const viewer = await requireViewer('/settings/feedback');
  const { about: asked } = await searchParams;
  const [t, nav] = await Promise.all([getTranslations('settings'), getTranslations('nav')]);
  const about: About = (ABOUT as readonly string[]).includes(asked ?? '')
    ? (asked as About)
    : 'other';
  const { user } = viewer;
  // A reply needs an address that reaches someone: not a guest, not a phone account's
  // placeholder.
  const replyTo = !user.isGuest && !user.email.endsWith('.invalid') ? user.email : null;
  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <h1>{t('feedbackTitle')}</h1>
        <p className="wp-lead">{t('feedbackLead')}</p>
      </header>
      <Panel>
        <FeedbackForm
          modules={ABOUT.map((id) => ({
            id,
            label: id === 'other' ? t('feedbackOther') : nav(id),
          }))}
          about={about}
          replyTo={replyTo}
        />
      </Panel>
      <div className="wp-row">
        <LinkButton href={'/settings' as Route} variant="quiet" icon="back">
          {t('title')}
        </LinkButton>
      </div>
    </div>
  );
}
