/**
 * Circles: small peer groups (up to 12) around a shared situation, in the person's language.
 * Safety comes first — see @waypoint/core/community for how posts are checked. Members appear
 * by a name they choose for that circle (or "Member 1234", different in every circle), never by
 * their account name or email.
 */
import { z } from '@hono/zod-openapi';
import {
  AUTO_HIDE_REPORTS,
  type CrisisResponsePlan,
  memberNumber,
  moderatePost,
  POST_KINDS,
  planCrisisResponse,
  REACTIONS,
  type REPORT_REASONS,
} from '@waypoint/core';
import { hasWebAddress, redactPII } from '@waypoint/core/privacy';
import { foldText } from '@waypoint/core/text';
import {
  and,
  asc,
  circleMembers,
  circlePosts,
  circleReactions,
  circleReports,
  circles,
  count,
  type Database,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  nudges,
  or,
  profiles,
  sql,
} from '@waypoint/db';
import { ApiError, forbidden, notFound } from '../lib/problem';
import type { Consents } from '../types';
import { helpCountry, type Profile } from './me';
import { recordCrisis } from './safety';

const SITUATION_TOPIC: Record<string, string> = {
  'first-job': 'first-job',
  'lost-job': 'lost-job',
  'changing-career': 'changing-career',
  studying: 'studying',
  'running-business': 'running-business',
  caring: 'caring',
  'new-country': 'new-country',
  retiring: 'retiring',
};

/** Sent to the author when someone in their circle is worried about them. Anonymous. */
const WORRIED: Record<string, { title: string; body: string }> = {
  en: {
    title: 'Someone in your circle is thinking of you',
    body: 'If things are hard right now, you don’t have to handle them alone. Support is one tap away.',
  },
  hi: {
    title: 'आपकी मंडली में कोई आपके बारे में सोच रहा है',
    body: 'अगर अभी हालात मुश्किल हैं, तो आपको अकेले इनसे नहीं जूझना है। मदद बस एक टैप दूर है।',
  },
  es: {
    title: 'Alguien de tu círculo está pensando en ti',
    body: 'Si ahora mismo las cosas están difíciles, no tienes que afrontarlas solo. La ayuda está a un toque.',
  },
  fr: {
    title: 'Quelqu’un de votre cercle pense à vous',
    body: 'Si c’est difficile en ce moment, vous n’avez pas à affronter ça seul. L’aide est à portée de main.',
  },
  pt: {
    title: 'Alguém do seu círculo está pensando em você',
    body: 'Se as coisas estão difíceis agora, você não precisa enfrentar isso sozinho. A ajuda está a um toque.',
  },
  ar: {
    title: 'أحد أفراد حلقتك يفكّر فيك',
    body: 'إن كانت الأمور صعبة الآن، فلستَ مضطرًا لمواجهتها وحدك. المساعدة على بُعد لمسة واحدة.',
  },
  sw: {
    title: 'Mtu katika kikundi chako anakufikiria',
    body: 'Ikiwa mambo ni magumu sasa hivi, si lazima uyakabili peke yako. Msaada uko karibu kwa mguso mmoja.',
  },
};

export const CircleSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    topic: z.string(),
    language: z.string(),
    memberCount: z.number().int(),
    maxMembers: z.number().int(),
    full: z.boolean(),
    joined: z.boolean(),
  })
  .openapi('CircleSummary');

export const CirclesViewSchema = z
  .object({
    mine: z.array(CircleSummarySchema),
    suggested: z.array(CircleSummarySchema),
    browse: z.array(CircleSummarySchema),
    /** False when the person hasn't allowed circle suggestions (browse still works). */
    matching: z.boolean(),
  })
  .openapi('Circles');

const AuthorSchema = z.object({
  name: z.string().nullable(),
  number: z.number().int(),
  you: z.boolean(),
  role: z.string(),
});

