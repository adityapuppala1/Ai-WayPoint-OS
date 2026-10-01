/**
 * Conversations by SMS, WhatsApp and USSD. A number is looked up by a keyed hash; the
 * number itself is sealed, and nothing anyone texts is stored — only their language,
 * country, choices and, for safety, that a crisis reply was sent (never the words).
 */
import { channelAnswer, configuredProviders } from '@waypoint/ai';
import type { CountryCode } from '@waypoint/content';
import { CRISIS_RULES_VERSION, type Locale } from '@waypoint/core';
import {
  CHANNEL_COPY,
  type ChannelPerson,
  type ChannelReply,
  type ChannelSetup,
  channelReply,
  countryName,
  countryOfNumber,
  fitForChannel,
  toE164,
  ussdReply,
} from '@waypoint/core/channels';
import { getEnv } from '@waypoint/core/env';
import { sealWithKek } from '@waypoint/core/privacy';
import {
  and,
  channelIdentities,
  channelStats,
  crisisEvents,
  type Database,
  enqueueMessage,
  eq,
  sql,
} from '@waypoint/db';
import { toLocale } from '../email/render';
import { errorFields, log } from '../lib/log';
import { ApiError } from '../lib/problem';
import { keyedHash, rateLimit, withinLimit } from '../lib/request';
import { recordUse } from '../lib/usage';
import type { Provider, TextChannel } from './providers';

type ChannelName = TextChannel | 'ussd';
type Identity = typeof channelIdentities.$inferSelect;

/** Messages one number can send: 30 an hour and 200 a day; AI answers: 20 a day. */
const PER_HOUR = 30;
const PER_DAY = 200;
const AI_PER_DAY = 20;

export const addressHash = (e164: string) => keyedHash(e164, 'channel-address');

async function identityFor(
  db: Database,
  channel: ChannelName,
  e164: string,
): Promise<{ row: Identity; isNew: boolean }> {
  const hash = addressHash(e164);
  const find = async () =>
    (
      await db
        .select()
        .from(channelIdentities)
        .where(and(eq(channelIdentities.channel, channel), eq(channelIdentities.addressHash, hash)))
        .limit(1)
    )[0];
  const found = await find();
  if (found) {
    await db
      .update(channelIdentities)
      .set({ lastSeenAt: new Date() })
      .where(eq(channelIdentities.id, found.id));
    return { row: found, isNew: false };
  }
  const [created] = await db
    .insert(channelIdentities)
    .values({
      channel,
      addressHash: hash,
      addressCt: sealWithKek(e164, 'channel'),
      country: countryOfNumber(e164),
    })
    .onConflictDoNothing()
    .returning();
  if (created) return { row: created, isNew: true };
  const again = await find();
  if (!again) throw new Error('Could not record the number');
  return { row: again, isNew: false };
}

async function remember(db: Database, id: string, update: ChannelReply['update']) {
  if (!update) return;
  const set: Partial<typeof channelIdentities.$inferInsert> = {};
  if (update.locale) set.locale = update.locale;
  if (update.country) set.country = update.country;
  if (update.optedOut !== undefined) set.optedOutAt = update.optedOut ? new Date() : null;
  if (update.aiAllowed !== undefined) set.aiAllowedAt = update.aiAllowed ? new Date() : null;
  if (Object.keys(set).length)
    await db.update(channelIdentities).set(set).where(eq(channelIdentities.id, id));
}

/** Counts only: which channel, which way, what kind of message, per day. */
export async function countMessage(
  db: Database,
  channel: ChannelName,
  direction: 'in' | 'out',
  intent: string,
  n = 1,
): Promise<void> {
  if (n < 1) return;
  const day = new Date().toISOString().slice(0, 10);
  await db
    .insert(channelStats)
    .values({ day, channel, direction, intent: intent.slice(0, 32), n })
    .onConflictDoUpdate({
      target: [channelStats.day, channelStats.channel, channelStats.direction, channelStats.intent],
      set: { n: sql`${channelStats.n} + ${n}` },
    });
}

async function withinLimits(db: Database, id: string): Promise<boolean> {
  try {
    await rateLimit(db, `ch-hour:${id}`, { max: PER_HOUR, windowSeconds: 3600 });
    await rateLimit(db, `ch-day:${id}`, { max: PER_DAY, windowSeconds: 86_400 });
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) return false;
    throw err;
  }
}

/** One "please slow down" an hour, then silence: replies cost the sender. */
async function slowDownNotice(db: Database, id: string): Promise<boolean> {
  try {
    await rateLimit(db, `ch-slow:${id}`, { max: 1, windowSeconds: 3600 });
    return true;
  } catch {
    return false;
  }
}

