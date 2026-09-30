import type { CirclePost } from '@waypoint/api/client';
import { Icon, type IconName } from '@waypoint/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import styles from './circles.module.css';
import { type Author, Person } from './Person';
import { PostBody } from './PostBody';
import { PostMenu } from './PostMenu';
import { ReactionBar } from './ReactionBar';
import { ReplyComposer } from './ReplyComposer';

type Held = NonNullable<CirclePost['held']>;

const HELD_ICON: Record<Held, IconName> = {
  crisis: 'support',
  scam: 'shield',
  reported: 'hide',
};

/** What people see as an author's name: the name they chose, or "Member 1234". */
export function nameOf(
  author: Author | null,
  labels: { former: string; member: (number: string) => string },
): string {
  if (!author) return labels.former;
  return author.name ?? labels.member(String(author.number));
}

async function Byline({
  author,
  name,
  at,
  small,
}: {
  author: Author | null;
  name: string;
  at: string;
  small?: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations('circles'), getFormatter()]);
  const date = new Date(at);
  const role =
    author?.role === 'host' || author?.role === 'moderator' || author?.role === 'former'
      ? author.role
      : null;
  return (
    <>
      <Person author={author} size={small ? 'sm' : undefined} />
      <div className={styles.who}>
        <span className={styles.name}>
          <span dir="auto">{name}</span>
          {author?.you ? <span className="wp-tag">{t('you')}</span> : null}
          {role ? (
            <span className="wp-tag" data-tone={role === 'former' ? undefined : 'info'}>
              {t(`roles.${role}`)}
            </span>
          ) : null}
        </span>
        <time
          className={styles.when}
          dateTime={at}
          title={format.dateTime(date, { dateStyle: 'full', timeStyle: 'short' })}
        >
          {format.relativeTime(date, new Date())}
        </time>
      </div>
    </>
  );
}

async function HeldNote({ held }: { held: Held }) {
  const t = await getTranslations('circles');
  return (
    <p className={styles.heldNote}>
      <Icon name={HELD_ICON[held]} size={18} />
      <span>
        <strong>{t(`held.${held}Title`)}</strong>
        {t(`held.${held}Body`)}
      </span>
    </p>
  );
}

/** One post with its reactions and replies. Rendered on the server; only the controls hydrate. */
export async function Post({
  post,
  circleId,
  moderator,
}: {
  post: CirclePost;
  circleId: string;
  /** Hosts and moderators may remove any post. */
  moderator: boolean;
}) {
  const t = await getTranslations('circles');
  const labels = {
    former: t('roles.former'),
    member: (number: string) => t('member', { number }),
  };
  const name = nameOf(post.author, labels);
  const mine = Boolean(post.author?.you);
  return (
    <article className={styles.post} data-held={post.held !== null}>
      <header className={styles.postHead}>
        <Byline author={post.author} name={name} at={post.createdAt} />
        <PostMenu
          postId={post.id}
          authorName={name}
          canReport={!mine && post.held === null}
          canDelete={mine || moderator}
        />
      </header>

      {post.kind !== 'post' ? (
        <p>
          <span className={`wp-tag ${styles.kindTag}`} data-kind={post.kind}>
            {t(`kinds.${post.kind}`)}
          </span>
        </p>
      ) : null}

      <PostBody text={post.body} />

      {post.held ? <HeldNote held={post.held} /> : null}

      {post.held ? null : <ReactionBar postId={post.id} reactions={post.reactions} />}

      {post.replies.length ? (
        <ol className={styles.replies} aria-label={t('replies', { count: post.replies.length })}>
          {post.replies.map((r) => (
            <li key={r.id} className={styles.reply} data-held={r.held !== null}>
              <div className={styles.replyHead}>
                <Byline author={r.author} name={nameOf(r.author, labels)} at={r.createdAt} small />
                <PostMenu
                  postId={r.id}
                  authorName={nameOf(r.author, labels)}
                  canReport={!r.author?.you && r.held === null}
                  canDelete={Boolean(r.author?.you) || moderator}
                />
              </div>
              <PostBody text={r.body} />
              {r.held ? <HeldNote held={r.held} /> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {post.held ? null : <ReplyComposer circleId={circleId} postId={post.id} authorName={name} />}
    </article>
  );
}
