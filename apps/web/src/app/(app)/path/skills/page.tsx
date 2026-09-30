import { path } from '@waypoint/api';
import { SKILLS, skillName } from '@waypoint/content';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { SkillsEditor } from '@/components/path/SkillsEditor';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('path');
  return { title: t('skillsEditorTitle') };
}

export default async function SkillsPage() {
  const viewer = await requireViewer('/path/skills');
  const t = await getTranslations('path');
  const mine = await path.getUserSkills(viewer.db, viewer.user.id);
  const locale = await getLocale();
  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <h1>{t('skillsEditorTitle')}</h1>
        <p className="wp-lead">{t('skillsEditorLead')}</p>
      </header>
      <SkillsEditor
        catalog={SKILLS.map((s) => ({
          id: s.id,
          name: skillName(s.id, locale),
          alt: locale === 'en' ? undefined : s.name,
          category: s.category,
        }))}
        initial={mine.map((s) => ({ skillId: s.skillId, level: s.level }))}
      />
    </div>
  );
}
