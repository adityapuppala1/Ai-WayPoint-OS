/**
 * Background work. Runs inside the web server for the embedded database (one process), or
 * in apps/worker for Postgres deployments. Every task is idempotent and safe to repeat.
 *
 *  - Gentle follow-ups after a crisis moment (in the person's language, never the words they used)
 *  - Nudge delivery through the attention governor (budget, quiet hours, dedupe)
 *  - Conversation retention and stale guest clean-up
 *  - Sending queued email, SMS and WhatsApp messages
 */
import {
  type AttentionPrefs,
  LOCALES,
  type Locale,
  localDayKey,
  type Nudge,
  nextOccurrence,
  parseSchedule,
  planDelivery,
  quietHoursEnd,
  UNCONFIRMED_ACCOUNT_DAYS,
} from '@waypoint/core';
import { otpText } from '@waypoint/core/channels';
import { getEnv } from '@waypoint/core/env';
import { getKeyring, openWithKek, rewrapIfNeeded, sealWithKek } from '@waypoint/core/privacy';
import {
  and,
  asc,
  type ClaimedMessage,
  cancelOutbox,
  channelIdentities,
  claimOutbox,
  crisisEvents,
  type Database,
  eq,
  gte,
  inArray,
  integrationSettings,
  isNotNull,
  lte,
  markOutbox,
  ne,
  nudges,
  onMessageQueued,
  openOutboxPayload,
  profiles,
  reminders,
  sql,
} from '@waypoint/db';
import { isProvider, outboundFetch, senderFor, sendText } from '../channels/providers';
import { countMessage, stoppedMessages } from '../channels/service';
import { isEmailTemplate, renderEmail, toLocale } from '../email/render';
import { emailReady, sendEmail } from '../email/send';
import { errorFields, log } from '../lib/log';
import { takeWeeklySnapshots } from '../services/org';

const FOLLOW_UP: Record<Locale, { title: string; body: string }> = {
  en: {
    title: 'Checking in on you',
    body: 'Last time we talked, things were hard. How are you doing now? If you need it, support is one tap away.',
  },
  hi: {
    title: 'आपका हाल जानना चाहते थे',
    body: 'पिछली बार बात करते समय चीज़ें मुश्किल थीं। अब आप कैसे हैं? ज़रूरत हो तो मदद बस एक टैप दूर है।',
  },
  es: {
    title: 'Queríamos saber cómo estás',
    body: 'La última vez que hablamos, las cosas estaban difíciles. ¿Cómo estás ahora? Si lo necesitas, la ayuda está a un toque.',
  },
  fr: {
    title: 'Nous prenons de vos nouvelles',
    body: 'La dernière fois, les choses étaient difficiles. Comment allez-vous maintenant ? Si besoin, l’aide est à portée de main.',
  },
  pt: {
    title: 'Queríamos saber como você está',
    body: 'Da última vez que conversamos, as coisas estavam difíceis. Como você está agora? Se precisar, a ajuda está a um toque.',
  },
  ar: {
    title: 'نطمئن عليك',
    body: 'في المرة الماضية كانت الأمور صعبة. كيف حالك الآن؟ إذا احتجت، المساعدة على بُعد لمسة واحدة.',
  },
  sw: {
    title: 'Tunakujulia hali',
    body: 'Mara ya mwisho tulipozungumza, mambo yalikuwa magumu. Unaendeleaje sasa? Ukihitaji, msaada uko karibu kwa mguso mmoja.',
  },
};