export const PostSchema = z
  .object({
    id: z.string(),
    kind: z.enum(POST_KINDS),
    body: z.string(),
    author: AuthorSchema.nullable(),
    createdAt: z.string(),
    /** Only the author ever sees a held post, with the reason. */
    held: z.enum(['crisis', 'scam', 'reported']).nullable(),
    reactions: z.object({
      support: z.number().int(),
      helpful: z.number().int(),
      celebrate: z.number().int(),
      mine: z.array(z.enum(REACTIONS)),
    }),
    replies: z.array(
      z.object({
        id: z.string(),
        body: z.string(),
        author: AuthorSchema.nullable(),
        createdAt: z.string(),
        held: z.enum(['crisis', 'scam', 'reported']).nullable(),
      }),
    ),
  })
  .openapi('CirclePost');

export const CircleViewSchema = z
  .object({
    circle: CircleSummarySchema,
    membership: z
      .object({
        role: z.string(),
        name: z.string().nullable(),
        number: z.number().int(),
        muted: z.boolean(),
      })
      .nullable(),
    posts: z.array(PostSchema),
  })
  .openapi('CircleView');

export const JoinInputSchema = z
  .object({
    /** The name others see here; leave empty to appear as "Member 1234". */
    name: z.string().trim().max(40).optional(),
    acceptGuidelines: z.literal(true),
  })
  .openapi('CircleJoinInput');

export const LeaveInputSchema = z
  .object({ deletePosts: z.boolean().optional() })
  .openapi('CircleLeaveInput');

export const AliasInputSchema = z
  .object({ name: z.string().trim().max(40).optional() })
  .openapi('CircleAliasInput');

export const PostInputSchema = z
  .object({
    kind: z.enum(POST_KINDS).default('post'),
    body: z.string().trim().min(1).max(2000),
    parentId: z.uuid().optional(),
  })
  .openapi('CirclePostInput');

export type CircleSummary = z.infer<typeof CircleSummarySchema>;
export type CirclesView = z.infer<typeof CirclesViewSchema>;
export type CirclePost = z.infer<typeof PostSchema>;
export type CircleView = z.infer<typeof CircleViewSchema>;

type CircleRow = typeof circles.$inferSelect;

const summary = (c: CircleRow, joined: boolean): CircleSummary => ({
  id: c.id,
  name: c.name,
  description: c.description,
  topic: c.topic,
  language: c.language,
  memberCount: c.memberCount,
  maxMembers: c.maxMembers,
  full: c.memberCount >= c.maxMembers,
  joined,
});

export async function circlesOverview(
  db: Database,
  userId: string,
  profile: Profile,
  consents: Consents,
  locale: string,
): Promise<CirclesView> {
  const memberships = await db
    .select({ circleId: circleMembers.circleId })
    .from(circleMembers)
    .where(eq(circleMembers.userId, userId));
  const joinedIds = new Set(memberships.map((m) => m.circleId));
  const all = await db
    .select()
    .from(circles)
    .where(
      and(isNull(circles.archivedAt), or(eq(circles.language, locale), eq(circles.language, 'en'))),
    )
    .orderBy(asc(circles.createdAt));
  const mine = joinedIds.size
    ? await db
        .select()
        .from(circles)
        .where(inArray(circles.id, [...joinedIds]))
    : [];

  // Prefer circles in the person's language; English ones only where nothing local exists.
  const byTopic = new Map<string, CircleRow>();
  for (const c of all) {
    if (joinedIds.has(c.id)) continue;
    const prev = byTopic.get(c.topic);
    const better =
      !prev ||
      (c.language === locale && prev.language !== locale) ||
      (c.language === prev.language &&
        prev.memberCount >= prev.maxMembers &&
        c.memberCount < c.maxMembers);
    if (better) byTopic.set(c.topic, c);
  }
  const browse = [...byTopic.values()];

  const matching = consents.circle_matching;
  const topics = new Set<string>();
  if (matching) {
    const s = profile.situation ? SITUATION_TOPIC[profile.situation] : undefined;
    if (s) topics.add(s);
    for (const i of profile.interests) topics.add(i);
  }
  const suggested = matching ? browse.filter((c) => topics.has(c.topic)).slice(0, 3) : [];
  const suggestedIds = new Set(suggested.map((c) => c.id));

  return {
    mine: mine.map((c) => summary(c, true)),
    suggested: suggested.map((c) => summary(c, false)),
    browse: browse.filter((c) => !suggestedIds.has(c.id)).map((c) => summary(c, false)),
    matching,
  };
}

