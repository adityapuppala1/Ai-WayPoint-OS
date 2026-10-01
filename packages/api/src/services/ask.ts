/**
 * Ask: conversation storage around the companion in @waypoint/ai.
 *
 * The browser sends only its newest message; history comes from the database, so a client
 * cannot rewrite what the assistant said. The one exception is a tool approval: the person's
 * yes/no is copied onto the stored assistant message, and the server re-checks the approval
 * signature before any tool runs.
 */
import { z } from '@hono/zod-openapi';
import { type AskUIMessage, askResponse } from '@waypoint/ai';
import { assessCrisis, MODULE_IDS } from '@waypoint/core';
import { newId } from '@waypoint/core/ids';
import { openFor, redactPII, SEALED } from '@waypoint/core/privacy';
import {
  and,
  asc,
  circleMembers,
  conversations,
  count,
  type Database,
  desc,
  eq,
  goals,
  isNull,
  memories,
  messages,
  sql,
  trustedContacts,
} from '@waypoint/db';
import { validateUIMessages } from 'ai';
import { badRequest, conflict, notFound } from '../lib/problem';
import type { Consents } from '../types';
import { helpCountry, type Profile, userDek } from './me';
import { activePlanWithNextStep } from './path';
import { type Channel, recordCrisis } from './safety';

export const AskRequestSchema = z
  .object({
    /** Conversation id, created by the client (UUID). */
    id: z.uuid(),
    message: z
      .record(z.string(), z.unknown())
      .openapi({ description: 'The newest AI SDK UI message' }),
    module: z.enum(MODULE_IDS).optional(),
  })
  .openapi('AskRequest');

export const ConversationSummarySchema = z
  .object({
    id: z.string(),
    title: z.string().nullable(),
    module: z.string(),
    updatedAt: z.string(),
  })
  .openapi('ConversationSummary');

export const ConversationSchema = z
  .object({
    id: z.string(),
    title: z.string().nullable(),
    module: z.string(),
    messages: z.array(z.record(z.string(), z.unknown())),
  })
  .openapi('Conversation');

export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type Conversation = z.infer<typeof ConversationSchema>;

const MAX_USER_TEXT = 4000;
const HISTORY_LIMIT = 40;

function textOf(m: AskUIMessage): string {
  return m.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join(' ')
    .trim();
}

async function ownedConversation(db: Database, userId: string, id: string) {
  const [c] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (c && c.userId !== userId) throw notFound('Conversation');
  return c ?? null;
}

async function loadHistory(db: Database, conversationId: string): Promise<AskUIMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY_LIMIT);
  return rows.reverse().map((r) => ({
    id: r.id,
    role: r.role as AskUIMessage['role'],
    parts: r.parts as AskUIMessage['parts'],
    metadata: { createdAt: r.createdAt.toISOString() },
  }));
}

type ToolPart = {
  type: string;
  toolCallId?: string;
  state?: string;
  approval?: { id: string; approved?: boolean; reason?: string };
};

/** Copy only approval decisions from the client's copy of an assistant message. */
function applyApprovals(stored: AskUIMessage, incoming: AskUIMessage): AskUIMessage {
  const decisions = new Map<string, { approved: boolean; reason?: string }>();
  for (const p of incoming.parts as ToolPart[]) {
    if (
      p.toolCallId &&
      p.state === 'approval-responded' &&
      typeof p.approval?.approved === 'boolean'
    ) {
      decisions.set(p.toolCallId, {
        approved: p.approval.approved,
        reason: p.approval.reason?.slice(0, 200),
      });
    }
  }
  if (!decisions.size) throw badRequest('Nothing to update in that message.');
  let answered = 0;
  const parts = stored.parts.map((part) => {
    const p = part as ToolPart;
    const d = p.toolCallId ? decisions.get(p.toolCallId) : undefined;
    if (!d || p.state !== 'approval-requested' || !p.approval) return part;
    answered += 1;
    return {
      ...part,
      state: 'approval-responded',
      approval: { ...p.approval, approved: d.approved, reason: d.reason },
    } as typeof part;
  });
  // Nothing was waiting for an answer: it was given already.
  if (!answered) throw conflict('That was already answered.');
  return { ...stored, parts };
}