/** Turn due crisis follow-ups into gentle, high-priority in-app check-ins. */
export async function crisisFollowUps(db: Database, now = new Date()): Promise<number> {
  const due = await db
    .select({ id: crisisEvents.id, userId: crisisEvents.userId, language: crisisEvents.language })
    .from(crisisEvents)
    .where(
      and(
        eq(crisisEvents.followUpStatus, 'scheduled'),
        lte(crisisEvents.followUpAt, now),
        isNotNull(crisisEvents.userId),
      ),
    )
    // Oldest first, so a backlog never leaves the same people waiting round after round.
    .orderBy(asc(crisisEvents.followUpAt))
    .limit(100);
  let created = 0;
  for (const e of due) {
    if (!e.userId) continue;
    const [p] = await db
      .select({
        locale: profiles.locale,
        timezone: profiles.timezone,
        quietStart: profiles.quietStart,
        quietEnd: profiles.quietEnd,
      })
      .from(profiles)
      .where(eq(profiles.userId, e.userId))
      .limit(1);
    const locale = (LOCALES as readonly string[]).includes(p?.locale ?? '')
      ? (p?.locale as Locale)
      : 'en';
    const copy = FOLLOW_UP[locale];
    // One row that cannot be handled must not hold up everyone behind it, round after round.
    try {
      await db.transaction(async (tx) => {
        await tx.insert(nudges).values({
          userId: e.userId as string,
          module: 'today',
          // Safety-critical: it is not held back by the daily budget (someone who asked for no
          // other messages still gets this one) — but it waits for their quiet hours to end.
          priority: 'critical',
          title: copy.title,
          body: copy.body,
          href: '/support',
          dedupeKey: 'crisis-follow-up',
          deliverAfter: quietHoursEnd(now, {
            timezone: p?.timezone ?? 'UTC',
            quietHours:
              p?.quietStart && p?.quietEnd ? { start: p.quietStart, end: p.quietEnd } : undefined,
          }),
          expiresAt: new Date(now.getTime() + 3 * 86_400_000),
        });
        await tx
          .update(crisisEvents)
          .set({ followUpStatus: 'sent' })
          .where(eq(crisisEvents.id, e.id));
      });
      created += 1;
    } catch (err) {
      log.error('check-in not created for one person', errorFields(err));
    }
  }
  return created;
}

/** Shown when a reminder is due. Today replaces the title with the person's own (encrypted) words. */
const REMINDER_DUE: Record<Locale, { title: string; body: string }> = {
  en: { title: 'Reminder', body: 'Something you asked Waypoint to remind you about.' },
  hi: { title: 'रिमाइंडर', body: 'जिसकी याद दिलाने के लिए आपने Waypoint से कहा था।' },
  es: { title: 'Recordatorio', body: 'Algo que le pediste a Waypoint que te recordara.' },
  fr: { title: 'Rappel', body: 'Quelque chose que vous avez demandé à Waypoint de vous rappeler.' },
  pt: { title: 'Lembrete', body: 'Algo que você pediu ao Waypoint para lembrar.' },
  ar: { title: 'تذكير', body: 'شيء طلبت من Waypoint أن يذكّرك به.' },
  sw: { title: 'Kikumbusho', body: 'Jambo ulilomwomba Waypoint akukumbushe.' },
};

/**
 * Turn due reminders into notes on Today, then schedule the next one. People chose these times
 * themselves, so they are delivered straight away rather than competing for attention.
 */
export async function dueReminders(db: Database, now = new Date()): Promise<number> {
  const due = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.enabled, true), lte(reminders.nextAt, now)))
    .orderBy(asc(reminders.nextAt))
    .limit(200);
  let created = 0;
  for (const r of due) {
    if (!r.nextAt) continue;
    const [p] = await db
      .select({ locale: profiles.locale, timezone: profiles.timezone })
      .from(profiles)
      .where(eq(profiles.userId, r.userId))
      .limit(1);
    const locale = (LOCALES as readonly string[]).includes(p?.locale ?? '')
      ? (p?.locale as Locale)
      : 'en';
    const copy = REMINDER_DUE[locale];
    const schedule = parseSchedule(r.rrule);
    const next = schedule ? nextOccurrence(schedule, now, p?.timezone ?? 'UTC') : null;
    const dueAt = r.nextAt;
    await db.transaction(async (tx) => {
      await tx.insert(nudges).values({
        userId: r.userId,
        module: r.module,
        priority: 'high',
        title: copy.title,
        body: copy.body,
        href: r.module === 'health' ? '/health#reminders' : null,
        dedupeKey: `reminder:${r.id}:${dueAt.toISOString()}`,
        status: 'delivered',
        deliveredAt: now,
        expiresAt: new Date(now.getTime() + 2 * 86_400_000),
      });
      await tx
        .update(reminders)
        .set({ nextAt: next, enabled: next !== null })
        .where(eq(reminders.id, r.id));
    });
    created += 1;
  }
  return created;
}