function setupFor(channel: TextChannel): ChannelSetup {
  const providers = configuredProviders();
  return {
    channel,
    site: new URL(getEnv().WAYPOINT_URL).host,
    externalAi: providers.some((p) => !p.local),
    localAi: providers.some((p) => p.local),
  };
}

function person(row: Identity, isNew: boolean): ChannelPerson {
  return {
    locale: toLocale(row.locale),
    country: (row.country as CountryCode | null) ?? null,
    optedOut: Boolean(row.optedOutAt),
    aiAllowed: Boolean(row.aiAllowedAt),
    isNew,
  };
}

export async function queueText(
  db: Database,
  m: {
    channel: TextChannel;
    provider: Provider;
    e164: string;
    body: string;
    identityId: string;
    /** What kind of message, for the daily counts: a direct reply or an AI answer. */
    intent?: 'reply' | 'ai';
    /** A message sent later (not a direct reply) is not sent after STOP. */
    respectOptOut?: boolean;
  },
): Promise<void> {
  await enqueueMessage(db, {
    channel: m.channel,
    recipientRef: sealWithKek(m.e164, 'outbox'),
    payload: {
      template: 'text',
      intent: m.intent ?? 'reply',
      provider: m.provider,
      respectOptOut: Boolean(m.respectOptOut),
    },
    // The words are sealed while they wait, and dropped once sent.
    secret: { body: m.body },
  });
}

let dispatching: Promise<unknown> | null = null;
let again = false;
/** Send what is queued now rather than on the next minute's run. */
export function dispatchSoon(db: Database): void {
  if (dispatching) {
    again = true;
    return;
  }
  dispatching = import('../jobs')
    .then((jobs) => jobs.dispatchOutbox(db))
    .catch((err) => log.error('dispatch failed', errorFields(err)))
    .finally(() => {
      dispatching = null;
      if (again) {
        again = false;
        dispatchSoon(db);
      }
    });
}

/** For tests: resolves once any sending started by dispatchSoon has finished. */
export async function dispatchSettled(): Promise<void> {
  while (dispatching) await dispatching;
}

export interface TextResult {
  /** Replies to send straight back. */
  replies: string[];
  /** An AI answer to work out and send afterwards (the webhook should not wait for it). */
  later?: () => Promise<void>;
  e164?: string;
  identityId?: string;
}

/** Numbers Waypoint answers: from a country it has help lines for, or the operator's own list. */
export function servedNumber(e164: string): boolean {
  const country = countryOfNumber(e164);
  if (!country) return false;
  const only = getEnv().WAYPOINT_TEXT_COUNTRIES;
  if (!only) return true;
  return only
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .includes(country);
}

/**
 * The ceiling on answered texts for the whole service, so a flood from made-up senders cannot
 * run up the bill. Someone in danger draws on a separate allowance of the same size, which a
 * flood of ordinary messages cannot use up.
 */
async function serviceHasRoom(db: Database, crisis: boolean): Promise<boolean> {
  const env = getEnv();
  const name = crisis ? 'ch-out-crisis' : 'ch-out';
  const hour = await withinLimit(db, `${name}-hour`, {
    max: env.WAYPOINT_TEXT_REPLIES_PER_HOUR,
    windowSeconds: 3600,
  });
  const day = await withinLimit(db, `${name}-day`, {
    max: env.WAYPOINT_TEXT_REPLIES_PER_DAY,
    windowSeconds: 86_400,
  });
  if (!(hour && day) && (await withinLimit(db, `${name}-warned`, { max: 1, windowSeconds: 3600 })))
    log.warn('text replies paused: the ceiling for the whole service was reached', {
      crisis,
      perHour: env.WAYPOINT_TEXT_REPLIES_PER_HOUR,
      perDay: env.WAYPOINT_TEXT_REPLIES_PER_DAY,
    });
  return hour && day;
}

/** Replies to someone in danger past their number's limit: a few an hour, never unlimited. */
const CRISIS_PER_HOUR = 5;

/** Support cards an hour, and a day, for numbers from countries Waypoint does not serve. */
const UNSERVED_CRISIS_PER_HOUR = 20;
const UNSERVED_CRISIS_PER_DAY = 100;