async function contextFor(db: Database, userId: string, consents: Consents) {
  const [goalRows, active, memoryRows, [contacts], [circles]] = await Promise.all([
    db
      .select({ id: goals.id, titleCt: goals.titleCt })
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.status, 'active')))
      .orderBy(desc(goals.createdAt))
      .limit(5),
    activePlanWithNextStep(db, userId),
    consents.memory
      ? db
          .select({ id: memories.id, content: memories.content, contentCt: memories.contentCt })
          .from(memories)
          .where(and(eq(memories.userId, userId), eq(memories.sensitive, false)))
          .orderBy(desc(memories.createdAt))
          .limit(20)
      : Promise.resolve(
          [] as Array<{ id: string; content: string | null; contentCt: string | null }>,
        ),
    db.select({ n: count() }).from(trustedContacts).where(eq(trustedContacts.userId, userId)),
    db.select({ n: count() }).from(circleMembers).where(eq(circleMembers.userId, userId)),
  ]);
  const dek =
    goalRows.length || memoryRows.some((m) => m.contentCt) ? await userDek(db, userId) : null;
  return {
    goals: dek ? goalRows.map((g) => openFor(dek, g.titleCt, SEALED.goal, userId, g.id)) : [],
    currentPlan: active
      ? `${active.plan.title}${active.next ? ` — next step: ${active.next.title}` : ''} (${active.plan.progress.done}/${active.plan.progress.total} steps done)`
      : null,
    // Memories are sealed like goals; ones saved before that are still read as they are.
    memories: memoryRows
      .map((m) =>
        m.contentCt && dek ? openFor(dek, m.contentCt, SEALED.memory, userId, m.id) : m.content,
      )
      .filter((c): c is string => Boolean(c)),
    hasTrustedContact: Number(contacts?.n ?? 0) > 0 && consents.trusted_contact,
    inCircle: Number(circles?.n ?? 0) > 0,
  };
}

