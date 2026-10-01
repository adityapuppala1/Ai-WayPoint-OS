/** Request helpers: client IP (hashed, never stored raw), hashing and rate limiting. */
import { createHash, createHmac } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import { devSecret, getEnv } from '@waypoint/core/env';
import { newId } from '@waypoint/core/ids';
import { type Database, sql } from '@waypoint/db';
import { ApiError, tooMany } from './problem';

/** One address from a forwarding header: brackets, ports and IPv4-in-IPv6 are unwrapped. */
function cleanAddress(raw: string): string | null {
  let a = raw.trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(a);
  if (bracketed?.[1]) a = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(a)) a = a.slice(0, a.lastIndexOf(':'));
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(a);
  if (mapped?.[1]) a = mapped[1];
  return isIP(a) ? a.toLowerCase() : null;
}

/**
 * An IPv6 address as its /64 network: one home or phone gets a whole /64, so limiting single
 * addresses would let anyone step around a limit by changing the last half.
 */
export function ipv6Network(address: string): string {
  let a = address.toLowerCase();
  const dotted = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (dotted) {
    const [p, q, r, s] = dotted.slice(1).map(Number) as [number, number, number, number];
    a = `${a.slice(0, dotted.index)}${((p << 8) | q).toString(16)}:${((r << 8) | s).toString(16)}`;
  }
  const [head = '', tail] = a.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups
    .slice(0, 4)
    .map((g) => Number.parseInt(g || '0', 16).toString(16))
    .join(':')}::/64`;
}

let proxyCache: { raw: string; list: BlockList | null } | undefined;

/** TRUSTED_PROXIES as a lookup list (addresses and CIDR ranges); null when none are set. */
function trustedProxies(): BlockList | null {
  const raw = getEnv().TRUSTED_PROXIES ?? '';
  if (proxyCache?.raw === raw) return proxyCache.list;
  const list = new BlockList();
  let added = 0;
  for (const entry of raw.split(',').map((e) => e.trim())) {
    const [address = '', bits] = entry.split('/');
    const family = isIP(address);
    if (!family) continue;
    const type = family === 6 ? 'ipv6' : 'ipv4';
    if (bits === undefined) list.addAddress(address, type);
    else {
      const prefix = Number(bits);
      if (!Number.isInteger(prefix) || prefix < 0 || prefix > (family === 6 ? 128 : 32)) continue;
      list.addSubnet(address, prefix, type);
    }
    added++;
  }
  proxyCache = { raw, list: added ? list : null };
  return proxyCache.list;
}

/**
 * The visitor's address, from the one header your own edge sets (WAYPOINT_CLIENT_IP_HEADER,
 * X-Forwarded-For by default); any other forwarding header a visitor sends is ignored. In
 * X-Forwarded-For the right-most entry is the one the nearest proxy saw; with TRUSTED_PROXIES
 * set, trusted hops are skipped from the right. IPv6 addresses count as their /64 network.
 */
export function clientIp(headers: Headers): string {
  const chosen = clientAddress(headers);
  if (!chosen) return 'unknown';
  return isIP(chosen) === 6 ? ipv6Network(chosen) : chosen;
}

/** The visitor's own address as clientIp() finds it, before IPv6 is widened to its /64. */
export function clientAddress(headers: Headers): string | null {
  const value = headers.get(getEnv().clientIpHeader);
  if (!value) return null;
  const hops = value.split(',').map(cleanAddress);
  const proxies = trustedProxies();
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = hops[i];
    if (!hop) return null;
    if (proxies?.check(hop, isIP(hop) === 6 ? 'ipv6' : 'ipv4')) continue;
    return hop;
  }
  return null;
}

let salt: string | undefined;
function hashSalt(): string {
  if (salt) return salt;
  const env = getEnv();
  salt = env.BETTER_AUTH_SECRET ?? devSecret('BETTER_AUTH_SECRET');
  return salt;
}

/** A keyed hash, so identifiers can be matched without being stored or reversed. */
export function keyedHash(value: string, purpose: string): string {
  return createHmac('sha256', hashSalt())
    .update(`${purpose}:${value}`)
    .digest('base64url')
    .slice(0, 32);
}

/**
 * A number in (0, 1) derived from a keyed hash: the same input always gives the same number,
 * but nobody without the server secret can predict it (used for privacy noise).
 */
export function keyedUniform(value: string, purpose: string): number {
  const digest = createHmac('sha256', hashSalt()).update(`${purpose}:${value}`).digest();
  return (digest.readUIntBE(0, 6) + 0.5) / 2 ** 48;
}

export const ipHash = (headers: Headers) => keyedHash(clientIp(headers), 'ip');

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Fixed-window rate limit shared by every server instance (stored in Postgres, in the same
 * table Better Auth uses, under an `api:` prefix). Throws a 429 ApiError when exceeded.
 */
export async function rateLimit(
  db: Database,
  key: string,
  opts: { windowSeconds: number; max: number },
): Promise<void> {
  const now = Date.now();
  const windowStart = now - opts.windowSeconds * 1000;
  const fullKey = `api:${key}`;
  const res = await db.execute<{ count: number | string; last_request: number | string }>(sql`
    insert into rate_limits (id, key, count, last_request)
    values (${newId()}, ${fullKey}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limits.last_request < ${windowStart} then 1 else rate_limits.count + 1 end,
      last_request = case when rate_limits.last_request < ${windowStart} then ${now} else rate_limits.last_request end
    returning count, last_request`);
  const row = res.rows[0];
  if (!row) return;
  const count = Number(row.count);
  if (count > opts.max) {
    const resetAt = Number(row.last_request) + opts.windowSeconds * 1000;
    throw tooMany(Math.max(1, Math.ceil((resetAt - now) / 1000)));
  }
}

/** Like rateLimit, but answers false instead of throwing when the limit is reached. */
export async function withinLimit(
  db: Database,
  key: string,
  opts: { windowSeconds: number; max: number },
): Promise<boolean> {
  try {
    await rateLimit(db, key, opts);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) return false;
    throw err;
  }
}

/**
 * AI answers a day for all the guests at one visitor address together. A guest session costs
 * nothing to create, so a per-person limit alone would let one machine spend the AI budget
 * through any number of them. People with accounts have their own allowance instead.
 */
export const GUEST_AI_PER_ADDRESS_DAY = 40;

/** Draws one answer from the visitor address's allowance; false when it is used up. */
export function guestAiGate(db: Database, headers: Headers): () => Promise<boolean> {
  return () =>
    withinLimit(db, `ai-visitor:${ipHash(headers)}`, {
      max: GUEST_AI_PER_ADDRESS_DAY,
      windowSeconds: 86_400,
    });
}

/**
 * The limit the API's `limit()` middleware applies, for server-rendered pages that call
 * services directly (join, poster and invitation pages): per person when signed in, otherwise
 * per visitor address. Throws a 429 ApiError when exceeded.
 */
export async function limitVisitor(
  db: Database,
  name: string,
  visitor: { headers: Headers; userId: string | null },
  opts: { windowSeconds: number; max: number },
): Promise<void> {
  const who = visitor.userId
    ? `u:${visitor.userId}`
    : `ip:${keyedHash(clientIp(visitor.headers), 'ip')}`;
  await rateLimit(db, `${name}:${who}`, opts);
}
