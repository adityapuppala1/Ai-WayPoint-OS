import { Icon } from '@waypoint/ui';
import { getLocale, getTranslations } from 'next-intl/server';

/**
 * Long-form guidance (checklists, the scam library, role descriptions) is written in English and
 * translated by people before it ships in other languages. Until then we say so plainly, and mark
 * the English text with `lang="en"` (see `contentLang`) so screen readers switch voice.
 */
export async function EnglishContentNote() {
  const locale = await getLocale();
  if (locale === 'en') return null;
  const t = await getTranslations('common');
  return (
    <p className="wp-meta wp-row" style={{ gap: 'var(--wp-space-2)' }}>
      <Icon name="language" size={16} />
      <span>{t('contentInEnglish')}</span>
    </p>
  );
}

/** `lang="en"` for English content shown inside a page in another language. */
export async function contentLang(): Promise<'en' | undefined> {
  return (await getLocale()) === 'en' ? undefined : 'en';
}
