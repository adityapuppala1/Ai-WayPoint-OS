/**
 * Outside services in the platform console: what is set up and where each setting comes from,
 * whether each service answers, what it has been used for and what it cost, and changing its
 * keys and options. Keys are sealed with the KEK and never leave the server again; the console
 * only ever sees a secret's last four characters. Every change and every check is audited.
 */
import { z } from '@hono/zod-openapi';
import {
  CONSOLE_SETTINGS,
  INTEGRATIONS,
  type Integration,
  integrationById,
  secretHint,
} from '@waypoint/core/console';
import {
  checkConsoleSettings,
  consoleSetting,
  getEnv,
  setConsoleSettings,
  settingSource,
} from '@waypoint/core/env';
import { openWithKek, sealWithKek } from '@waypoint/core/privacy';
import {
  aiUsage,
  channelStats,
  type Database,
  eq,
  gte,
  inArray,
  integrationChecks,
  integrationSettings,
  outbox,
  sql,
} from '@waypoint/db';
import { type Actor, audit } from '../lib/audit';
import { badRequest, notFound } from '../lib/problem';
import { CHECKABLE, checkIntegration } from './integration-checks';

const PURPOSE = 'integration';
const DAY = 86_400_000;
const num = (v: unknown) => Number(v ?? 0);

// ─────────────────────────── Keeping every process in step ───────────────────────────

/** Reads the console's settings from the database and starts using them. */
export async function loadConsoleSettings(db: Database): Promise<string[]> {
  const rows = await db
    .select({ key: integrationSettings.key, valueCt: integrationSettings.valueCt })
    .from(integrationSettings);
  const values: Record<string, string> = {};
  for (const row of rows)
    try {
      values[row.key] = openWithKek(row.valueCt, PURPOSE);
    } catch {
      // Sealed with a key this server no longer has: left out, and shown as unset.
    }
  return setConsoleSettings(values);
}

const SYNC_KEY = Symbol.for('waypoint.consoleSettingsSync');

/**
 * Loads the console's settings now, then looks for changes every half minute, so every web
 * server and worker uses a change within that time. Safe to call more than once.
 */
export async function startSettingsSync(db: Database, everyMs = 30_000): Promise<void> {
  const g = globalThis as { [SYNC_KEY]?: { timer: ReturnType<typeof setInterval> } };
  if (g[SYNC_KEY]) return;
  let seen = '';
  const signature = async () => {
    const [row] = await db
      .select({
        n: sql<number>`count(*)::int`,
        at: sql<string>`coalesce(max(${integrationSettings.updatedAt})::text, '')`,
      })
      .from(integrationSettings);
    return `${num(row?.n)}|${row?.at ?? ''}`;
  };
  const sync = async () => {
    try {
      const now = await signature();
      if (now !== seen) {
        await loadConsoleSettings(db);
        seen = now;
      }
    } catch {
      // The database is busy or not there yet: try again next time.
    }
  };
  await sync();
  const timer = setInterval(sync, everyMs);
  timer.unref?.();
  g[SYNC_KEY] = { timer };
}

// ─────────────────────────────────── The view ───────────────────────────────────

const FieldSchema = z.object({
  key: z.string(),
  kind: z.enum(['secret', 'text', 'url', 'number', 'choice', 'list']),
  options: z.array(z.string()).nullable(),
  placeholder: z.string().nullable(),
  /** Where the value in use comes from. A server value can only be changed on the server. */
  source: z.enum(['server', 'console', 'default']),
  /** What may be shown: a secret's last four characters, an ordinary value in full. */
  shown: z.string().nullable(),
});