/** Decide which pending nudges to show now, per person, using the attention governor. */
export async function deliverNudges(
  db: Database,
  now = new Date(),
): Promise<{ delivered: number; deferred: number; dropped: number }> {
  const pending = await db
    .select()
    .from(nudges)
    .where(
      and(
        inArray(nudges.status, ['pending', 'deferred']),
        sql`(${nudges.deliverAfter} is null or ${nudges.deliverAfter} <= ${now})`,
      ),
    )
    .orderBy(asc(nudges.createdAt))
    .limit(500);
  const byUser = new Map<string, typeof pending>();
  for (const n of pending) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n]);

  let delivered = 0;
  let deferred = 0;
  let dropped = 0;
  for (const [userId, list] of byUser) {
    // One person's broken settings or data must never stop everyone else's messages.
    try {
      const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
      const prefs: AttentionPrefs = {
        budgetPerDay: Math.max(
          0,
          Math.min(3, p?.attentionBudget ?? 1),
        ) as AttentionPrefs['budgetPerDay'],
        quietHours:
          p?.quietStart && p?.quietEnd ? { start: p.quietStart, end: p.quietEnd } : undefined,
        timezone: p?.timezone ?? 'UTC',
      };
      // Counted here rather than in SQL: the database and JavaScript do not agree on every
      // time zone value, and the governor's own reading of the person's day is the one that counts.
      const today = localDayKey(now, prefs.timezone);
      const recent = await db
        .select({ at: nudges.deliveredAt })
        .from(nudges)
        .where(
          and(
            eq(nudges.userId, userId),
            gte(nudges.deliveredAt, new Date(now.getTime() - 36 * 3_600_000)),
            // Critical messages never count against the budget.
            ne(nudges.priority, 'critical'),
          ),
        );
      const deliveredToday = recent.filter(
        (r) => r.at && localDayKey(r.at, prefs.timezone) === today,
      ).length;
      const plan = planDelivery(
        list.map(
          (n): Nudge => ({
            id: n.id,
            module: n.module as Nudge['module'],
            priority: n.priority as Nudge['priority'],
            title: n.title,
            body: n.body ?? undefined,
            href: n.href ?? undefined,
            createdAt: n.createdAt,
            expiresAt: n.expiresAt ?? undefined,
            dedupeKey: n.dedupeKey ?? undefined,
          }),
        ),
        prefs,
        { now, deliveredToday },
      );
      if (plan.deliverNow.length) {
        await db
          .update(nudges)
          .set({ status: 'delivered', deliveredAt: now })
          .where(
            inArray(
              nudges.id,
              plan.deliverNow.map((n) => n.id),
            ),
          );
        delivered += plan.deliverNow.length;
      }
      if (plan.defer.length) {
        await db
          .update(nudges)
          .set({ status: 'deferred', deliverAfter: new Date(now.getTime() + 30 * 60_000) })
          .where(
            inArray(
              nudges.id,
              plan.defer.map((n) => n.id),
            ),
          );
        deferred += plan.defer.length;
      }
      if (plan.drop.length) {
        await db
          .update(nudges)
          .set({ status: 'dropped' })
          .where(
            inArray(
              nudges.id,
              plan.drop.map((n) => n.id),
            ),
          );
        dropped += plan.drop.length;
      }
    } catch (err) {
      log.error('nudges not delivered for one person', errorFields(err));
    }
  }
  return { delivered, deferred, dropped };
}

/**
 * Delete conversations older than each person's retention choice, long-idle guest accounts and
 * accounts that were never confirmed, recount circle seats (a count can drift if rows are
 * removed outside the app) and drop rate-limit counters nobody needs any more.
 */
