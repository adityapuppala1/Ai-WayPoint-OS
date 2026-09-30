/**
 * Server-side configuration. One place that reads process.env, validates it and applies
 * safe defaults, so every app (web, API server, worker, CLI) behaves the same way.
 *
 * Env files live at the MONOREPO ROOT (`.env.local`, then `.env`). `loadRootEnv()` finds
 * the root by walking up to `pnpm-workspace.yaml` and never overrides variables that are
 * already set (so real environment variables in Docker/Kubernetes always win).
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';

let rootCache: string | undefined;

export function findRepoRoot(start: string = process.cwd()): string {
  if (rootCache) return rootCache;
  let dir = resolve(start);
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      rootCache = dir;
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  rootCache = resolve(start);
  return rootCache;
}

let loaded = false;

export function loadRootEnv(start?: string): void {
  if (loaded) return;
  loaded = true;
  const root = findRepoRoot(start);
  const mode =
    process.env.NODE_ENV === 'production'
      ? 'production'
      : process.env.NODE_ENV === 'test'
        ? 'test'
        : 'development';
  const files = [
    `.env.${mode}.local`,
    mode === 'test' ? null : '.env.local',
    `.env.${mode}`,
    '.env',
  ];
  for (const file of files) {
    if (!file) continue;
    // Runtime-only lookup: keep bundlers from tracing the whole repository.
    const path = join(/*turbopackIgnore: true*/ root, file);
    // process.loadEnvFile never overrides variables that already exist.
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