const UsageSchema = z.object({
  /** Calls, messages or emails in the last 30 days. */
  count: z.number().int(),
  errors: z.number().int(),
  costUsd: z.number().nullable(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  latencyP50Ms: z.number().nullable(),
  latencyP95Ms: z.number().nullable(),
  lastUsedAt: z.string().nullable(),
  /** The last 14 days, oldest first. */
  daily: z.array(z.object({ day: z.string(), count: z.number().int(), costUsd: z.number() })),
  /** Texts: messages in and out; email: sent, failed and waiting. */
  breakdown: z.array(z.object({ label: z.string(), count: z.number().int() })),
});

export const IntegrationViewSchema = z.object({
  id: z.string(),
  group: z.enum(['ai', 'judge', 'texting', 'email']),
  /** In use: everything it needs is set. */
  configured: z.boolean(),
  testable: z.boolean(),
  docs: z.string(),
  fields: z.array(FieldSchema),
  check: z
    .object({
      ok: z.boolean(),
      detail: z.string(),
      latencyMs: z.number().nullable(),
      models: z.array(z.string()),
      checkedAt: z.string(),
    })
    .nullable(),
  /** ok: answered its last check and has few errors; failing: it did not; untested; off. */
  status: z.enum(['ok', 'failing', 'untested', 'off']),
  usage: UsageSchema.nullable(),
});

export const IntegrationsSchema = z
  .object({ integrations: z.array(IntegrationViewSchema), monthSpendUsd: z.number() })
  .openapi('Integrations');

export type IntegrationView = z.infer<typeof IntegrationViewSchema>;
export type Integrations = z.infer<typeof IntegrationsSchema>;

/** The provider id each AI service is recorded under in ai_usage. */
const USAGE_PROVIDER: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  google: 'google',
  ollama: 'ollama',
  typesafe: 'typesafe',
};

/** The channels each texting service carries. */
const TEXT_CHANNELS: Record<string, string[]> = {
  twilio: ['sms', 'whatsapp'],
  whatsapp: ['whatsapp'],
  africastalking: ['sms', 'ussd'],
};

function fieldView(field: {
  key: string;
  kind: string;
  options?: readonly string[];
  placeholder?: string;
}) {
  const source = settingSource(field.key);
  const value =
    source === 'server'
      ? process.env[field.key]?.trim()
      : source === 'console'
        ? consoleSetting(field.key)
        : undefined;
  return {
    key: field.key,
    kind: field.kind as z.infer<typeof FieldSchema>['kind'],
    options: field.options ? [...field.options] : null,
    placeholder: field.placeholder ?? null,
    source,
    shown: value ? (field.kind === 'secret' ? secretHint(value) : value) : null,
  };
}

function isConfigured(integration: Integration): boolean {
  const env = getEnv() as unknown as Record<string, unknown>;
  return integration.needs.length > 0 && integration.needs.every((k) => Boolean(env[k]));
}

function days(now: Date): string[] {
  const out: string[] = [];
  for (let i = 13; i >= 0; i--)
    out.push(new Date(now.getTime() - i * DAY).toISOString().slice(0, 10));
  return out;
}