export async function retention(db: Database): Promise<{
  conversations: number;
  guests: number;
  unconfirmed: number;
  circles: number;
  limits: number;
  messages: number;
  numbers: number;
  stats: number;
  codes: number;
  safety: number;
  /** The API's own counts (90 days) and server errors (30 days) past their time. */
  health: number;
  /** Key rotation: what was re-wrapped this run, and what is still under an older key. */
  keys: { dataKeys: number; numbers: number; unreadable: number; remaining: number };
}> {
  const convos = await db.execute<{ id: string }>(sql`
    delete from conversations c
    using profiles p
    where c.user_id = p.user_id
      and p.conversation_retention_days is not null
      and c.updated_at < now() - make_interval(days => p.conversation_retention_days)
    returning c.id`);
  // Guests who have not been seen for 180 days: their data goes with them (cascade). Their
  // circle posts go too, with the replies they received, as when anyone deletes an account.
  const idleGuests = sql`
    select u.id from users u
    where u.is_anonymous = true
      and u.updated_at < now() - interval '180 days'
      and not exists (select 1 from sessions s where s.user_id = u.id and s.expires_at > now())`;
  await db.execute(sql`
    delete from circle_posts
    where author_id in (${idleGuests})
      or parent_id in (select p.id from circle_posts p where p.author_id in (${idleGuests}))`);
  const guests = await db.execute<{ id: string }>(sql`
    delete from users where id in (${idleGuests})
    returning id`);
  // Accounts whose address was never confirmed can never have been signed in to: after a
  // week they go (the confirmation email says so), leaving the address free for its owner.
  const unconfirmed = await db.execute<{ id: string }>(sql`
    delete from users u
    where coalesce(u.is_anonymous, false) = false
      and u.email_verified = false
      and u.email not like '%.invalid'
      and u.created_at < now() - make_interval(days => ${UNCONFIRMED_ACCOUNT_DAYS})
      and not exists (select 1 from sessions s where s.user_id = u.id)
      and not exists (
        select 1 from profiles p where p.user_id = u.id and p.onboarded_at is not null)
    returning u.id`);
  // Every limit window is a day or shorter.
  const limits = await db.execute<{ id: string }>(sql`
    delete from rate_limits where last_request < ${Date.now() - 2 * 86_400_000}
    returning id`);
  // A finished message keeps only its kind (see markOutbox); the row itself goes after a
  // week once sent, or a month when it could not be sent, so staff can see what went wrong.
  const messages = await db.execute<{ id: string }>(sql`
    delete from outbox
    where (status = 'sent' and coalesce(sent_at, created_at) < now() - interval '7 days')
       or (status in ('failed', 'cancelled') and created_at < now() - interval '30 days')
    returning id`);
  // Numbers that texted but never linked an account are forgotten after 180 quiet days,
  // with their language, country and choices. Waypoint only ever answers, so a number that
  // writes again later simply starts afresh.
  const numbers = await db.execute<{ id: string }>(sql`
    delete from channel_identities
    where user_id is null and last_seen_at < now() - interval '180 days'
    returning id`);
  await db.execute(sql`delete from channel_sessions where expires_at < now()`);
  // Daily counts (no numbers, no words) are kept for 13 months, to compare a year on year.
  const stats = await db.execute<{ day: string }>(sql`
    delete from channel_stats where day < current_date - 400
    returning day`);
  // Sign-in codes and one-time links that have expired serve no purpose, and the auth library
  // never removes them itself (a code row names the phone number it was sent to).
  const codes = await db.execute<{ id: string }>(sql`
    delete from verifications where expires_at < now() - interval '1 day'
    returning id`);
  // Safety records of numbers that never linked an account (tier and rule ids only) go when
  // the number itself is forgotten: after 180 days.
  const safety = await db.execute<{ id: string }>(sql`
    delete from crisis_events
    where user_id is null and created_at < now() - interval '180 days'
    returning id`);
  const healthCounts = await db.execute<{ n: number }>(sql`
    with gone as (
      delete from api_metrics where bucket < now() - interval '90 days' returning 1
    ), errors as (
      delete from api_errors where created_at < now() - interval '30 days' returning 1
    )
    select (select count(*) from gone)::int + (select count(*) from errors)::int as n`);
  const recounted = await db.execute<{ id: string }>(sql`
    update circles c
    set member_count = m.n
    from (
      select c2.id, count(cm.user_id)::int as n
      from circles c2
      left join circle_members cm on cm.circle_id = c2.id
      group by c2.id
    ) m
    where m.id = c.id and c.member_count <> m.n
    returning c.id`);
  return {
    conversations: convos.rows.length,
    guests: guests.rows.length,
    unconfirmed: unconfirmed.rows.length,
    circles: recounted.rows.length,
    limits: limits.rows.length,
    messages: messages.rows.length,
    numbers: numbers.rows.length,
    stats: stats.rows.length,
    codes: codes.rows.length,
    safety: safety.rows.length,
    health: Number(healthCounts.rows[0]?.n ?? 0),
    keys: await rewrapKeys(db),
  };
}

