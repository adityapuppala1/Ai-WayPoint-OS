import { me, org, privacy } from '@waypoint/api';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { LegalLinks } from '@/components/legal/LegalLinks';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('privacyTitle') };
}

export default async function PrivacyPage() {
  const viewer = await requireViewer('/settings/privacy');
  const t = await getTranslations('settings');
  const [contacts, memories, programmes, lostOrganisations] = await Promise.all([
    me.listTrustedContacts(viewer.db, viewer.user.id),
    privacy.listMemories(viewer.db, viewer.user.id),
    org.myProgrammes(viewer.db, viewer.user.id, await getLocale()),
    org.organisationsLostWithAccount(viewer.db, viewer.user.id),
  ]);
  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <h1>{t('privacyTitle')}</h1>
        <p className="wp-lead">{t('privacyLead')}</p>
      </header>
      <PrivacySettings
        consents={viewer.consents}
        contacts={contacts}
        memories={memories}
        retention={viewer.profile.conversationRetentionDays}
        programmes={programmes}
        lostOrganisations={lostOrganisations}
      />
      <LegalLinks className="wp-cluster wp-meta" />
    </div>
  );
}