const bool = z
  .enum(['true', 'false', '1', '0', 'yes', 'no', ''])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : ['true', '1', 'yes'].includes(v)));

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WAYPOINT_URL: z.string().url().default('http://localhost:3000'),
  BETTER_AUTH_URL: optionalString,
  BETTER_AUTH_SECRET: optionalString,
  /** 32-byte key (base64) that wraps per-user data keys. Rotate with WAYPOINT_KEK_PREVIOUS. */
  WAYPOINT_KEK: optionalString,
  WAYPOINT_KEK_PREVIOUS: optionalString,
  DATABASE_URL: optionalString,
  WAYPOINT_DATA_DIR: z.string().default('.data'),
  WAYPOINT_AUTO_MIGRATE: bool,
  /** Where SQL migrations live. Defaults to packages/db/drizzle in the repo. */
  WAYPOINT_MIGRATIONS_DIR: optionalString,
  /** Load reference data (starter circles, sourced signals) on start. Default: on for embedded DB. */
  WAYPOINT_AUTO_SEED: bool,
  WAYPOINT_SEED_DEMO: bool,
  WAYPOINT_ADMIN_EMAIL: optionalString,
  WAYPOINT_ADMIN_PASSWORD: optionalString,
  /** Smallest group an organisation can ever see (the code never goes below 20). */
  WAYPOINT_K_ANON_MIN: z.coerce.number().int().min(20).default(50),
  // The public privacy notice and terms (/privacy, /terms) name who runs this Waypoint.
  /** Who runs this Waypoint: legal name and postal address, e.g. "Example Trust, 1 Road, Nairobi, Kenya". */
  WAYPOINT_OPERATOR: optionalString,
  /** Where people write about their information or the terms. */
  WAYPOINT_CONTACT_EMAIL: optionalString.pipe(z.string().email().optional()),
  /** Where the servers and database are, e.g. "Frankfurt, Germany (Hetzner Online)". */
  WAYPOINT_DATA_LOCATION: optionalString,
  /** How many days backups are kept, if you keep them: the notice tells people. */
  WAYPOINT_BACKUP_DAYS: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().min(1).max(3650).optional(),
  ),
  WEB_ORIGINS: optionalString,
  /**
   * The one request header that carries the visitor's address, set by your own edge: for
   * example `cf-connecting-ip` behind Cloudflare or `x-real-ip` behind nginx. Any other such
   * header is ignored, because visitors can send them too. Default: X-Forwarded-For.
   */
  WAYPOINT_CLIENT_IP_HEADER: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim().toLowerCase() : undefined))
    .pipe(
      z
        .string()
        .regex(/^[a-z0-9-]{1,64}$/)
        .optional(),
    ),
  /** Proxy addresses or CIDR ranges trusted to append to X-Forwarded-For. */
  TRUSTED_PROXIES: optionalString,
  // AI
  ANTHROPIC_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
  OLLAMA_BASE_URL: optionalString,
  AI_PROVIDER_ORDER: z.string().default('anthropic,openai,google,ollama'),
  AI_MODEL_ANTHROPIC_SMALL: z.string().default('claude-haiku-4-5'),
  AI_MODEL_ANTHROPIC_LARGE: z.string().default('claude-sonnet-5-5'),
  AI_MODEL_OPENAI_SMALL: z.string().default('gpt-5.4-mini'),
  AI_MODEL_OPENAI_LARGE: z.string().default('gpt-5.5'),
  AI_MODEL_GOOGLE_SMALL: z.string().default('gemini-3.5-flash-lite'),
  AI_MODEL_GOOGLE_LARGE: z.string().default('gemini-2.5-pro'),
  AI_MODEL_OLLAMA_SMALL: z.string().default('llama3.2'),
  AI_MODEL_OLLAMA_LARGE: z.string().default('llama3.1:8b'),
  AI_EMBEDDING_PROVIDER: z.enum(['none', 'openai', 'google', 'ollama']).default('none'),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(25),
  AI_TOOL_APPROVAL_SECRET: optionalString,
  // Channels: SMS, WhatsApp and USSD (any one provider is enough)
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  /** Twilio number texts come from, e.g. +15550001234 (or use TWILIO_MESSAGING_SERVICE_SID). */
  TWILIO_SMS_FROM: optionalString,
  TWILIO_MESSAGING_SERVICE_SID: optionalString,
  /** Twilio WhatsApp sender, e.g. whatsapp:+14155238886. */
  TWILIO_WHATSAPP_FROM: optionalString,
  /** WhatsApp Cloud API (Meta). */
  WHATSAPP_VERIFY_TOKEN: optionalString,
  WHATSAPP_APP_SECRET: optionalString,
  WHATSAPP_ACCESS_TOKEN: optionalString,
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  /** Africa's Talking (SMS and USSD). Use the username `sandbox` for testing. */
  AFRICASTALKING_USERNAME: optionalString,
  AFRICASTALKING_API_KEY: optionalString,
  AFRICASTALKING_SENDER_ID: optionalString,
  /**
   * A long random value added to the callback URLs as ?key=…: Africa's Talking does not sign
   * its callbacks, so this is all that stands in for a signature. At least 32 characters.
   */
  AFRICASTALKING_WEBHOOK_KEY: optionalString.pipe(z.string().min(32).optional()),
  /**
   * The most texts Waypoint answers in an hour and in a day, across every number. Replies cost
   * money, so this bounds what a flood of made-up senders can spend. People in danger have a
   * separate allowance of the same size.
   */
  WAYPOINT_TEXT_REPLIES_PER_HOUR: z.coerce.number().int().min(1).default(2000),
  WAYPOINT_TEXT_REPLIES_PER_DAY: z.coerce.number().int().min(1).default(20_000),
  /**
   * Countries whose numbers get replies, as ISO codes ("KE,TZ,UG"). Default: every country
   * Waypoint has help lines for. Set your providers' own geographic permissions to match.
   */
  WAYPOINT_TEXT_COUNTRIES: optionalString,
  /** Shown on the website so people know where to text. */
  WAYPOINT_SMS_NUMBER: optionalString,
  WAYPOINT_WHATSAPP_NUMBER: optionalString,
  WAYPOINT_USSD_CODE: optionalString,
  // Email (any one): SMTP (smtp://user:pass@host:587) or Resend
  EMAIL_FROM: optionalString,
  SMTP_URL: optionalString,
  RESEND_API_KEY: optionalString,
  // Observability
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalString,
});

export type ServerEnv = z.infer<typeof EnvSchema> & {
  /** The header the visitor's address is read from (WAYPOINT_CLIENT_IP_HEADER, lower case). */
  clientIpHeader: string;
  /** Absolute path for embedded Postgres + local files. */
  dataDir: string;
  /** True when using embedded Postgres (no DATABASE_URL). */
  embeddedDb: boolean;
  repoRoot: string;
  isProd: boolean;
};

const isThisMachine = (hostname: string) =>
  ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname.toLowerCase()) ||
  hostname.toLowerCase().endsWith('.localhost');