export async function handleText(
  db: Database,
  input: {
    channel: TextChannel;
    provider: Provider;
    from: string;
    text: string | null;
    /** The provider's id for this message (MessageSid, wamid…), when it sends one. */
    messageId?: string;
  },
): Promise<TextResult> {
  const e164 = toE164(input.from);
  if (!e164) return { replies: [] };
  const seen = input.messageId
    ? `ch-seen:${keyedHash(`${input.provider}:${input.messageId}`, 'channel-message')}`
    : null;
  if (seen && !(await withinLimit(db, seen, { max: 1, windowSeconds: 86_400 })))
    return { replies: [] };
  try {
    return await answerText(db, input, e164);
  } catch (err) {
    // The message was not answered: when the provider delivers it again, that is not a
    // repeat to ignore (the person may be in danger and has heard nothing yet).
    if (seen)
      await db
        .execute(sql`delete from rate_limits where key = ${`api:${seen}`}`)
        .catch(() => undefined);
    throw err;
  }
}

async function answerText(
  db: Database,
  input: { channel: TextChannel; provider: Provider; text: string | null },
  e164: string,
): Promise<TextResult> {
  const text = input.text === null ? null : input.text.slice(0, 1600);

  const served = servedNumber(e164);
  if (!served) {
    // A number from somewhere Waypoint does not serve is not recorded and not answered —
    // unless the person is in danger: then they get the support card with global directories.
    await countMessage(db, input.channel, 'in', 'unserved').catch(() => undefined);
    if (text === null) return { replies: [] };
    const stranger: ChannelPerson = {
      locale: null,
      country: null,
      optedOut: false,
      aiAllowed: false,
      isNew: true,
    };
    const danger = channelReply(text, stranger, {
      ...setupFor(input.channel),
      externalAi: false,
      localAi: false,
    });
    if (!danger.crisis || danger.crisis.assessment.tier < 2) return { replies: [] };
    // A small allowance of its own: made-up senders from anywhere in the world cannot make
    // Waypoint send without end, or use up what is kept for people in the countries it serves.
    const room =
      (await withinLimit(db, 'ch-out-unserved-hour', {
        max: UNSERVED_CRISIS_PER_HOUR,
        windowSeconds: 3600,
      })) &&
      (await withinLimit(db, 'ch-out-unserved-day', {
        max: UNSERVED_CRISIS_PER_DAY,
        windowSeconds: 86_400,
      }));
    if (!room) return { replies: [] };
  }

  const { row, isNew } = await identityFor(db, input.channel, e164);
  const who = person(row, isNew);
  // A number linked to an account: that person used Waypoint today, by text (nothing else).
  if (row.userId) recordUse({ userId: row.userId, platform: 'text' });
  const copy = CHANNEL_COPY[who.locale ?? 'en'];
  const limited = !(await withinLimits(db, row.id));
  const slowDown = async (): Promise<TextResult> => ({
    // Someone who asked for no more messages gets none, not even "please slow down".
    replies:
      !who.optedOut && (await slowDownNotice(db, row.id)) && (await serviceHasRoom(db, false))
        ? [fitForChannel(copy.slowDown, input.channel)]
        : [],
    e164,
    identityId: row.id,
  });
  if (text === null) {
    if (limited) return slowDown();
    // A voice note, photo or sticker: say what can be read.
    await countMessage(db, input.channel, 'in', 'unreadable').catch(() => undefined);
    return {
      replies: (await serviceHasRoom(db, false)) ? [fitForChannel(copy.menu, input.channel)] : [],
      e164,
      identityId: row.id,
    };
  }

  // Safety is decided before any limit: a number over its limit (or one somebody else flooded)
  // still gets the support card, from a small allowance of its own.
  const reply = channelReply(text, who, setupFor(input.channel));
  // That someone was in danger is recorded (tier and rule ids, never the words) whether or
  // not a reply can still be sent.
  if (reply.crisis) {
    const { assessment, plan } = reply.crisis;
    await db.insert(crisisEvents).values({
      userId: row.userId,
      channel: input.channel,
      tier: assessment.tier,
      categories: assessment.categories,
      ruleIds: assessment.matched,
      rulesVersion: CRISIS_RULES_VERSION,
      language: assessment.language,
      country: row.country,
      aboutOther: assessment.aboutOther,
      actionKinds: plan.actions.map((a) => a.kind),
    });
  }
  if (limited) {
    // STOP and START are always taken, however many messages came before them.
    if (reply.intent === 'stop' || reply.intent === 'start') {
      await remember(db, row.id, reply.update);
      return { replies: [], e164, identityId: row.id };
    }
    const mayAnswer =
      reply.crisis &&
      (await withinLimit(db, `ch-crisis:${row.id}`, { max: CRISIS_PER_HOUR, windowSeconds: 3600 }));
    if (!mayAnswer) return slowDown();
    reply.ask = undefined;
  }
  // The allowance for unserved numbers was drawn on above; everyone else draws on the
  // ceiling for the whole service (people in danger on their own part of it).
  if (served && reply.messages.length > 0 && !(await serviceHasRoom(db, Boolean(reply.crisis)))) {
    await countMessage(db, input.channel, 'in', 'capped').catch(() => undefined);
    // STOP and the person's other choices are still remembered; nothing is sent.
    await remember(db, row.id, reply.update);
    return { replies: [], e164, identityId: row.id };
  }
  await remember(db, row.id, reply.update);
  await countMessage(db, input.channel, 'in', reply.intent).catch(() => undefined);

  const ask = served ? reply.ask : undefined;
  const country = reply.update?.country ?? who.country;
  return {
    replies: reply.messages,
    e164,
    identityId: row.id,
    later: ask
      ? async () => {
          const body = await aiAnswer(db, {
            channel: input.channel,
            identityId: row.id,
            text: ask.text,
            safe: ask.safe,
            external: ask.external,
            locale: reply.locale,
            country,
          });
          await queueText(db, {
            channel: input.channel,
            provider: input.provider,
            e164,
            body: body.text,
            identityId: row.id,
            intent: body.ai ? 'ai' : 'reply',
            respectOptOut: true,
          });
          dispatchSoon(db);
        }
      : undefined,
  };
}