async function circleOr404(db: Database, id: string): Promise<CircleRow> {
  const [c] = await db
    .select()
    .from(circles)
    .where(and(eq(circles.id, id), isNull(circles.archivedAt)))
    .limit(1);
  if (!c) throw notFound('Circle');
  return c;
}

async function membershipOf(db: Database, circleId: string, userId: string) {
  const [m] = await db
    .select()
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)))
    .limit(1);
  return m ?? null;
}

type Author = z.infer<typeof AuthorSchema>;

function heldFor(p: typeof circlePosts.$inferSelect): 'crisis' | 'scam' | 'reported' | null {
  if (!p.hiddenAt) return null;
  if (p.hiddenReason === 'crisis' || p.hiddenReason === 'scam') return p.hiddenReason;
  return 'reported';
}

export async function circleView(
  db: Database,
  userId: string,
  circleId: string,
): Promise<CircleView> {
  const circle = await circleOr404(db, circleId);
  const me = await membershipOf(db, circleId, userId);
  if (!me) return { circle: summary(circle, false), membership: null, posts: [] };

  const members = await db.select().from(circleMembers).where(eq(circleMembers.circleId, circleId));
  const authors = new Map<string, Author>(
    members.map((m) => [
      m.userId,
      {
        name: m.alias,
        number: memberNumber(m.userId, circleId),
        you: m.userId === userId,
        role: m.role,
      },
    ]),
  );

  // Everyone sees published posts; authors also see their own held posts (and why).
  const rows = await db
    .select()
    .from(circlePosts)
    .where(
      and(
        eq(circlePosts.circleId, circleId),
        or(isNull(circlePosts.hiddenAt), eq(circlePosts.authorId, userId)),
      ),
    )
    .orderBy(desc(circlePosts.createdAt))
    .limit(200);
  const ids = rows.map((r) => r.id);
  const reactions = ids.length
    ? await db
        .select({
          postId: circleReactions.postId,
          kind: circleReactions.kind,
          userId: circleReactions.userId,
        })
        .from(circleReactions)
        .where(inArray(circleReactions.postId, ids))
    : [];

  const authorOf = (id: string | null): Author | null =>
    id
      ? (authors.get(id) ?? {
          name: null,
          number: memberNumber(id, circleId),
          you: false,
          role: 'former',
        })
      : null;
  const topLevel = rows.filter((r) => !r.parentId).slice(0, 50);
  const posts: CirclePost[] = topLevel.map((p) => {
    const mine = reactions
      .filter((r) => r.postId === p.id && r.userId === userId)
      .map((r) => r.kind);
    const countOf = (k: string) =>
      reactions.filter((r) => r.postId === p.id && r.kind === k).length;
    return {
      id: p.id,
      kind: (POST_KINDS as readonly string[]).includes(p.kind)
        ? (p.kind as CirclePost['kind'])
        : 'post',
      body: p.body,
      author: authorOf(p.authorId),
      createdAt: p.createdAt.toISOString(),
      held: heldFor(p),
      reactions: {
        support: countOf('support'),
        helpful: countOf('helpful'),
        celebrate: countOf('celebrate'),
        mine: mine.filter((k): k is CirclePost['reactions']['mine'][number] =>
          (REACTIONS as readonly string[]).includes(k),
        ),
      },
      replies: rows
        .filter((r) => r.parentId === p.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((r) => ({
          id: r.id,
          body: r.body,
          author: authorOf(r.authorId),
          createdAt: r.createdAt.toISOString(),
          held: heldFor(r),
        })),
    };
  });

  return {
    circle: summary(circle, true),
    membership: {
      role: me.role,
      name: me.alias,
      number: memberNumber(userId, circleId),
      muted: Boolean(me.mutedUntil && me.mutedUntil > new Date()),
    },
    posts,
  };
}

/**
 * Join a circle. Circles stay small: when one is full, Waypoint opens a sibling circle on the
 * same topic and language and puts the person there.
 */
export async function joinCircle(
  db: Database,
  userId: string,
  circleId: string,
  input: z.infer<typeof JoinInputSchema>,
): Promise<{ circleId: string }> {
  const circle = await circleOr404(db, circleId);
  if (await membershipOf(db, circleId, userId)) return { circleId };
  const alias = cleanAlias(input.name);
  const mine = await db
    .select({ n: count() })
    .from(circleMembers)
    .where(eq(circleMembers.userId, userId));
  if (Number(mine[0]?.n ?? 0) >= 5) {
    throw new ApiError(
      409,
      'limit',
      'You can be in up to five circles. Leave one to join another.',
    );
  }

  return db.transaction(async (tx) => {
    let target = circle;
    // Lock the row so two people can't take the last seat at once.
    const [fresh] = await tx.select().from(circles).where(eq(circles.id, circle.id)).for('update');
    if (fresh && fresh.memberCount >= fresh.maxMembers) {
      const siblings = await tx
        .select()
        .from(circles)
        .where(
          and(
            eq(circles.topic, circle.topic),
            eq(circles.language, circle.language),
            isNull(circles.archivedAt),
            sql`${circles.memberCount} < ${circles.maxMembers}`,
          ),
        )
        .limit(1);
      target =
        siblings[0] ??
        (
          await tx
            .insert(circles)
            .values({
              slug: `${circle.topic}-${circle.language}-${Date.now().toString(36)}`,
              name: circle.name,
              description: circle.description,
              topic: circle.topic,
              country: circle.country,
              language: circle.language,
              maxMembers: circle.maxMembers,
            })
            .returning()
        )[0]!;
    }
    await tx.insert(circleMembers).values({
      circleId: target.id,
      userId,
      alias,
      guidelinesAcceptedAt: new Date(),
    });
    await tx
      .update(circles)
      .set({ memberCount: sql`${circles.memberCount} + 1` })
      .where(eq(circles.id, target.id));
    return { circleId: target.id };
  });
}

/**
 * Leave a circle. By default posts stay (shown as from a former member) so conversations still
 * make sense; `deletePosts` removes everything the person wrote there, with replies to it.
 */
export async function leaveCircle(
  db: Database,
  userId: string,
  circleId: string,
  opts: { deletePosts?: boolean } = {},
): Promise<void> {
  await db.transaction(async (tx) => {
    const res = await tx
      .delete(circleMembers)
      .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)))
      .returning({ id: circleMembers.circleId });
    if (!res.length) throw notFound('Membership');
    await tx
      .update(circles)
      .set({ memberCount: sql`greatest(${circles.memberCount} - 1, 0)` })
      .where(eq(circles.id, circleId));
    if (opts.deletePosts) {
      const mine = await tx
        .select({ id: circlePosts.id })
        .from(circlePosts)
        .where(and(eq(circlePosts.circleId, circleId), eq(circlePosts.authorId, userId)));
      const ids = mine.map((p) => p.id);
      if (ids.length) {
        await tx
          .delete(circlePosts)
          .where(or(inArray(circlePosts.id, ids), inArray(circlePosts.parentId, ids)));
      }
    }
  });
}