let envCache: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (envCache) return envCache;
  loadRootEnv();
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid Waypoint configuration — ${issues}`);
  }
  const env = parsed.data;
  const repoRoot = findRepoRoot();
  const dataDir = isAbsolute(env.WAYPOINT_DATA_DIR)
    ? env.WAYPOINT_DATA_DIR
    : join(repoRoot, env.WAYPOINT_DATA_DIR);
  const isProd = env.NODE_ENV === 'production';
  if (isProd) {
    const missing = (['BETTER_AUTH_SECRET', 'WAYPOINT_KEK'] as const).filter((k) => !env[k]);
    if (missing.length) {
      throw new Error(
        `Missing required production secrets: ${missing.join(', ')}. Run \`pnpm setup\` or set them in the environment.`,
      );
    }
    // Sessions, sign-in links and approvals are all signed with this one secret.
    if ((env.BETTER_AUTH_SECRET ?? '').length < 32)
      throw new Error(
        "BETTER_AUTH_SECRET must be at least 32 characters in production. Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      );
    // Without https the session cookie is not marked Secure and travels in the clear. A
    // production build tried out on this machine (localhost) is the one exception.
    const site = new URL(env.WAYPOINT_URL);
    if (site.protocol !== 'https:' && !isThisMachine(site.hostname))
      throw new Error(
        `WAYPOINT_URL must start with https:// in production (it is ${site.origin}).`,
      );
  }
  envCache = {
    ...env,
    clientIpHeader: env.WAYPOINT_CLIENT_IP_HEADER ?? 'x-forwarded-for',
    dataDir,
    embeddedDb: !env.DATABASE_URL,
    repoRoot,
    isProd,
  };
  return envCache;
}

/**
 * A stable random secret for local development when one is not configured, stored in
 * `<dataDir>/dev-secrets.json` (git-ignored). Never used in production.
 */
export function devSecret(name: string, bytes = 32): string {
  const env = getEnv();
  if (env.isProd) throw new Error(`${name} must be configured in production.`);
  const file = join(env.dataDir, 'dev-secrets.json');
  let secrets: Record<string, string> = {};
  if (existsSync(file)) {
    try {
      secrets = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
    } catch {
      secrets = {};
    }
  }
  const existing = secrets[name];
  if (existing) return existing;
  const value = randomBytes(bytes).toString('base64');
  secrets[name] = value;
  mkdirSync(env.dataDir, { recursive: true });
  writeFileSync(file, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  return value;
}

/** Test helper: forget cached env so a test can change process.env. */
export function resetEnvForTests(): void {
  envCache = undefined;
  loaded = false;
}

/**
 * Warnings about a production set-up that works but is weaker than it should be, for the
 * server to print on start.
 */
export function configWarnings(env: ServerEnv = getEnv()): string[] {
  const out: string[] = [];
  if (env.isProd && isThisMachine(new URL(env.WAYPOINT_URL).hostname))
    out.push(
      `WAYPOINT_URL is ${env.WAYPOINT_URL}: fine for trying a production build on this machine, but on a real server set it to the public https:// address. Until then sign-in links point here and session cookies are not marked Secure.`,
    );
  if (env.isProd && !env.WAYPOINT_CLIENT_IP_HEADER && !env.TRUSTED_PROXIES)
    out.push(
      'Rate limits read the visitor address from X-Forwarded-For with no trusted proxies set. If Waypoint is reachable without a proxy that overwrites that header, visitors can dodge limits: set WAYPOINT_CLIENT_IP_HEADER (e.g. cf-connecting-ip) or TRUSTED_PROXIES.',
    );
  if (env.isProd && (!env.WAYPOINT_OPERATOR || !env.WAYPOINT_CONTACT_EMAIL))
    out.push(
      'The privacy notice and terms (/privacy, /terms) do not say who runs this Waypoint or how to reach them, which data protection law requires: set WAYPOINT_OPERATOR and WAYPOINT_CONTACT_EMAIL.',
    );
  if (env.isProd && !(env.EMAIL_FROM && (env.RESEND_API_KEY || env.SMTP_URL)))
    out.push(
      'Email is not set up, so nobody can confirm an address: new email accounts cannot be signed in to, and password resets never arrive. Set EMAIL_FROM with RESEND_API_KEY or SMTP_URL.',
    );
  return out;
}