/** The AI's answer, labelled as AI — or the simple answer when no model can reply. */
async function aiAnswer(
  db: Database,
  q: {
    channel: TextChannel;
    identityId: string;
    text: string;
    safe: boolean;
    external: boolean;
    locale: Locale;
    country: CountryCode | null;
  },
): Promise<{ text: string; ai: boolean }> {
  const copy = CHANNEL_COPY[q.locale];
  const guided = {
    text: fitForChannel(
      copy.guided.replace('{site}', new URL(getEnv().WAYPOINT_URL).host),
      q.channel,
    ),
    ai: false,
  };
  try {
    await rateLimit(db, `ch-ai:${q.identityId}`, { max: AI_PER_DAY, windowSeconds: 86_400 });
  } catch {
    return guided;
  }
  // Nothing comes back when no model can reply, and also when the judge (if one is set up, the
  // person texted AI YES and their language is switched on for it) finds the answer gives a
  // diagnosis or a dose, says what a court will decide, picks a financial product, promises
  // an outcome or describes a method of self-harm. Either way the guided text is sent.
  const answer = await channelAnswer(
    { db, isGuest: true, allowExternal: q.external },
    {
      text: q.text,
      locale: q.locale,
      countryName: q.country ? countryName(q.country, q.locale) : null,
      maxChars: q.channel === 'whatsapp' ? 900 : 400,
      safe: q.safe,
    },
  ).catch((err) => {
    log.warn('channel answer failed', errorFields(err));
    return null;
  });
  return answer
    ? { text: fitForChannel(`${copy.aiPrefix}${answer}`, q.channel), ai: true }
    : guided;
}

export async function handleUssd(
  db: Database,
  input: { phoneNumber: string; text: string },
): Promise<string> {
  const e164 = toE164(input.phoneNumber);
  if (!e164) return 'END Waypoint';
  const { row } = await identityFor(db, 'ussd', e164);
  const locale = toLocale(row.locale) ?? 'en';
  try {
    await rateLimit(db, `ch-ussd:${row.id}`, { max: 60, windowSeconds: 3600 });
  } catch {
    return `END ${CHANNEL_COPY[locale].slowDown}`;
  }
  const reply = ussdReply(input.text ?? '', {
    locale: toLocale(row.locale),
    country: (row.country as CountryCode | null) ?? null,
  });
  if (reply.update) await remember(db, row.id, reply.update);
  await countMessage(db, 'ussd', 'in', reply.intent).catch(() => undefined);
  return `${reply.end ? 'END' : 'CON'} ${reply.text}`;
}

/** Whether a number stopped messages on a channel (checked before sending anything later). */
export async function stoppedMessages(
  db: Database,
  channel: TextChannel,
  e164: string,
): Promise<boolean> {
  const [row] = await db
    .select({ optedOutAt: channelIdentities.optedOutAt })
    .from(channelIdentities)
    .where(
      and(
        eq(channelIdentities.channel, channel),
        eq(channelIdentities.addressHash, addressHash(e164)),
      ),
    )
    .limit(1);
  return Boolean(row?.optedOutAt);
}