/** Names that would pass for Waypoint's own staff, in the languages circles run in. */
const STAFF_LIKE =
  /waypoint|(?<![a-z])(?:moderator|moderador|moderateur|admin|administrator|official|oficial|officiel|staff|helpline|support|soporte|suporte)(?![a-z])|msimamizi|مشرف|الدعم|मॉडरेटर|एडमिन/u;

/** A circle name is a first name or nickname: no phone numbers, emails or other contact details. */
function cleanAlias(name: string | undefined): string | null {
  const alias = name?.trim().replace(/\s+/g, ' ') || null;
  if (alias && (redactPII(alias).found.length || hasWebAddress(alias))) {
    throw new ApiError(
      422,
      'name-contact',
      'Use a first name or nickname, without contact details or ID numbers.',
    );
  }
  // Nobody in a circle speaks for Waypoint: a name that says so would be believed.
  if (alias && STAFF_LIKE.test(foldText(alias))) {
    throw new ApiError(422, 'name-reserved', 'Please choose a different name.');
  }
  return alias;
}

/** Change the name others see in this circle (empty → "Member 1234"). */
export async function setAlias(
  db: Database,
  userId: string,
  circleId: string,
  name: string | undefined,
): Promise<void> {
  const alias = cleanAlias(name);
  const res = await db
    .update(circleMembers)
    .set({ alias })
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)))
    .returning({ id: circleMembers.circleId });
  if (!res.length) throw notFound('Membership');
}