/** How long each kind of message stays worth sending; after that it is dropped unsent. */
const SEND_WITHIN_MINUTES: Record<string, number> = {
  otp: 5,
  'reset-password': 60,
  'verify-email': 24 * 60,
  'account-exists': 24 * 60,
  'org-invite': 7 * 24 * 60,
  // A late reply to a text is confusing, and WhatsApp refuses free-form replies after a day.
  text: 24 * 60,
};

type Sent = 'sent' | 'logged' | { cancelled: string };

/** Messages claimed at a time; a run goes on claiming until the queue is empty or time is up. */
const OUTBOX_BATCH = 20;

async function localeFor(db: Database, payload: Record<string, unknown>): Promise<Locale> {
  const chosen = toLocale(payload.locale);
  if (chosen) return chosen;
  if (typeof payload.userId === 'string') {
    const [profile] = await db
      .select({ locale: profiles.locale })
      .from(profiles)
      .where(eq(profiles.userId, payload.userId))
      .limit(1);
    const saved = toLocale(profile?.locale);
    if (saved) return saved;
  }
  return 'en';
}

/**
 * Nothing set up to send this. In development the message goes to the server log instead, so
 * a sign-in link or code can still be used; in production that would be a silent loss, so
 * the message fails (and is retried, in case a provider is being set up).
 */
function notConfigured(item: ClaimedMessage, to: string, shown: Record<string, unknown>): Sent {
  if (getEnv().isProd) throw new Error(`No ${item.channel} provider is configured`);
  // Development only: the recipient and the link or code are written out on purpose.
  log.info('outbox (development: not sent)', { channel: item.channel, to, payload: shown });
  return 'logged';
}

async function deliver(db: Database, item: ClaimedMessage, fetchImpl: typeof fetch): Promise<Sent> {
  const template = typeof item.payload.template === 'string' ? item.payload.template : '';
  const within = SEND_WITHIN_MINUTES[template];
  if (within && Date.now() - item.createdAt.getTime() > within * 60_000)
    return { cancelled: 'Too old to be useful' };
  const to = openWithKek(item.recipientRef, 'outbox');
  const payload = openOutboxPayload(item.payload);

  if (item.channel === 'email') {
    if (!isEmailTemplate(template)) throw new Error('Unknown email template');
    const locale = await localeFor(db, payload);
    const mail = renderEmail(template, payload, locale);
    if (!mail) throw new Error('The email has no usable link');
    if (!emailReady()) return notConfigured(item, to, { ...payload, subject: mail.subject });
    await sendEmail(to, mail, fetchImpl);
    return 'sent';
  }

  if (item.channel === 'sms' || item.channel === 'whatsapp') {
    const channel = item.channel;
    if (payload.respectOptOut === true && (await stoppedMessages(db, channel, to)))
      return { cancelled: 'The person asked for no more messages' };
    let body: string;
    if (template === 'otp') {
      if (typeof payload.code !== 'string') throw new Error('The code is missing');
      body = otpText(await localeFor(db, payload), payload.code);
    } else if (template === 'text' && typeof payload.body === 'string' && payload.body.trim()) {
      body = payload.body;
    } else throw new Error('Unknown text message');
    const provider = senderFor(channel, isProvider(payload.provider) ? payload.provider : null);
    if (!provider) return notConfigured(item, to, { ...payload, body });
    await sendText(provider, channel, to, body, fetchImpl);
    const intent = template === 'otp' ? 'otp' : payload.intent === 'ai' ? 'ai' : 'reply';
    await countMessage(db, channel, 'out', intent).catch(() => undefined);
    return 'sent';
  }

  // Push notifications arrive with the mobile app.
  return notConfigured(item, to, payload);
}