async function saveMessages(
  db: Database,
  conversationId: string,
  list: AskUIMessage[],
  meta: { model?: string },
): Promise<void> {
  for (const m of list) {
    const tier = m.role === 'user' ? assessCrisis(textOf(m)).tier : 0;
    await db
      .insert(messages)
      .values({
        id: m.id,
        conversationId,
        role: m.role,
        parts: m.parts,
        crisisTier: tier,
        model: m.role === 'assistant' ? (meta.model ?? null) : null,
      })
      .onConflictDoUpdate({
        target: messages.id,
        set: { parts: m.parts },
        // Never touch a row that belongs to another conversation.
        setWhere: eq(messages.conversationId, conversationId),
      });
  }
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

export async function handleAsk(
  db: Database,
  who: { userId: string; isGuest: boolean },
  profile: Profile,
  consents: Consents,
  body: z.infer<typeof AskRequestSchema>,
  opts: {
    abortSignal?: AbortSignal;
    channel?: Channel;
    /** See AskInput.aiGate: a visitor's daily allowance of AI answers. */
    aiGate?: () => Promise<boolean>;
  } = {},
): Promise<Response> {
  const [incoming] = await validateUIMessages<AskUIMessage>({ messages: [body.message] }).catch(
    () => {
      throw badRequest('That message could not be read.');
    },
  );
  if (!incoming) throw badRequest('No message.');

  let convo = await ownedConversation(db, who.userId, body.id);
  const history = convo ? await loadHistory(db, convo.id) : [];

  let next: AskUIMessage[];
  let toSave: AskUIMessage[];
  const existingIndex = history.findIndex((m) => m.id === incoming.id);
  if (existingIndex >= 0) {
    const stored = history[existingIndex];
    if (stored?.role !== 'assistant' || existingIndex !== history.length - 1) {
      throw badRequest('Only the latest reply can be updated.');
    }
    const updated = applyApprovals(stored, incoming);
    // The yes or no is recorded once: only if the stored message is still exactly as it was
    // read. A second copy of the same answer (two taps, a retry after a dropped connection)
    // finds it already recorded and stops here, so what was approved is never done twice.
    const recorded = await db
      .update(messages)
      .set({ parts: updated.parts })
      .where(
        and(
          eq(messages.id, stored.id),
          eq(messages.conversationId, convo?.id ?? body.id),
          sql`${messages.parts} = ${JSON.stringify(stored.parts)}::jsonb`,
        ),
      )
      .returning({ id: messages.id });
    if (!recorded.length) throw conflict('That was already answered.');
    next = [...history.slice(0, -1), updated];
    toSave = [];
  } else {
    if (incoming.role !== 'user') throw badRequest('Only your own messages can be sent.');
    const text = textOf(incoming);
    if (!text) throw badRequest('Type a message first.');
    if (text.length > MAX_USER_TEXT)
      throw badRequest(`Messages can be up to ${MAX_USER_TEXT} characters.`);
    const userMessage: AskUIMessage = {
      id: newId(),
      role: 'user',
      parts: [{ type: 'text', text }],
      metadata: { createdAt: new Date().toISOString() },
    };
    if (!convo) {
      const [created] = await db
        .insert(conversations)
        .values({
          id: body.id,
          userId: who.userId,
          module: body.module ?? 'ask',
          title: redactPII(text).text.replace(/\s+/g, ' ').slice(0, 60),
        })
        .onConflictDoNothing()
        .returning();
      if (!created) throw notFound('Conversation');
      convo = created;
    }
    next = [...history, userMessage];
    toSave = [userMessage];
  }
  if (!convo) throw notFound('Conversation');
  const conversationId = convo.id;
  await saveMessages(db, conversationId, toSave, {});

  const context = await contextFor(db, who.userId, consents);
  return askResponse({
    db,
    user: { id: who.userId, isGuest: who.isGuest },
    profile: {
      locale: profile.locale,
      country: helpCountry(profile),
      situation: consents.personalization ? profile.situation : null,
      lifeStage: consents.personalization ? profile.lifeStage : null,
    },
    consents: { aiExternal: consents.ai_external, memory: consents.memory },
    context: consents.personalization
      ? context
      : { hasTrustedContact: context.hasTrustedContact, inCircle: context.inCircle },
    messages: next,
    abortSignal: opts.abortSignal,
    aiGate: opts.aiGate,
    onCrisis: async (assessment, plan) => {
      await recordCrisis(db, {
        userId: who.userId,
        channel: opts.channel ?? 'web',
        country: helpCountry(profile),
        assessment,
        plan,
      });
    },
    onFinish: async (final, meta) => {
      const last = final.at(-1);
      if (last && last.role === 'assistant')
        await saveMessages(db, conversationId, [last], { model: meta.model });
    },
  });
}

export async function listConversations(db: Database, userId: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), isNull(conversations.archivedAt)))
    .orderBy(desc(conversations.updatedAt))
    .limit(30);
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    module: c.module,
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export async function getConversation(db: Database, userId: string, id: string) {
  const c = await ownedConversation(db, userId, id);
  if (!c) throw notFound('Conversation');
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .limit(200);
  return {
    id: c.id,
    title: c.title,
    module: c.module,
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      parts: r.parts,
      metadata: { createdAt: r.createdAt.toISOString() },
    })),
  };
}

export async function deleteConversation(db: Database, userId: string, id: string): Promise<void> {
  const res = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  if (!res.length) throw notFound('Conversation');
}

export async function deleteAllConversations(db: Database, userId: string): Promise<number> {
  const res = await db
    .delete(conversations)
    .where(eq(conversations.userId, userId))
    .returning({ id: conversations.id });
  return res.length;
}
