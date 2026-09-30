/**
 * The Waypoint HTTP API. One Hono app serves every client (web, mobile, messaging channels)
 * and runs inside Next.js during development or as its own service in production.
 */
import { timingSafeEqual } from 'node:crypto';
import { OpenAPIHono } from '@hono/zod-openapi';
import {
  AUTH_CLIENT_IP_HEADER,
  AUTH_GUEST_HEADER,
  authEndpoint,
  getAuth,
  getSession,
  isBlockedAuthPath,
  KEEP_GUEST_HEADER,
} from '@waypoint/auth';
import { countryOfNumber, toE164 } from '@waypoint/core/channels';
import { getEnv } from '@waypoint/core/env';
import { isInternalPath } from '@waypoint/core/paths';
import { dbReady, getDb, sql } from '@waypoint/db';
import { isLocale, LOCALE_COOKIE, resolveLocale } from '@waypoint/i18n';
import { bodyLimit } from 'hono/body-limit';
import { getCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { errorFields, log } from './lib/log';
import { ApiError, problemResponse } from './lib/problem';
import { clientAddress, clientIp, ipHash, keyedHash, rateLimit, withinLimit } from './lib/request';
import { withSession } from './middleware';
import admin from './routes/admin';
import ask from './routes/ask';
import channels from './routes/channels';
import circles from './routes/circles';
import civic from './routes/civic';
import forecasts from './routes/forecasts';
import goals from './routes/goals';
import health from './routes/health';
import me from './routes/me';
import mind from './routes/mind';
import money from './routes/money';
import org from './routes/org';
import path from './routes/path';
import preferences, { forgetPersonalCookies } from './routes/preferences';
import shield from './routes/shield';
import signals from './routes/signals';
import support from './routes/support';
import system from './routes/system';
import today from './routes/today';
import type { AppEnv } from './types';

export const API_VERSION = '0.1.0';

/** How long creating an account or asking for a reset link takes at least, in production. */
const AUTH_ANSWER_FLOOR_MS = 900;

/** How long a failed sign-in takes at least, in production. */
const SIGN_IN_FAILURE_FLOOR_MS = 400;

/** Marks a device that has signed in to an account before (a random value and its signature). */
const DEVICE_COOKIE = 'waypoint.device';

/** The account a sign-in request is for, as a keyed hash of the address (null when unreadable). */
async function signInAccount(request: Request): Promise<string | null> {
  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return email ? keyedHash(email, 'sign-in') : null;
}

/** The device's random value when its cookie was issued for this account; otherwise null. */
function knownDevice(cookie: string | undefined, account: string): string | null {
  const [nonce = '', signature = ''] = (cookie ?? '').split('.');
  if (!/^[a-f0-9]{32}$/.test(nonce) || !signature) return null;
  return sameText(signature, keyedHash(`${account}:${nonce}`, 'device')) ? nonce : null;
}

function deviceCookie(account: string): string {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const secure = getEnv().WAYPOINT_URL.startsWith('https://') ? '; Secure' : '';
  return `${DEVICE_COOKIE}=${nonce}.${keyedHash(`${account}:${nonce}`, 'device')}; Path=/api/auth; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`;
}

/** Compared without stopping at the first difference, so timing says nothing. */
function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A path on this site ("/reset-password"), or a full address on one of its own origins. */
function onThisSite(target: string, origins: string[]): boolean {
  // Written plainly: no tabs, line breaks or backslashes that a browser would read as "//".
  if (target.startsWith('/')) return isInternalPath(target);
  try {
    const url = new URL(target);
    return (url.protocol === 'https:' || url.protocol === 'http:') && origins.includes(url.origin);
  } catch {
    return false;
  }
}

function allowedOrigins(): string[] {
  const env = getEnv();
  const list = [env.WAYPOINT_URL, env.BETTER_AUTH_URL, ...(env.WEB_ORIGINS?.split(',') ?? [])]
    .map((o) => o?.trim())
    .filter((o): o is string => Boolean(o));
  return [...new Set(list.map((o) => new URL(o).origin))];
}

export function createApp() {
  const origins = allowedOrigins();
  const app = new OpenAPIHono<AppEnv>().basePath('/api');

  app.use('*', async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
    c.set('requestId', id);
    const start = performance.now();
    await next();
    c.res.headers.set('X-Request-Id', id);
    const ms = Math.round(performance.now() - start);
    if (c.res.status >= 500)
      log.error('request failed', {
        requestId: id,
        method: c.req.method,
        route: c.req.routePath,
        status: c.res.status,
        ms,
      });
    else
      log.debug('request', {
        requestId: id,
        method: c.req.method,
        route: c.req.routePath,
        status: c.res.status,
        ms,
      });
  });

  app.use('*', async (c, next) => {
    const asked = c.req.query('locale');
    c.set(
      'locale',
      isLocale(asked)
        ? asked
        : resolveLocale(getCookie(c, LOCALE_COOKIE), c.req.header('accept-language')),
    );
    await next();
  });

  app.use('*', async (c, next) => {
    // Liveness and readiness must answer when the database does not: liveness says the
    // process is up, readiness checks the database itself and answers 503.
    if (!/\/(health|ready)$/.test(c.req.path)) await dbReady();
    c.set('db', getDb());
    await next();
  });

  // The mobile app and any separately hosted web front-end call the API cross-origin.
  app.use(
    '*',
    cors({
      origin: origins,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', KEEP_GUEST_HEADER],
      exposeHeaders: ['X-Request-Id', 'Retry-After'],
      maxAge: 600,
    }),
  );
  // Blocks cross-site form posts. Provider webhooks (SMS, WhatsApp, USSD) verify signatures instead.
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/api/channels/')) return next();
    return csrf({ origin: origins })(c, next);
  });
  app.use(
    '*',
    bodyLimit({
      maxSize: 256 * 1024,
      onError: () => problemResponse(413, 'too-large', 'That request is too large.'),
    }),
  );

  // Parts of Better Auth that would bypass Waypoint's own rules never reach it: its
  // organisation and staff endpoints (impersonation, setting passwords, listing users…) and
  // self-service deletion. They are switched off inside Better Auth as well.
  app.use('/auth/*', async (c, next) => {
    if (isBlockedAuthPath(c.req.path) || isBlockedAuthPath(new URL(c.req.url).pathname))
      return problemResponse(404, 'not-found', 'Not found.');
    return next();
  });
  // Sign-in codes by text message cost money and land on real phones: only full international
  // numbers in countries Waypoint serves, a few codes per number an hour and a day, a ceiling
  // for everyone together, and a limit on guesses per number whatever address they come from.
  app.use('/auth/phone-number/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    const sending = c.req.path.endsWith('/send-otp');
    if (!sending && !c.req.path.endsWith('/verify')) return next();
    const body = (await c.req.raw
      .clone()
      .json()
      .catch(() => null)) as { phoneNumber?: unknown } | null;
    const raw = typeof body?.phoneNumber === 'string' ? body.phoneNumber : '';
    const e164 = toE164(raw);
    if (!e164 || e164 !== raw || !countryOfNumber(e164))
      return problemResponse(
        400,
        'invalid-phone-number',
        'Enter the number in full international form, starting with + and the country code.',
      );
    const db = c.get('db');
    const number = keyedHash(e164, 'otp');
    if (sending) {
      // One visitor address can ask for codes for 60 different numbers a day. Without this, a
      // single address working through a list of numbers could use up the ceiling everyone
      // shares (and with it, phone sign-in for everyone) within the hour. Numbers are counted,
      // not codes: a phone network or an office puts many people behind one address, and each
      // of them asking again for their own number costs their neighbours nothing.
      const visitor = clientIp(c.req.raw.headers);
      if (visitor !== 'unknown') {
        const who = keyedHash(visitor, 'ip');
        const first = `otp-number:${who}:${number}`;
        if (await withinLimit(db, first, { windowSeconds: 86_400, max: 1 }))
          await rateLimit(db, `otp-numbers:${who}`, { windowSeconds: 86_400, max: 60 }).catch(
            async (err) => {
              // Refused: this number was not counted, so it is not remembered as counted.
              await db.execute(sql`delete from rate_limits where key = ${`api:${first}`}`);
              throw err;
            },
          );
      }
      await rateLimit(db, `otp-send:${number}`, { windowSeconds: 3600, max: 3 });
      await rateLimit(db, `otp-send-day:${number}`, { windowSeconds: 86_400, max: 6 });
      try {
        await rateLimit(db, 'otp-send:all', { windowSeconds: 3600, max: 300 });
      } catch (err) {
        log.warn('sign-in codes paused: the hourly ceiling for everyone was reached');
        throw err;
      }
    } else {
      await rateLimit(db, `otp-verify:${number}`, { windowSeconds: 3600, max: 10 });
    }
    return next();
  });
  // Guest sessions are free to create, and each has allowances of its own (AI answers, scam
  // checks…): an address can start a few hundred a day — a school sharing one address has
  // room — but not an endless supply.
  app.use('/auth/sign-in/anonymous', async (c, next) => {
    if (c.req.method === 'POST')
      await rateLimit(c.get('db'), `guest-day:${ipHash(c.req.raw.headers)}`, {
        windowSeconds: 86_400,
        max: 300,
      });
    return next();
  });
  // Waypoint's own apps send JSON. The auth library would also read a form, which the checks
  // below (they read the address from the JSON body) would not see: anything else is refused.
  app.use('/auth/*', async (c, next) => {
    const type = c.req.header('content-type');
    if (c.req.method === 'POST' && type && !/^application\/json\b/i.test(type.trim()))
      return problemResponse(415, 'unsupported-media-type', 'Send JSON.');
    return next();
  });
  // Password guesses are limited per account as well as per visitor, so spreading guesses
  // over many addresses doesn't help. Unknown addresses count the same way, so the limit
  // itself says nothing about who has an account. A device that has signed in to the account
  // before counts on its own, so someone guessing a password cannot lock its owner out.
  app.use('/auth/sign-in/email', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    const account = await signInAccount(c.req.raw);
    if (account) {
      const device = knownDevice(getCookie(c, DEVICE_COOKIE), account);
      await rateLimit(c.get('db'), device ? `sign-in-device:${device}` : `sign-in:${account}`, {
        windowSeconds: 900,
        max: 20,
      });
    }
    return next();
  });
  // A reset link leads back to the website and nowhere else. The phone app's own scheme is a
  // trusted origin for signing in, but on Android another app can claim that scheme and would
  // be handed the reset token.
  app.use('/auth/request-password-reset', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    const body = (await c.req.raw
      .clone()
      .json()
      .catch(() => null)) as { redirectTo?: unknown } | null;
    const to = body?.redirectTo;
    if (to !== undefined && !(typeof to === 'string' && onThisSite(to, origins)))
      return problemResponse(400, 'invalid-redirect', 'The link must lead back to this site.');
    return next();
  });
  // Better Auth owns the rest of /api/auth/* (sign-in, guest sessions, passkeys…). It learns
  // the visitor's address, and the guest session an account is being created from, from the
  // API — never from a header the visitor could set.
  app.on(['GET', 'POST'], '/auth/*', async (c) => {
    const started = performance.now();
    const raw = c.req.raw;
    const headers = new Headers(raw.headers);
    headers.delete(AUTH_CLIENT_IP_HEADER);
    headers.delete(AUTH_GUEST_HEADER);
    const address = clientAddress(raw.headers);
    if (address) headers.set(AUTH_CLIENT_IP_HEADER, address);
    const endpoint = authEndpoint(new URL(raw.url).pathname);
    const post = raw.method === 'POST';
    const signUp = post && endpoint === '/sign-up/email';
    const signIn = post && endpoint === '/sign-in/email';
    const resetRequest = post && endpoint === '/request-password-reset';
    if (signUp || (post && endpoint === '/phone-number/verify')) {
      const current = await getSession(raw.headers).catch(() => null);
      if (current?.user.isAnonymous) headers.set(AUTH_GUEST_HEADER, current.user.id);
    }
    // Read before the body is handed on: a request can only be read once.
    const account = signIn ? await signInAccount(raw) : null;
    const request = new Request(raw, { headers, duplex: 'half' } as RequestInit);
    const response = await getAuth().handler(request);

    // The answers that must not tell anyone whether an address has an account also take the
    // same time: a new address costs more work than a known one. A failed sign-in is one of
    // them (an unconfirmed address takes a different path from a wrong password).
    if ((signUp || resetRequest || (signIn && response.status !== 200)) && getEnv().isProd) {
      const floor = signIn ? SIGN_IN_FAILURE_FLOOR_MS : AUTH_ANSWER_FLOOR_MS;
      const wait = floor - (performance.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    }

    // Signing out leaves nothing of the person's on the device: their language, display
    // choices and the steps they set aside go with the session, whatever answer Better Auth
    // gave (a session that had already ended is still a person leaving).
    if (post && endpoint === '/sign-out') {
      const left = new Response(response.body, {
        status: response.status,
        headers: new Headers(response.headers),
      });
      forgetPersonalCookies(left.headers);
      return left;
    }

    // A device that signs in gets a cookie saying it has been trusted with this account
    // before (see the sign-in limit above). It names nobody: a random value and its signature.
    if (signIn && response.status === 200) {
      if (account && !knownDevice(getCookie(c, DEVICE_COOKIE), account)) {
        const trusted = new Response(response.body, {
          status: response.status,
          headers: new Headers(response.headers),
        });
        trusted.headers.append('set-cookie', deviceCookie(account));
        return trusted;
      }
    }

    // Creating an account answers exactly the same whether the address was new or already
    // had an account (the owner is emailed instead): no id, no details, no cookie. A failure
    // that could only happen for a new address (two sign-ups racing, a database error) gets
    // that same answer too; the details go to the log. Only mistakes in what was typed (400),
    // which are checked before anyone looks the address up, and "too many tries" show.
    if (signUp && (response.status === 200 || response.status === 422 || response.status >= 500)) {
      if (response.status !== 200)
        log.error('sign-up failed', { requestId: c.get('requestId'), status: response.status });
      return new Response(JSON.stringify({ token: null, user: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Signing in to an account whose address isn't confirmed yet fails like a wrong password
    // (a fresh link is still emailed): otherwise creating an account with a password you
    // chose, then signing in with it, would show whether the address already had an account.
    if (signIn && response.status === 403) {
      const failure = (await response
        .clone()
        .json()
        .catch(() => null)) as { code?: string } | null;
      if (failure?.code === 'EMAIL_NOT_VERIFIED')
        return new Response(
          JSON.stringify({
            message: 'Invalid email or password',
            code: 'INVALID_EMAIL_OR_PASSWORD',
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        );
    }
    return response;
  });

  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/api/auth/')) return next();
    return withSession(c, next);
  });

  app.route('/', system);
  app.route('/', me);
  app.route('/', preferences);
  app.route('/', today);
  app.route('/', support);
  app.route('/', shield);
  app.route('/', path);
  app.route('/', ask);
  app.route('/', signals);
  app.route('/', civic);
  app.route('/', money);
  app.route('/', goals);
  app.route('/', mind);
  app.route('/', circles);
  app.route('/', health);
  app.route('/', org);
  app.route('/', forecasts);
  app.route('/', admin);
  app.route('/', channels);

  app.openAPIRegistry.registerComponent('securitySchemes', 'session', {
    type: 'apiKey',
    in: 'cookie',
    name: 'waypoint.session_token',
    description: 'Session cookie set by /api/auth (guest sessions included).',
  });

  // The public API document: built once (not on every request from anyone), and without the
  // staff console's routes, which are nobody else's business.
  let apiDocument: string | undefined;
  app.get('/openapi.json', (c) => {
    if (!apiDocument) {
      const doc = app.getOpenAPI31Document({
        openapi: '3.1.0',
        info: {
          title: 'Waypoint API',
          version: API_VERSION,
          description:
            'See what’s coming. Know your next step. Never take it alone. Authentication endpoints are documented at /api/auth/reference.',
          license: { name: 'Proprietary' },
        },
        servers: [{ url: new URL(getEnv().WAYPOINT_URL).origin }],
        security: [{ session: [] }],
      });
      const paths = Object.fromEntries(
        Object.entries(doc.paths ?? {}).filter(([path]) => !/\/admin(\/|$)/.test(path)),
      );
      apiDocument = JSON.stringify({ ...doc, paths });
    }
    return c.body(apiDocument, 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    });
  });

  app.notFound((c) =>
    problemResponse(404, 'not-found', `No API route for ${c.req.method} ${c.req.path}.`, {
      requestId: c.get('requestId'),
    }),
  );

  app.onError((err, c) => {
    const requestId = c.get('requestId');
    if (err instanceof ApiError)
      return problemResponse(err.status, err.code, err.message, { ...err.extra, requestId });
    if (err instanceof HTTPException) {
      const status = err.status;
      return problemResponse(
        status,
        status === 403 ? 'forbidden' : 'http-error',
        err.message || undefined,
        { requestId },
      );
    }
    log.error('unhandled error', { requestId, route: c.req.routePath, ...errorFields(err) });
    return problemResponse(
      500,
      'server-error',
      'Something went wrong on our side. Your work is safe — please try again.',
      { requestId },
    );
  });

  return app;
}

export type WaypointApp = ReturnType<typeof createApp>;

let singleton: WaypointApp | undefined;

/** A fetch handler for any runtime (Next.js route handlers, Node server, tests). */
export function handleRequest(request: Request): Response | Promise<Response> {
  singleton ??= createApp();
  return singleton.fetch(request);
}
