/**
 * The Waypoint HTTP API. One Hono app serves every client (web, mobile, messaging channels)
 * and runs inside Next.js during development or as its own service in production.
 */
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
import { dbReady, getDb } from '@waypoint/db';
import { isLocale, LOCALE_COOKIE, resolveLocale } from '@waypoint/i18n';
import { bodyLimit } from 'hono/body-limit';
import { getCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { errorFields, log } from './lib/log';
import { ApiError, problemResponse } from './lib/problem';
import { clientAddress, keyedHash, rateLimit } from './lib/request';
import { withSession } from './middleware';
import admin from './routes/admin';
import ask from './routes/ask';
import channels from './routes/channels';
import circles from './routes/circles';
import civic from './routes/civic';
import goals from './routes/goals';
import health from './routes/health';
import me from './routes/me';
import mind from './routes/mind';
import money from './routes/money';
import org from './routes/org';
import path from './routes/path';
import shield from './routes/shield';
import signals from './routes/signals';
import support from './routes/support';
import system from './routes/system';
import today from './routes/today';
import type { AppEnv } from './types';

export const API_VERSION = '0.1.0';

/** How long creating an account or asking for a reset link takes at least, in production. */
const AUTH_ANSWER_FLOOR_MS = 900;

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
    await dbReady();
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
      await rateLimit(db, `otp-send:${number}`, { windowSeconds: 3600, max: 3 });
      await rateLimit(db, `otp-send-day:${number}`, { windowSeconds: 86_400, max: 6 });
      await rateLimit(db, 'otp-send:all', { windowSeconds: 3600, max: 300 });
    } else {
      await rateLimit(db, `otp-verify:${number}`, { windowSeconds: 3600, max: 10 });
    }
    return next();
  });
  // Password guesses are limited per account as well as per visitor, so spreading guesses
  // over many addresses doesn't help. Unknown addresses count the same way, so the limit
  // itself says nothing about who has an account.
  app.use('/auth/sign-in/email', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    const body = (await c.req.raw
      .clone()
      .json()
      .catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email)
      await rateLimit(c.get('db'), `sign-in:${keyedHash(email, 'sign-in')}`, {
        windowSeconds: 900,
        max: 20,
      });
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
    const request = new Request(raw, { headers, duplex: 'half' } as RequestInit);
    const response = await getAuth().handler(request);

    // The answers that must not tell anyone whether an address has an account also take the
    // same time: a new address costs more work than a known one.
    if ((signUp || resetRequest) && getEnv().isProd) {
      const wait = AUTH_ANSWER_FLOOR_MS - (performance.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
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
  app.route('/', admin);
  app.route('/', channels);

  app.openAPIRegistry.registerComponent('securitySchemes', 'session', {
    type: 'apiKey',
    in: 'cookie',
    name: 'waypoint.session_token',
    description: 'Session cookie set by /api/auth (guest sessions included).',
  });

  app.doc31('/openapi.json', (c) => ({
    openapi: '3.1.0',
    info: {
      title: 'Waypoint API',
      version: API_VERSION,
      description:
        'See what’s coming. Know your next step. Never take it alone. Authentication endpoints are documented at /api/auth/reference.',
      license: { name: 'Proprietary' },
    },
    servers: [{ url: new URL(c.req.url).origin }],
    security: [{ session: [] }],
  }));

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
