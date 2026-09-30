import { Icon } from '@waypoint/ui';
import { getTranslations } from 'next-intl/server';
import { Fragment } from 'react';
import styles from './circles.module.css';
import { TOKEN_RE, TOKENS } from './masked';

/** A post's text, with hidden details shown as small labelled chips in the reader's language. */
export async function PostBody({
  text,
  className,
  lang,
}: {
  text: string;
  className?: string;
  lang?: string;
}) {
  const t = await getTranslations('circles');
  const parts = text.split(TOKEN_RE);
  return (
    <p className={className ?? styles.body} dir="auto" lang={lang}>
      {parts.map((part, i) => {
        const id = TOKENS[part as keyof typeof TOKENS];
        return id ? (
          <span key={i} className={styles.masked}>
            <Icon name="hide" size={14} />
            {t('hiddenToken', { what: t(`tokens.${id}`) })}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        );
      })}
    </p>
  );
}
