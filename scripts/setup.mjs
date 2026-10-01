#!/usr/bin/env node
/**
 * One-time local setup: checks your tools and writes `.env.local` with fresh secrets.
 * Safe to run again — it never overwrites secrets that are already set.
 *
 *   pnpm setup
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);
const fail = (m) => {
  console.error(`  ✗ ${m}`);
  process.exitCode = 1;
};

console.log('\nWaypoint setup\n');

// 1. Node version
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 22 || (major === 22 && minor >= 12)) ok(`Node.js ${process.versions.node}`);
else
  fail(
    `Node.js ${process.versions.node} is too old. Install Node.js 22.12 or newer from https://nodejs.org`,
  );

// 2. Dependencies installed?
if (existsSync(join(root, 'node_modules', '.pnpm'))) ok('Dependencies installed');
else warn('Dependencies are not installed yet. Run: pnpm install');

// 3. .env.local with secrets. Read, not "check, then read": the file could appear in between.
// A new one is only ever created, never written over one that appeared meanwhile.
const envPath = join(root, '.env.local');
const examplePath = join(root, '.env.example');
const readIfThere = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
};
const existing = readIfThere(envPath);
let text = existing ?? readFileSync(examplePath, 'utf8');
const secret = () => randomBytes(32).toString('base64');
let changed = existing === null;
for (const key of ['BETTER_AUTH_SECRET', 'WAYPOINT_KEK']) {
  const re = new RegExp(`^${key}=(.*)$`, 'm');
  const m = text.match(re);
  if (!m) {
    text += `\n${key}=${secret()}\n`;
    changed = true;
  } else if (!m[1].trim()) {
    text = text.replace(re, `${key}=${secret()}`);
    changed = true;
  }
}
if (changed) {
  try {
    writeFileSync(envPath, text, { mode: 0o600, flag: existing === null ? 'wx' : 'w' });
    ok('Wrote .env.local with new secrets (keep this file private and back up WAYPOINT_KEK)');
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    fail('.env.local appeared while this ran, and was left as it is. Run pnpm setup again.');
  }
} else {
  ok('.env.local already has its secrets');
}

// 4. AI status
const has = (k) => new RegExp(`^${k}=[ \\t]*[^\\s#]`, 'm').test(text);
const providers = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OLLAMA_BASE_URL',
].filter(has);
if (providers.length) ok(`AI provider configured: ${providers.join(', ')}`);
else
  warn(
    'No AI provider key yet — Waypoint will run in guided mode. To turn on the AI companion, add ANTHROPIC_API_KEY (or OPENAI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / OLLAMA_BASE_URL) to .env.local.',
  );

console.log(`
Next:
  pnpm dev        start Waypoint at http://localhost:3000
  pnpm doctor     check everything is healthy
`);