/**
 * Send queued messages: email through Resend or SMTP, texts through Twilio, the WhatsApp
 * Cloud API or Africa's Talking. Once a message is sent (or dropped) only its kind is kept.
 */
export async function dispatchOutbox(
  db: Database,
  fetchImpl: typeof fetch = outboundFetch(),
  budgetMs = 25_000,
): Promise<number> {
  const started = Date.now();
  let handled = 0;
  // Keep going until the queue is empty or the time is up: under a burst of sign-ups, one
  // batch a round would let codes and reset links expire while they wait their turn.
  for (;;) {
    const batch = await claimOutbox(db, OUTBOX_BATCH);
    for (const item of batch) {
      try {
        const result = await deliver(db, item, fetchImpl);
        if (typeof result === 'object') await cancelOutbox(db, item.id, result.cancelled);
        else await markOutbox(db, item.id, { ok: true });
      } catch (err) {
        log.warn('message not sent', {
          channel: item.channel,
          attempt: item.attempts,
          ...errorFields(err),
        });
        await markOutbox(db, item.id, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          attempts: item.attempts,
        });
      }
    }
    handled += batch.length;
    if (batch.length < OUTBOX_BATCH || Date.now() - started >= budgetMs) return handled;
  }
}

/**
 * After the server key is rotated (a new WAYPOINT_KEK, the old one in WAYPOINT_KEK_PREVIOUS):
 * wrap everything still under the old key with the new one — each person's data key, and the
 * sealed phone numbers of people who text. When `remaining` reaches 0 nothing needs the old
 * key any more and WAYPOINT_KEK_PREVIOUS can be removed. Runs with the retention job; safe to
 * repeat, and safe with several workers (each row is only replaced if it has not changed).
 */
export async function rewrapKeys(
  db: Database,
  limit = 500,
): Promise<{ dataKeys: number; numbers: number; unreadable: number; remaining: number }> {
  const current = `${getKeyring().currentId}:%`;
  let dataKeys = 0;
  let numbers = 0;
  let unreadable = 0;
  const staleKeys = await db
    .select({ userId: profiles.userId, dekWrapped: profiles.dekWrapped })
    .from(profiles)
    .where(and(isNotNull(profiles.dekWrapped), sql`${profiles.dekWrapped} not like ${current}`))
    .limit(limit);
  for (const row of staleKeys) {
    if (!row.dekWrapped) continue;
    try {
      const next = rewrapIfNeeded(row.dekWrapped);
      if (!next) continue;
      const done = await db
        .update(profiles)
        .set({ dekWrapped: next })
        .where(and(eq(profiles.userId, row.userId), eq(profiles.dekWrapped, row.dekWrapped)))
        .returning({ userId: profiles.userId });
      dataKeys += done.length;
    } catch {
      // Wrapped with a key this server does not have: what it protects cannot be read.
      unreadable += 1;
    }
  }
  const staleNumbers = await db
    .select({ id: channelIdentities.id, addressCt: channelIdentities.addressCt })
    .from(channelIdentities)
    .where(sql`${channelIdentities.addressCt} not like ${current}`)
    .limit(limit);
  for (const row of staleNumbers) {
    try {
      const next = sealWithKek(openWithKek(row.addressCt, 'channel'), 'channel');
      const done = await db
        .update(channelIdentities)
        .set({ addressCt: next })
        .where(
          and(eq(channelIdentities.id, row.id), eq(channelIdentities.addressCt, row.addressCt)),
        )
        .returning({ id: channelIdentities.id });
      numbers += done.length;
    } catch {
      unreadable += 1;
    }
  }
  // Keys for outside services an admin set in the console (few, so all at once).
  const staleSettings = await db
    .select({ key: integrationSettings.key, valueCt: integrationSettings.valueCt })
    .from(integrationSettings)
    .where(sql`${integrationSettings.valueCt} not like ${current}`);
  for (const row of staleSettings) {
    try {
      const next = sealWithKek(openWithKek(row.valueCt, 'integration'), 'integration');
      const done = await db
        .update(integrationSettings)
        .set({ valueCt: next })
        .where(
          and(eq(integrationSettings.key, row.key), eq(integrationSettings.valueCt, row.valueCt)),
        )
        .returning({ key: integrationSettings.key });
      numbers += done.length;
    } catch {
      unreadable += 1;
    }
  }
  const [[keysLeft], [numbersLeft]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(profiles)
      .where(and(isNotNull(profiles.dekWrapped), sql`${profiles.dekWrapped} not like ${current}`)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(channelIdentities)
      .where(sql`${channelIdentities.addressCt} not like ${current}`),
  ]);
  const remaining = Number(keysLeft?.n ?? 0) + Number(numbersLeft?.n ?? 0);
  if (unreadable)
    log.error('some keys are wrapped with a server key that is not configured', {
      unreadable,
      hint: 'Set WAYPOINT_KEK_PREVIOUS to the key that was in use before the last rotation.',
    });
  return { dataKeys, numbers, unreadable, remaining };
}

