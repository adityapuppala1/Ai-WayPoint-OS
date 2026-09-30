/**
 * Services (Civic): practical checklists for life events, with official links per country,
 * and the person's progress through them.
 */
import { z } from '@hono/zod-openapi';
import {
  getChecklist,
  getCountry,
  getGovPortals,
  type LifeEvent,
  listLifeEvents,
  normalizeCountry,
} from '@waypoint/content';
import { and, type Database, eq, userChecklistItems, userChecklists } from '@waypoint/db';
import { notFound } from '../lib/problem';

export const LIFE_EVENTS = [
  'job-loss',
  'first-job',
  'moving-country',
  'moving-city',
  'new-baby',
  'bereavement',
  'retirement',
  'disability',
  'serious-illness',
  'starting-business',
  'disaster',
] as const satisfies readonly LifeEvent[];

export const ITEM_STATUSES = ['todo', 'done', 'skipped', 'not-applicable'] as const;

const SourceSchema = z.object({ url: z.string(), title: z.string(), checkedAt: z.string() });

export const ChecklistSchema = z
  .object({
    event: z.enum(LIFE_EVENTS),
    country: z.string(),
    localised: z.boolean(),
    title: z.string(),
    intro: z.string(),
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        detail: z.string(),
        urgency: z.enum(['now', 'this-week', 'this-month', 'later']),
        links: z.array(z.object({ label: z.string(), url: z.string() })),
        status: z.enum(ITEM_STATUSES),
      }),
    ),
    progress: z.object({ done: z.number().int(), total: z.number().int() }),
    sources: z.array(SourceSchema),
  })
  .openapi('Checklist');

export type ChecklistView = z.infer<typeof ChecklistSchema>;

export const CivicOverviewSchema = z
  .object({
    country: z.string().nullable(),
    countryName: z.string().nullable(),
    events: z.array(
      z.object({
        event: z.enum(LIFE_EVENTS),
        title: z.string(),
        localised: z.boolean(),
        started: z.boolean(),
      }),
    ),
    portals: z.array(
      z.object({
        name: z.string(),
        url: z.string(),
        what: z.string(),
        sources: z.array(SourceSchema),
      }),
    ),
  })
  .openapi('CivicOverview');

export type CivicOverview = z.infer<typeof CivicOverviewSchema>;

async function startedEvents(db: Database, userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await db
    .select({ event: userChecklists.event })
    .from(userChecklists)
    .where(eq(userChecklists.userId, userId));
  return new Set(rows.map((r) => r.event));
}

export async function civicOverview(
  db: Database,
  userId: string | null,
  country: string | null | undefined,
): Promise<CivicOverview> {
  const code = normalizeCountry(country) ?? null;
  const started = await startedEvents(db, userId);
  return {
    country: code,
    countryName: code ? (getCountry(code)?.name ?? null) : null,
    events: listLifeEvents().flatMap((event) => {
      const c = getChecklist(event, code);
      return c
        ? [
            {
              event: event as ChecklistView['event'],
              title: c.title,
              localised: c.country !== 'ZZ',
              started: started.has(event),
            },
          ]
        : [];
    }),
    portals: getGovPortals(code).map((p) => ({
      name: p.name,
      url: p.url,
      what: p.what,
      sources: p.sources,
    })),
  };
}

export async function checklistFor(
  db: Database,
  userId: string | null,
  event: LifeEvent,
  country: string | null | undefined,
): Promise<ChecklistView> {
  const code = normalizeCountry(country) ?? null;
  const def = getChecklist(event, code);
  if (!def) throw notFound('Checklist');
  const statuses = new Map<string, string>();
  if (userId) {
    const [list] = await db
      .select()
      .from(userChecklists)
      .where(
        and(
          eq(userChecklists.userId, userId),
          eq(userChecklists.event, event),
          eq(userChecklists.country, def.country),
        ),
      )
      .limit(1);
    if (list) {
      const items = await db
        .select()
        .from(userChecklistItems)
        .where(eq(userChecklistItems.checklistId, list.id));
      for (const i of items) statuses.set(i.itemId, i.status);
    }
  }
  const items = def.items.map((i) => {
    const status = statuses.get(i.id);
    return {
      id: i.id,
      title: i.title,
      detail: i.detail,
      urgency: i.urgency,
      links: i.links ?? [],
      status: ((ITEM_STATUSES as readonly string[]).includes(status ?? '')
        ? status
        : 'todo') as ChecklistView['items'][number]['status'],
    };
  });
  return {
    event: event as ChecklistView['event'],
    country: def.country,
    localised: def.country !== 'ZZ',
    title: def.title,
    intro: def.intro,
    items,
    progress: { done: items.filter((i) => i.status !== 'todo').length, total: items.length },
    sources: def.sources,
  };
}

export const ItemStatusSchema = z
  .object({
    status: z.enum(ITEM_STATUSES),
    country: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .optional(),
  })
  .openapi('ChecklistItemStatus');

export async function setItemStatus(
  db: Database,
  userId: string,
  event: LifeEvent,
  country: string | null | undefined,
  itemId: string,
  status: (typeof ITEM_STATUSES)[number],
): Promise<ChecklistView> {
  const code = normalizeCountry(country) ?? null;
  const def = getChecklist(event, code);
  if (!def?.items.some((i) => i.id === itemId)) throw notFound('Checklist item');
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(userChecklists)
      .where(
        and(
          eq(userChecklists.userId, userId),
          eq(userChecklists.event, event),
          eq(userChecklists.country, def.country),
        ),
      )
      .limit(1);
    const list =
      existing ??
      (
        await tx
          .insert(userChecklists)
          .values({ userId, event, country: def.country })
          .onConflictDoNothing()
          .returning()
      )[0];
    if (!list) throw notFound('Checklist');
    await tx
      .insert(userChecklistItems)
      .values({ checklistId: list.id, itemId, status })
      .onConflictDoUpdate({
        target: [userChecklistItems.checklistId, userChecklistItems.itemId],
        set: { status, updatedAt: new Date() },
      });
  });
  const view = await checklistFor(db, userId, event, code);
  const complete = view.progress.done === view.progress.total;
  await db
    .update(userChecklists)
    .set({ completedAt: complete ? new Date() : null })
    .where(
      and(
        eq(userChecklists.userId, userId),
        eq(userChecklists.event, event),
        eq(userChecklists.country, def.country),
      ),
    );
  return view;
}