async function aiUsageByProvider(db: Database, now: Date) {
  const since = new Date(now.getTime() - 30 * DAY);
  const fortnight = new Date(now.getTime() - 13 * DAY);
  fortnight.setUTCHours(0, 0, 0, 0);
  const [totals, daily] = await Promise.all([
    db
      .select({
        provider: aiUsage.provider,
        count: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${aiUsage.status} = 'error')::int`,
        cost: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8`,
        input: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int`,
        output: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
        p50: sql<
          number | null
        >`percentile_cont(0.5) within group (order by ${aiUsage.latencyMs})::float8`,
        p95: sql<
          number | null
        >`percentile_cont(0.95) within group (order by ${aiUsage.latencyMs})::float8`,
        last: sql<string | null>`max(${aiUsage.createdAt})::text`,
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, since))
      .groupBy(aiUsage.provider),
    db
      .select({
        provider: aiUsage.provider,
        day: sql<string>`to_char(${aiUsage.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        cost: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8`,
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, fortnight))
      .groupBy(aiUsage.provider, sql`2`),
  ]);
  return { totals, daily };
}

async function textUsage(db: Database, now: Date) {
  const since = new Date(now.getTime() - 30 * DAY).toISOString().slice(0, 10);
  const fortnight = new Date(now.getTime() - 13 * DAY).toISOString().slice(0, 10);
  const [byChannel, daily, delivery] = await Promise.all([
    db
      .select({
        channel: channelStats.channel,
        direction: channelStats.direction,
        n: sql<number>`sum(${channelStats.n})::int`,
      })
      .from(channelStats)
      .where(gte(channelStats.day, since))
      .groupBy(channelStats.channel, channelStats.direction),
    db
      .select({
        channel: channelStats.channel,
        day: channelStats.day,
        n: sql<number>`sum(${channelStats.n})::int`,
      })
      .from(channelStats)
      .where(gte(channelStats.day, fortnight))
      .groupBy(channelStats.channel, channelStats.day),
    db
      .select({
        channel: outbox.channel,
        status: outbox.status,
        n: sql<number>`count(*)::int`,
        last: sql<string | null>`max(coalesce(${outbox.sentAt}, ${outbox.createdAt}))::text`,
      })
      .from(outbox)
      .where(
        sql`${outbox.createdAt} >= ${new Date(now.getTime() - 30 * DAY).toISOString()}::timestamptz and ${inArray(outbox.channel, ['sms', 'whatsapp', 'email'])}`,
      )
      .groupBy(outbox.channel, outbox.status),
  ]);
  return { byChannel, daily, delivery };
}

const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);

export async function integrationsView(db: Database, now = new Date()): Promise<Integrations> {
  const [checks, ai, text] = await Promise.all([
    db.select().from(integrationChecks),
    aiUsageByProvider(db, now),
    textUsage(db, now),
  ]);
  const checkOf = new Map(checks.map((c) => [c.provider, c]));
  const dayList = days(now);

  const usageFor = (integration: Integration): IntegrationView['usage'] => {
    const provider = USAGE_PROVIDER[integration.id];
    if (provider) {
      const t = ai.totals.find((r) => r.provider === provider);
      const d = new Map(
        ai.daily.filter((r) => r.provider === provider).map((r) => [r.day, r] as const),
      );
      return {
        count: num(t?.count),
        errors: num(t?.errors),
        costUsd: num(t?.cost),
        inputTokens: num(t?.input),
        outputTokens: num(t?.output),
        latencyP50Ms: t?.p50 == null ? null : Math.round(num(t.p50)),
        latencyP95Ms: t?.p95 == null ? null : Math.round(num(t.p95)),
        lastUsedAt: iso(t?.last),
        daily: dayList.map((day) => ({
          day,
          count: num(d.get(day)?.count),
          costUsd: num(d.get(day)?.cost),
        })),
        breakdown: [],
      };
    }
    const channels = TEXT_CHANNELS[integration.id];
    if (channels) {
      const sum = (direction: string) =>
        text.byChannel
          .filter((r) => channels.includes(r.channel) && r.direction === direction)
          .reduce((n, r) => n + num(r.n), 0);
      const failed = text.delivery
        .filter((r) => channels.includes(r.channel) && r.status === 'failed')
        .reduce((n, r) => n + num(r.n), 0);
      const perDay = new Map<string, number>();
      for (const r of text.daily)
        if (channels.includes(r.channel)) perDay.set(r.day, (perDay.get(r.day) ?? 0) + num(r.n));
      const lasts = text.delivery.filter((r) => channels.includes(r.channel)).map((r) => r.last);
      return {
        count: sum('in') + sum('out'),
        errors: failed,
        costUsd: null,
        inputTokens: null,
        outputTokens: null,
        latencyP50Ms: null,
        latencyP95Ms: null,
        lastUsedAt: iso(lasts.filter(Boolean).sort().at(-1)),
        daily: dayList.map((day) => ({ day, count: perDay.get(day) ?? 0, costUsd: 0 })),
        breakdown: [
          { label: 'in', count: sum('in') },
          { label: 'out', count: sum('out') },
        ],
      };
    }
    if (integration.group === 'email' && integration.needs.length) {
      const rows = text.delivery.filter((r) => r.channel === 'email');
      const of = (status: string) => num(rows.find((r) => r.status === status)?.n);
      return {
        count: of('sent'),
        errors: of('failed'),
        costUsd: null,
        inputTokens: null,
        outputTokens: null,
        latencyP50Ms: null,
        latencyP95Ms: null,
        lastUsedAt: iso(
          rows
            .map((r) => r.last)
            .filter(Boolean)
            .sort()
            .at(-1),
        ),
        daily: [],
        breakdown: [
          { label: 'sent', count: of('sent') },
          { label: 'failed', count: of('failed') },
          { label: 'queued', count: of('queued') },
        ],
      };
    }
    return null;
  };

  const integrations = INTEGRATIONS.map((integration) => {
    const check = checkOf.get(integration.id);
    const configured = isConfigured(integration);
    const usage = integration.needs.length ? usageFor(integration) : null;
    // Failing: its last check failed, or more than one in five of its recent calls did.
    const erring = usage ? usage.count >= 5 && usage.errors / usage.count > 0.2 : false;
    const status: IntegrationView['status'] = !integration.needs.length
      ? 'ok'
      : !configured
        ? 'off'
        : check && !check.ok
          ? 'failing'
          : erring
            ? 'failing'
            : check
              ? 'ok'
              : 'untested';
    return {
      id: integration.id,
      group: integration.group,
      configured,
      testable: integration.testable && CHECKABLE.has(integration.id),
      docs: integration.docs,
      fields: integration.fields.map(fieldView),
      check: check
        ? {
            ok: check.ok,
            detail: check.detail,
            latencyMs: check.latencyMs,
            models: check.models ?? [],
            checkedAt: check.checkedAt.toISOString(),
          }
        : null,
      status,
      usage,
    };
  });

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [spend] = await db
    .select({ cost: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8` })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, monthStart));
  return { integrations, monthSpendUsd: num(spend?.cost) };
}

// ─────────────────────────────────── Changing ───────────────────────────────────

export const IntegrationUpdateSchema = z
  .object({
    /** Each setting to change, by name: a new value, or null to remove the console's value. */
    values: z.record(z.string(), z.string().max(4000).nullable()),
  })
  .openapi('IntegrationUpdate');

function normalise(kind: string, raw: string): string {
  const value = raw.trim();
  if (kind === 'list')
    return [
      ...new Set(
        value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ].join(',');
  return value;
}

function invalid(kind: string, value: string, options?: readonly string[]): string | null {
  if (/[\r\n]/.test(value)) return 'One line only.';
  if (kind === 'number' && !/^\d+(\.\d+)?$/.test(value)) return 'A number, such as 25.';
  if (kind === 'url') {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'An http or https address.';
    } catch {
      return 'A web address, such as http://localhost:11434.';
    }
  }
  if (kind === 'choice' && options && !options.includes(value))
    return `One of: ${options.join(', ')}.`;
  if (kind === 'list' && options) {
    const unknown = value.split(',').filter((v) => !options.includes(v));
    if (unknown.length) return `Only: ${options.join(', ')}.`;
  }
  return null;
}

/** Saves an admin's changes to one service's settings and starts using them at once. */
export async function saveIntegration(
  db: Database,
  actor: Actor,
  id: string,
  changes: Record<string, string | null>,
): Promise<{ dropped: string[] }> {
  const integration = integrationById(id);
  if (!integration) throw notFound();
  const fields = new Map(integration.fields.map((f) => [f.key, f]));
  const problems: Record<string, string> = {};
  const next: Record<string, string | null> = {};
  for (const [key, raw] of Object.entries(changes)) {
    const field = fields.get(key);
    if (!field) {
      problems[key] = 'Not a setting of this service.';
      continue;
    }
    if (settingSource(key) === 'server') {
      problems[key] = 'Set on the server; change it there.';
      continue;
    }
    if (raw === null || !raw.trim()) {
      next[key] = null;
      continue;
    }
    const value = normalise(field.kind, raw);
    const problem = invalid(field.kind, value, field.options);
    if (problem) problems[key] = problem;
    else next[key] = value;
  }
  // Checked as the whole configuration would be, so nothing saved here can stop the server.
  const current = await db
    .select({ key: integrationSettings.key, valueCt: integrationSettings.valueCt })
    .from(integrationSettings);
  const proposed: Record<string, string> = {};
  for (const row of current)
    try {
      proposed[row.key] = openWithKek(row.valueCt, PURPOSE);
    } catch {
      // unreadable: treated as unset
    }
  for (const [key, value] of Object.entries(next)) {
    if (value === null) delete proposed[key];
    else proposed[key] = value;
  }
  for (const [key, message] of Object.entries(checkConsoleSettings(proposed)))
    if (key in next) problems[key] ??= message;
  if (Object.keys(problems).length) throw badRequest('Some settings were not saved.', { problems });
  if (!Object.keys(next).length) return { dropped: [] };

  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(next)) {
      if (value === null) {
        await tx.delete(integrationSettings).where(eq(integrationSettings.key, key));
        continue;
      }
      const kind = CONSOLE_SETTINGS.get(key)?.kind;
      const row = {
        key,
        valueCt: sealWithKek(value, PURPOSE),
        hint: kind === 'secret' ? secretHint(value) : value,
        updatedBy: actor.userId,
        updatedAt: new Date(),
      };
      await tx
        .insert(integrationSettings)
        .values(row)
        .onConflictDoUpdate({ target: integrationSettings.key, set: row });
    }
    // The settings' names only: never a value, not even a key's last characters.
    await audit(tx, actor, {
      action: 'integration.update',
      targetType: 'integration',
      targetId: id,
      meta: {
        set: Object.keys(next).filter((k) => next[k] !== null),
        removed: Object.keys(next).filter((k) => next[k] === null),
      },
    });
    // A check made with the old settings says nothing about the new ones.
    await tx.delete(integrationChecks).where(eq(integrationChecks.provider, id));
  });
  return { dropped: setConsoleSettings(proposed) };
}

