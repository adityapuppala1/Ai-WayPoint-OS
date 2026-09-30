import { Icon, Panel } from '@waypoint/ui';
import { getTranslations } from 'next-intl/server';
import styles from './org.module.css';

/** What an organisation sees about its people — and what it never sees. */
export async function PrivacyPromise({ k, headingLevel = 2 }: { k: number; headingLevel?: 2 | 3 }) {
  const t = await getTranslations('org');
  const Sub = headingLevel === 2 ? 'h3' : 'h4';
  return (
    <Panel title={t('promiseTitle')} as="section" tone="quiet" headingLevel={headingLevel}>
      <div className={styles.promise}>
        <div>
          <Sub>
            <Icon name="show" size={20} className={styles.see} />
            {t('promiseSeeTitle')}
          </Sub>
          <ul>
            <li>{t('promiseSee1', { k })}</li>
            <li>{t('promiseSee2')}</li>
            <li>{t('promiseSee3', { k })}</li>
          </ul>
        </div>
        <div>
          <Sub>
            <Icon name="hide" size={20} className={styles.never} />
            {t('promiseNeverTitle')}
          </Sub>
          <ul>
            <li>{t('promiseNever1')}</li>
            <li>{t('promiseNever2')}</li>
            <li>{t('promiseNever3')}</li>
          </ul>
        </div>
      </div>
    </Panel>
  );
}
