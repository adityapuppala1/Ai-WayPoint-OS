#!/usr/bin/env node
/**
 * Health check for a local or deployed Waypoint. Explains problems in plain words.
 *
 *   pnpm doctor                 checks this machine
 *   pnpm doctor https://my.app  also checks a running server
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let problems = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);
const bad = (m) => {
  problems += 1;
  console.log(`  ✗ ${m}`);
};

function readEnv() {
  const env = {};
  for (const file of ['.env', '.env.local']) {
    const p = join(root, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return {
    ...env,
    ...Object.fromEntries(
      Object.entries(process.env).filter(([k]) =>
        /^(WAYPOINT|BETTER_AUTH|DATABASE|AI_|ANTHROPIC|OPENAI|GOOGLE|OLLAMA)/.test(k),
      ),
    ),
  };
}

console.log('\nWaypoint doctor\n');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 22 || (major === 22 && minor >= 12)) ok(`Node.js ${process.versions.node}`);
else bad(`Node.js ${process.versions.node} — install 22.12 or newer`);

if (existsSync(join(root, 'node_modules', '.pnpm'))) ok('Dependencies installed');
else bad('Dependencies missing — run: pnpm install');

const env = readEnv();
if (!existsSync(join(root, '.env.local'))) warn('No .env.local yet — run: pnpm setup');
for (const k of ['BETTER_AUTH_SECRET', 'WAYPOINT_KEK']) {
  if (env[k] && Buffer.from(env[k], 'base64').length >= 32) ok(`${k} is set`);
  else if (env[k]) bad(`${k} looks too short (needs 32 random bytes, base64)`);
  else
    warn(
      `${k} not set — fine for development (a local secret is generated), REQUIRED in production`,
    );
}

if (env.DATABASE_URL) ok('Using Postgres (DATABASE_URL)');
else {
  const dataDir = env.WAYPOINT_DATA_DIR || '.data';
  const full = isAbsolute(dataDir) ? dataDir : join(root, dataDir);
  ok(`Using embedded Postgres in ${full}`);
  const lock = join(full, 'pglite.lock');
  if (existsSync(lock)) {
    try {
      const pid = Number(readFileSync(lock, 'utf8').trim());
      let alive = false;
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {}
      if (alive)
        warn(`The embedded database is in use by process ${pid} (normal while \`pnpm dev\` runs)`);
      else warn('A stale database lock was found; it is cleared automatically on next start');
    } catch {}
  }
  if (existsSync(full) && !statSync(full).isDirectory()) bad(`${full} exists but is not a folder`);
}

const ai = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OLLAMA_BASE_URL',
].filter((k) => env[k]);
if (ai.length)
  ok(
    `AI providers: ${ai.join(', ')} (order: ${env.AI_PROVIDER_ORDER || 'anthropic,openai,google,ollama'})`,
  );
else warn('No AI provider configured — Ask runs in guided mode. Safety features work without AI.');

if (env.WAYPOINT_OPERATOR && env.WAYPOINT_CONTACT_EMAIL)
  ok(`Privacy notice and terms name ${env.WAYPOINT_OPERATOR} (${env.WAYPOINT_CONTACT_EMAIL})`);
else
  warn(
    'The privacy notice and terms (/privacy, /terms) do not say who runs this Waypoint yet — set WAYPOINT_OPERATOR and WAYPOINT_CONTACT_EMAIL before going live.',
  );

const url = process.argv[2] || env.WAYPOINT_URL || 'http://localhost:3000';
try {
  const res = await fetch(new URL('/api/ready', url), { signal: AbortSignal.timeout(5000) });
  const body = await res.json().catch(() => ({}));
  if (res.ok)
    ok(`Server at ${url} is ${body.status === 'ready' ? 'ready' : 'answering, but not ready'}`);
  else bad(`Server at ${url} answered ${res.status}`);
} catch {
  warn(`No server answering at ${url} (start it with: pnpm dev)`);
}

console.log(problems ? `\n${problems} problem(s) found.\n` : '\nAll good.\n');
process.exitCode = problems ? 1 : 0;