export const IntegrationCheckSchema = z
  .object({
    ok: z.boolean(),
    detail: z.string(),
    latencyMs: z.number(),
    models: z.array(z.string()),
  })
  .openapi('IntegrationCheck');

/** Checks a service now with the settings in use, and keeps the answer. */
export async function testIntegration(
  db: Database,
  actor: Actor,
  id: string,
): Promise<z.infer<typeof IntegrationCheckSchema>> {
  const integration = integrationById(id);
  if (!integration?.testable) throw notFound();
  if (!isConfigured(integration))
    throw badRequest('Set this service up before checking it.', { problems: {} });
  const result = await checkIntegration(id);
  const row = {
    provider: id,
    ok: result.ok,
    detail: result.detail,
    latencyMs: result.latencyMs,
    models: result.models ?? null,
    checkedBy: actor.userId,
    checkedAt: new Date(),
  };
  await db.transaction(async (tx) => {
    await tx
      .insert(integrationChecks)
      .values(row)
      .onConflictDoUpdate({ target: integrationChecks.provider, set: row });
    await audit(tx, actor, {
      action: 'integration.check',
      targetType: 'integration',
      targetId: id,
      meta: { ok: result.ok },
    });
  });
  return {
    ok: result.ok,
    detail: result.detail,
    latencyMs: result.latencyMs,
    models: result.models ?? [],
  };
}
