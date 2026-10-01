#!/usr/bin/env node
/**
 * A repeatable load test for Waypoint. No dependencies: Node 22 or newer.
 *
 *   node infra/load/run.mjs --url http://localhost:3000
 *   node infra/load/run.mjs --url http://web:3000 --duration 30 --connections 50 --scenario shield
 *
 * Run it against a test installation, never against one people are using: it creates guest
 * sessions and sends thousands of requests. Each virtual visitor sends its own address in
 * X-Real-IP and X-Forwarded-For, so the per-visitor limits behave as they would for that many
 * separate people — which only works when the test reaches the app directly, not through a
 * proxy that overwrites those headers (as a production proxy must).
 *
 * Scenarios (each runs for --duration seconds with --connections visitors at once):
 *   health    GET /api/health                  the floor: the server and nothing else
 *   ready     GET /api/ready                   one round trip to the database
 *   welcome   GET /welcome                     a server-rendered page
 *   support   GET /api/support?country=KE      help lines, no session
 *   shield    POST /api/shield/check           the scam rules engine, no session
 *   today     GET /api/today                   a guest's Today: session + several queries
 *   visitor   a first visit: guest session, Today, help lines, a scam check, Today again
 *
 * Results are printed and written to infra/load/results/<time>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--'))
      pairs.push([arg.slice(2), all[i + 1]?.startsWith('--') ? 'true' : (all[i + 1] ?? 'true')]);
    return pairs;
  }, []),
);
const base = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const duration = Number(args.duration ?? 20);
const connections = Number(args.connections ?? 20);
const only = args.scenario ?? 'all';
const origin = args.origin ?? new URL(base).origin;

const SCAM =
  'Your parcel is held at customs. Pay the release fee of 2.99 today or it will be returned: http://bit.ly/pay-fee-now';

/** A visitor's own address: every virtual visitor is a different person to the rate limits. */
const address = (visitor, n = 0) => `10.${(visitor >> 8) & 255}.${visitor & 255}.${1 + (n % 250)}`;

const headersFor = (visitor, n, extra = {}) => ({
  'x-real-ip': address(visitor, n),
  'x-forwarded-for': address(visitor, n),
  origin,
  ...extra,
});

