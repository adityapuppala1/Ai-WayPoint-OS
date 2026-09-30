import { me } from '@waypoint/api';
import { COUNTRIES } from '@waypoint/content';
import { List, PageHeader, Panel } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { LinkRow } from '@/components/LinkRow';
import { LegalLinks } from '@/components/legal/LegalLinks';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default async function SettingsPage() {
  const viewer = await requireViewer('/settings');
  const t = await getTranslations('settings');
  const locale = await getLocale();
  const names = new Intl.DisplayNames([locale, 'en'], { type: 'region' });
  const countries = COUNTRIES.map((c) => ({ code: c.code, name: names.of(c.code) ?? c.name })).sort(
    (a, b) => a.name.localeCompare(b.name, locale),
  );
  return (
    <div className="wp-page">
      <PageHeader module="today" title={t('title')} lead={t('lead')} />
      <SettingsForm
        profile={viewer.profile}
        countries={countries}
        account={{
          isGuest: viewer.user.isGuest,
          email: viewer.user.isGuest ? null : viewer.user.email,
          // Phone accounts have a placeholder address that can never be confirmed.
          canConfirm: !viewer.user.isGuest && !viewer.user.email.endsWith('.invalid'),
          emailVerified: await me.isEmailVerified(viewer.db, viewer.user.id),
        }}
      />
      {/* Somewhere to say what is wrong, or what helped: it reaches the people who build this. */}
      <Panel flush>
        <List>
          <LinkRow
            href="/settings/feedback"
            title={t('feedbackTitle')}
            description={t('feedbackRow')}
          />
        </List>
      </Panel>
      <LegalLinks className="wp-cluster wp-meta" />
    </div>
  );
}