export async function setMuted(
  db: Database,
  userId: string,
  circleId: string,
  muted: boolean,
): Promise<void> {
  const res = await db
    .update(circleMembers)
    .set({ mutedUntil: muted ? new Date('2999-01-01T00:00:00Z') : null })
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)))
    .returning({ id: circleMembers.circleId });
  if (!res.length) throw notFound('Membership');
}

export const PostResultSchema = z
  .object({
    post: z.object({
      id: z.string(),
      body: z.string(),
      held: z.enum(['crisis', 'scam']).nullable(),
    }),
    /** Kinds of personal detail that were masked, e.g. phone, email. */
    masked: z.array(z.string()),
    /** Present when the post suggested the author may be in danger. */
    crisis: z
      .object({
        tier: z.number().int(),
        headline: z.string(),
        message: z.string(),
        actions: z.array(
          z.object({ kind: z.string(), label: z.string(), href: z.string().optional() }),
        ),
      })
      .passthrough()
      .nullable(),
  })
  .openapi('CirclePostResult');

export interface PostResult {
  post: { id: string; body: string; held: 'crisis' | 'scam' | null };
  masked: string[];
  crisis: CrisisResponsePlan | null;
}

export async function createPost(
  db: Database,
  userId: string,
  profile: Profile,
  circleId: string,
  input: z.infer<typeof PostInputSchema>,
): Promise<PostResult> {
  await circleOr404(db, circleId);
  if (!(await membershipOf(db, circleId, userId))) throw forbidden('Join the circle to post.');
  if (input.parentId) {
    const [parent] = await db
      .select({ id: circlePosts.id, parentId: circlePosts.parentId })
      .from(circlePosts)
      .where(and(eq(circlePosts.id, input.parentId), eq(circlePosts.circleId, circleId)))
      .limit(1);
    if (!parent || parent.parentId) throw notFound('Post');
  }

  const m = moderatePost(input.body, { country: helpCountry(profile) });
  const now = new Date();
  const [row] = await db
    .insert(circlePosts)
    .values({
      circleId,
      authorId: userId,
      parentId: input.parentId ?? null,
      kind: input.parentId ? 'post' : input.kind,
      body: m.text,
      crisisTier: m.crisis.tier,
      hiddenAt: m.hold ? now : null,
      hiddenReason: m.hold,
    })
    .returning({ id: circlePosts.id });
  if (!row) throw new Error('Could not save the post');

  let crisis: CrisisResponsePlan | null = null;
  if (m.hold === 'crisis') {
    const plan = planCrisisResponse(m.crisis, {
      country: helpCountry(profile),
      locale: profile.locale,
      inCircle: true,
    });
    await recordCrisis(db, {
      userId,
      channel: 'web',
      country: helpCountry(profile),
      assessment: m.crisis,
      plan,
    });
    crisis = plan;
  }
  return { post: { id: row.id, body: m.text, held: m.hold }, masked: m.masked, crisis };
}