async function guest(visitor) {
  const res = await fetch(`${base}/api/auth/sign-in/anonymous`, {
    method: 'POST',
    headers: headersFor(visitor, 0, { 'content-type': 'application/json' }),
    body: '{}',
  });
  await res.arrayBuffer();
  if (!res.ok) throw new Error(`guest session refused: ${res.status}`);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

const get = (path) => async (visitor, _n, state) => {
  const res = await fetch(`${base}${path}`, {
    headers: headersFor(visitor, 0, state.cookie ? { cookie: state.cookie } : {}),
  });
  await res.arrayBuffer();
  return res.status;
};

const shield = async (visitor, n) => {
  // A new address each time: this measures the rules engine, not the per-visitor limit.
  const res = await fetch(`${base}/api/shield/check`, {
    method: 'POST',
    headers: headersFor(visitor, n, { 'content-type': 'application/json' }),
    body: JSON.stringify({ text: `${SCAM} (${visitor}-${n})`, country: 'KE' }),
  });
  await res.arrayBuffer();
  return res.status;
};

const SCENARIOS = {
  health: { request: get('/api/health') },
  ready: { request: get('/api/ready') },
  welcome: { request: get('/welcome') },
  support: { request: get('/api/support?country=KE') },
  shield: { request: shield },
  today: {
    setup: async (visitor) => ({ cookie: await guest(visitor) }),
    request: get('/api/today'),
  },
  visitor: {
    // One whole first visit per round; every request in it is timed on its own.
    setup: async () => ({ round: 0 }),
    request: async (visitor, _n, state, record) => {
      const step = async (run) => {
        const started = performance.now();
        const status = await run();
        record(status, performance.now() - started);
      };
      state.round += 1;
      // A different person each round (a new address and a new guest session).
      const who = visitor * 1000 + state.round;
      let cookie = '';
      await step(async () => {
        const res = await fetch(`${base}/api/auth/sign-in/anonymous`, {
          method: 'POST',
          headers: headersFor(who, 0, { 'content-type': 'application/json' }),
          body: '{}',
        });
        await res.arrayBuffer();
        cookie = res.headers
          .getSetCookie()
          .map((c) => c.split(';')[0])
          .join('; ');
        return res.status;
      });
      const mine = { cookie };
      await step(() => get('/api/today')(who, 0, mine));
      await step(() => get('/api/support?country=KE')(who, 0, mine));
      await step(() => shield(who, state.round));
      await step(() => get('/api/today')(who, 0, mine));
      return null;
    },
  },
};

const percentile = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0;

async function run(name) {
  const scenario = SCENARIOS[name];
  const latencies = [];
  const statuses = {};
  let failures = 0;
  const record = (status, ms) => {
    latencies.push(ms);
    statuses[status] = (statuses[status] ?? 0) + 1;
  };
  const states = await Promise.all(
    Array.from({ length: connections }, (_, v) => scenario.setup?.(v) ?? {}),
  );
  // A short warm-up so the first compile of a route is not counted.
  await Promise.all(
    states
      .slice(0, Math.min(4, connections))
      .map((state, v) => scenario.request(v, 0, state, () => undefined).catch(() => undefined)),
  );
  const started = performance.now();
  const until = started + duration * 1000;
  await Promise.all(
    states.map(async (state, visitor) => {
      for (let n = 1; performance.now() < until; n++) {
        const t = performance.now();
        try {
          const status = await scenario.request(visitor, n, state, record);
          if (status !== null) record(status, performance.now() - t);
        } catch {
          failures += 1;
        }
      }
    }),
  );
  const seconds = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  const ok = Object.entries(statuses)
    .filter(([s]) => Number(s) >= 200 && Number(s) < 400)
    .reduce((sum, [, n]) => sum + n, 0);
  const round = (n) => Math.round(n * 10) / 10;
  return {
    scenario: name,
    requests: latencies.length,
    perSecond: round(latencies.length / seconds),
    p50: round(percentile(latencies, 50)),
    p95: round(percentile(latencies, 95)),
    p99: round(percentile(latencies, 99)),
    max: round(latencies.at(-1) ?? 0),
    errors: latencies.length - ok + failures,
    statuses,
  };
}

const names = only === 'all' ? Object.keys(SCENARIOS) : only.split(',');
for (const name of names)
  if (!SCENARIOS[name]) {
    console.error(`Unknown scenario "${name}". One of: ${Object.keys(SCENARIOS).join(', ')}`);
    process.exit(1);
  }

console.log(`Waypoint load test: ${base}`);
console.log(`${connections} visitors at once, ${duration} s per scenario\n`);
console.log('scenario    requests   req/s    p50 ms   p95 ms   p99 ms   max ms   errors');
const results = [];
for (const name of names) {
  const r = await run(name);
  results.push(r);
  console.log(
    [
      r.scenario.padEnd(10),
      String(r.requests).padStart(9),
      String(r.perSecond).padStart(7),
      String(r.p50).padStart(9),
      String(r.p95).padStart(8),
      String(r.p99).padStart(8),
      String(r.max).padStart(8),
      String(r.errors).padStart(8),
    ].join(' '),
  );
}

const out = join(dirname(fileURLToPath(import.meta.url)), 'results');
mkdirSync(out, { recursive: true });
const file = join(out, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(
  file,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      url: base,
      duration,
      connections,
      node: process.version,
      client: {
        cpus: cpus().length,
        cpu: cpus()[0]?.model,
        memoryGb: Math.round(totalmem() / 2 ** 30),
      },
      results,
    },
    null,
    2,
  ),
);
console.log(`\nSaved to ${file}`);
const failed = results.filter((r) => r.errors > r.requests * 0.01);
if (failed.length) {
  console.log(`\nMore than 1% errors in: ${failed.map((r) => r.scenario).join(', ')}`);
  process.exitCode = 1;
}
