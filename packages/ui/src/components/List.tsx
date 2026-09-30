import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Icon } from './Icon';
import styles from './List.module.css';

export function List({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none.
    <ul role="list" className={cn(styles.list, className)} aria-label={label}>
      {children}
    </ul>
  );
}

export interface ListItemProps {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  /** Makes the whole row a link. Use a plain anchor href or pass a Link element via `render`. */
  href?: string;
  /** Render prop for framework links (e.g. Next.js Link) wrapping the row content. */
  render?: (props: { className: string; children: ReactNode }) => ReactNode;
  className?: string;
}

/** One row in a List: leading mark, title and description, trailing meta or action. */
export function ListItem({
  title,
  description,
  leading,
  meta,
  trailing,
  href,
  render,
  className,
}: ListItemProps) {
  const content = (
    <>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
      {(href || render) && !trailing ? (
        <span className={styles.trailing}>
          <Icon name="chevronRight" size={18} className={styles.chevron} />
        </span>
      ) : null}
    </>
  );
  return (
    <li className={cn(styles.item, className)}>
      {render ? (
        render({ className: styles.row ?? '', children: content })
      ) : href ? (
        <a className={styles.row} href={href}>
          {content}
        </a>
      ) : (
        <div className={styles.row}>{content}</div>
      )}
    </li>
  );
}