async function postInMyCircle(db: Database, userId: string, postId: string) {
  const [p] = await db.select().from(circlePosts).where(eq(circlePosts.id, postId)).limit(1);
  if (!p) throw notFound('Post');
  const member = await membershipOf(db, p.circleId, userId);
  if (!member) throw notFound('Post');
  // Held posts are invisible to everyone but their author.
  if (p.hiddenAt && p.authorId !== userId) throw notFound('Post');
  return { post: p, member };
}

export async function deletePost(db: Database, userId: string, postId: string): Promise<void> {
  const { post, member } = await postInMyCircle(db, userId, postId);
  if (post.authorId !== userId && member.role !== 'host' && member.role !== 'moderator')
    throw forbidden();
  // Replies go with the post they answer.
  await db
    .delete(circlePosts)
    .where(or(eq(circlePosts.id, postId), eq(circlePosts.parentId, postId)));
}

/** Toggle a reaction; returns whether it is now on. */
export async function toggleReaction(
  db: Database,
  userId: string,
  postId: string,
  kind: (typeof REACTIONS)[number],
): Promise<{ on: boolean }> {
  await postInMyCircle(db, userId, postId);
  const removed = await db
    .delete(circleReactions)
    .where(
      and(
        eq(circleReactions.postId, postId),
        eq(circleReactions.userId, userId),
        eq(circleReactions.kind, kind),
      ),
    )
    .returning({ postId: circleReactions.postId });
  if (removed.length) return { on: false };
  await db.insert(circleReactions).values({ postId, userId, kind }).onConflictDoNothing();
  return { on: true };
}

/**
 * Report a post. Enough distinct reports hide it until someone reviews it. A "worried about
 * this person" report also sends the author a gentle, anonymous note pointing to support.
 */
export async function reportPost(
  db: Database,
  userId: string,
  postId: string,
  reason: (typeof REPORT_REASONS)[number],
): Promise<{ hidden: boolean }> {
  const { post } = await postInMyCircle(db, userId, postId);
  if (post.authorId === userId)
    throw new ApiError(400, 'own-post', 'You can delete your own post.');
  const [existing] = await db
    .select({ id: circleReports.id })
    .from(circleReports)
    .where(and(eq(circleReports.postId, postId), eq(circleReports.reporterId, userId)))
    .limit(1);
  if (!existing) {
    await db.insert(circleReports).values({ postId, reporterId: userId, reason });
  }
  const [reports] = await db
    .select({ n: count() })
    .from(circleReports)
    .where(and(eq(circleReports.postId, postId), isNull(circleReports.resolvedAt)));
  const hide = Number(reports?.n ?? 0) >= AUTO_HIDE_REPORTS && !post.hiddenAt;
  if (hide) {
    await db
      .update(circlePosts)
      .set({ hiddenAt: new Date(), hiddenReason: 'reports' })
      .where(eq(circlePosts.id, postId));
  }
  if (reason === 'worried' && post.authorId && !existing) {
    const [author] = await db
      .select({ locale: profiles.locale })
      .from(profiles)
      .where(eq(profiles.userId, post.authorId))
      .limit(1);
    const copy = WORRIED[author?.locale ?? 'en'] ?? (WORRIED.en as { title: string; body: string });
    // At most one such note a day; it never says who was worried or about which post.
    const since = new Date(Date.now() - 86_400_000);
    const [recent] = await db
      .select({ n: count() })
      .from(nudges)
      .where(
        and(
          eq(nudges.userId, post.authorId),
          eq(nudges.dedupeKey, 'circle-worried'),
          gte(nudges.createdAt, since),
        ),
      );
    if (!Number(recent?.n ?? 0)) {
      await db.insert(nudges).values({
        userId: post.authorId,
        module: 'circles',
        priority: 'high',
        title: copy.title,
        body: copy.body,
        href: '/support',
        dedupeKey: 'circle-worried',
        expiresAt: new Date(Date.now() + 3 * 86_400_000),
      });
    }
  }
  return { hidden: hide || Boolean(post.hiddenAt) };
}
