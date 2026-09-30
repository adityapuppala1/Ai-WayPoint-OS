import { aiAvailable } from '@waypoint/ai';
import { path } from '@waypoint/api';
import { localizeRole, ROLES } from '@waypoint/content';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { NewPlanForm } from '@/components/path/NewPlanForm';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('path');
  return { title: t('newTitle') };
}

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const viewer = await requireViewer('/path/new');
  const { role } = await searchParams;
  const t = await getTranslations('path');
  const skills = await path.getUserSkills(viewer.db, viewer.user.id);
  const locale = await getLocale();
  const suggestions = path.suggestionsFor(viewer.profile, skills, 5, locale);
  const suggested = new Set(suggestions.map((s) => s.roleId));
  const roles = [
    ...suggestions.map((s) => ({
      id: s.roleId,
      title: s.title,
      family: s.family,
      suggested: true,
    })),
    ...ROLES.filter((r) => !suggested.has(r.id))
      .map((r) => localizeRole(r, locale))
      .map((r) => ({ id: r.id, title: r.title, family: r.family, suggested: false }))
      .sort((a, b) => a.title.localeCompare(b.title, locale)),
  ];
  const initialRole =
    role && ROLES.some((r) => r.id === role) ? role : (suggestions[0]?.roleId ?? '');
  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <h1>{t('newTitle')}</h1>
        <p className="wp-lead">{t('newLead')}</p>
      </header>
      <NewPlanForm
        roles={roles}
        initialRole={initialRole}
        initialHours={viewer.profile.hoursPerWeek}
        canPersonalise={aiAvailable() && viewer.consents.personalization}
      />
    </div>
  );
}