/** This week's totals for every programme that has none yet (see takeWeeklySnapshots). */
export async function orgSnapshots(db: Database): Promise<number> {
  return takeWeeklySnapshots(db);
}

export async function runDueWork(db: Database, workerId: string): Promise<void> {
  const started = Date.now();
  const results: Record<string, unknown> = {};
  for (const [name, task] of [
    ['followUps', () => crisisFollowUps(db)],
    ['reminders', () => dueReminders(db)],
    ['nudges', () => deliverNudges(db)],
    ['orgSnapshots', () => orgSnapshots(db)],
    ['outbox', () => dispatchOutbox(db)],
  ] as const) {
    try {
      results[name] = await task();
    } catch (err) {
      log.error(`job ${name} failed`, errorFields(err));
    }
  }
  log.debug('jobs ran', { workerId, ...results, ms: Date.now() - started });
}

/**
 * The worker's pause between rounds, from WORKER_INTERVAL_MS: 30 seconds unless it is a positive
 * number, and never under a second (a value that is not a number would otherwise spin the loop).
 */
export function workerIntervalMs(raw: string | undefined): number {
  const n = Number(raw);
  if (!raw?.trim() || !Number.isFinite(n) || n <= 0) return 30_000;
  return Math.max(1_000, Math.round(n));
}

/** For the worker's own log lines: the same scrubbed error fields the API logs. */
export { errorFields } from '../lib/log';

let timer: ReturnType<typeof setInterval> | undefined;
let retentionTimer: ReturnType<typeof setInterval> | undefined;

let stopListening: (() => void) | undefined;

/** Start background work inside this process (embedded database, single instance). */
export function startInProcessWorker(getDb: () => Database, intervalMs = 60_000): void {
  if (timer) return;
  const workerId = `inproc-${process.pid}`;
  const tick = () => void runDueWork(getDb(), workerId).catch(() => undefined);
  // A sign-in link or a reply shouldn't wait for the next round: send shortly after it is
  // queued (the short delay lets the change that queued it finish first).
  let soon: ReturnType<typeof setTimeout> | undefined;
  stopListening = onMessageQueued(() => {
    if (soon) return;
    soon = setTimeout(() => {
      soon = undefined;
      void dispatchOutbox(getDb()).catch((err) => log.error('outbox failed', errorFields(err)));
    }, 250);
    soon.unref?.();
  });
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
  retentionTimer = setInterval(
    () =>
      void retention(getDb())
        .then((r) => log.info('retention', r))
        .catch((err) => log.error('retention failed', errorFields(err))),
    6 * 3_600_000,
  );
  retentionTimer.unref?.();
  setTimeout(tick, 5_000).unref?.();
  log.info('background work started in-process', { workerId, intervalMs });
}

export function stopInProcessWorker(): void {
  stopListening?.();
  stopListening = undefined;
  if (timer) clearInterval(timer);
  if (retentionTimer) clearInterval(retentionTimer);
  timer = undefined;
  retentionTimer = undefined;
}
