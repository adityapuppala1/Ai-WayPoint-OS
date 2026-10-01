import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-auth-'));
process.env.WAYPOINT_DATA_DIR = dir;
process.env.WAYPOINT_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
delete process.env.DATABASE_URL;

let authMod: typeof import('../src');
let db: typeof import('@waypoint/db');
let privacy: typeof import('@waypoint/core/privacy');

beforeAll(async () => {
  db = await import('@waypoint/db');
  authMod = await import('../src');
  privacy = await import('@waypoint/core/privacy');
  await db.dbReady();
}, 120_000);

afterAll(async () => {
  await db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const PASSWORD = 'correct horse battery';

const cookieFrom = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

/** A guest session with one sealed goal in it, as the web app would have after a visit. */
async function guestWithGoal(title: string) {
  const auth = authMod.getAuth();
  const guest = await auth.api.signInAnonymous({ headers: new Headers(), returnHeaders: true });
  const cookie = cookieFrom(guest.headers);
  const guestId = guest.response?.user.id as string;
  const d = db.getDb();
  const [gp] = await d.select().from(db.profiles).where(db.eq(db.profiles.userId, guestId));
  const dek = privacy.openDek(gp!.dekWrapped!);
  const goalId = crypto.randomUUID();
  await d.insert(db.goals).values({
    id: goalId,
    userId: guestId,
    titleCt: privacy.sealFor(dek, title, privacy.SEALED.goal, guestId, goalId),
    area: 'path',
  });
  return { cookie, guestId, goalId };
}

/** What following the link in the confirmation email does. */
const confirm = (userId: string) =>
  db.getDb().update(db.users).set({ emailVerified: true }).where(db.eq(db.users.id, userId));

const signIn = (email: string, headers: Record<string, string> = {}) =>
  authMod.getAuth().api.signInEmail({
    body: { email, password: PASSWORD },
    headers: new Headers(headers),
    returnHeaders: true,
  });

const userRow = async (id: string) =>
  (await db.getDb().select().from(db.users).where(db.eq(db.users.id, id)))[0];

const goalsOf = (userId: string) =>
  db.getDb().select().from(db.goals).where(db.eq(db.goals.userId, userId));

describe('which endpoint a request names', () => {
  it('ignores case, encoding and repeated or trailing slashes, and answers at once', () => {
    const { authEndpoint } = authMod;
    expect(authEndpoint('/api/auth//Sign-Up/email/')).toBe('/sign-up/email');
    expect(authEndpoint('/api/auth/%2Fsign-in%2F%2Femail')).toBe('/sign-in/email');
    expect(authEndpoint('/api/auth///')).toBe('/');
    expect(authEndpoint('/api/auth/%E0%A4%A')).toBeNull();
    const started = performance.now();
    expect(authEndpoint(`/api/auth/${'/'.repeat(50_000)}x${'/'.repeat(50_000)}`)).toBe('/x');
    expect(performance.now() - started).toBeLessThan(250);
  });
});

describe('creating an account', () => {
  it('creates a profile with a wrapped data key', async () => {
    const auth = authMod.getAuth();
    const res = await auth.api.signUpEmail({
      body: { email: 'amina@example.org', password: PASSWORD, name: 'Amina' },
      headers: new Headers({
        'accept-language': 'sw-KE,sw;q=0.9',
        cookie: 'wp-tz=Africa%2FNairobi',
      }),
    });
    expect(res.token).toBeNull();
    const [profile] = await db
      .getDb()
      .select()
      .from(db.profiles)
      .where(db.eq(db.profiles.userId, res.user.id));
    expect(profile?.locale).toBe('sw');
    expect(profile?.timezone).toBe('Africa/Nairobi');
    expect(profile?.dekWrapped).toMatch(/^k[0-9a-f]{8}:v1\./);
    expect(privacy.openDek(profile!.dekWrapped!)).toHaveLength(32);
  });

  it('can be signed in to only once the address is confirmed', async () => {
    const auth = authMod.getAuth();
    const res = await auth.api.signUpEmail({
      body: { email: 'kofi@example.org', password: PASSWORD, name: 'Kofi' },
      headers: new Headers(),
    });
    await expect(signIn('kofi@example.org')).rejects.toMatchObject({
      body: { code: 'EMAIL_NOT_VERIFIED' },
    });
    await confirm(res.user.id);
    const ok = await signIn('kofi@example.org');
    expect(ok.response.token).toBeTruthy();
  });

  it('answers the same for an address that already has an account, and emails its owner once a day', async () => {
    const auth = authMod.getAuth();
    const again = () =>
      auth.api.signUpEmail({
        body: { email: 'Amina@Example.org', password: 'someone else entirely', name: 'Not Amina' },
        headers: new Headers(),
      });
    const first = await again();
    expect(first.token).toBeNull();
    await again();
    const notes = (await db.getDb().select().from(db.outbox)).filter(
      (m) => m.payload.template === 'account-exists',
    );
    expect(notes).toHaveLength(1);
    expect(privacy.openWithKek(notes[0]!.recipientRef, 'outbox')).toBe('amina@example.org');
    // Nothing about the account changed.
    const [owner] = await db
      .getDb()
      .select()
      .from(db.users)
      .where(db.eq(db.users.email, 'amina@example.org'));
    expect(owner?.name).toBe('Amina');
  });

  it('refuses the placeholder addresses guests and phone accounts use', async () => {
    const auth = authMod.getAuth();
    await expect(
      auth.api.signUpEmail({
        body: { email: 'temp-1@guest.waypoint.invalid', password: PASSWORD, name: 'X' },
        headers: new Headers(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('counts a password reset as confirming the address', async () => {
    const auth = authMod.getAuth();
    const res = await auth.api.signUpEmail({
      body: { email: 'lin@example.org', password: PASSWORD, name: 'Lin' },
      headers: new Headers(),
    });
    await auth.api.requestPasswordReset({
      body: { email: 'lin@example.org', redirectTo: '/reset-password' },
      headers: new Headers(),
    });
    // The token is only in the emailed link: the database keeps a keyed hash of it, so reading
    // the table gives nobody a link they could use.
    const [row] = await db
      .getDb()
      .select()
      .from(db.verifications)
      .where(db.eq(db.verifications.value, res.user.id));
    expect(row?.identifier).toBeTruthy();
    expect(row?.identifier).not.toContain('reset-password:');
    const queued = await db.getDb().execute<{ payload: Record<string, unknown> }>(
      db.sql`select payload from outbox where payload->>'template' = 'reset-password'
             and payload->>'userId' = ${res.user.id}`,
    );
    const link = String(db.openOutboxPayload(queued.rows[0]?.payload ?? {}).url ?? '');
    const token = /\/reset-password\/([^/?]+)/.exec(link)?.[1] ?? '';
    expect(token).toBeTruthy();
    expect(row?.identifier).not.toContain(token);
    await auth.api.resetPassword({
      body: { newPassword: 'a brand new long password', token },
      headers: new Headers(),
    });
    expect((await userRow(res.user.id))?.emailVerified).toBe(true);
  });
});

describe('what a guest did', () => {
  it('moves into the account created from that guest, at its first sign-in on the device', async () => {
    const auth = authMod.getAuth();
    const { cookie, guestId, goalId } = await guestWithGoal('Finish SQL course');
    const d = db.getDb();
    const [gp] = await d.select().from(db.profiles).where(db.eq(db.profiles.userId, guestId));
    const entryId = crypto.randomUUID();
    await d.insert(db.journalEntries).values({
      id: entryId,
      userId: guestId,
      bodyCt: privacy.sealFor(
        privacy.openDek(gp!.dekWrapped!),
        'first entry',
        privacy.SEALED.journal,
        guestId,
        entryId,
      ),
    });

    // The API adds the guest header only after checking the session is a guest's.
    const signUp = await auth.api.signUpEmail({
      body: { email: 'guest-upgrade@example.org', password: PASSWORD, name: 'Ravi' },
      headers: new Headers({ cookie, [authMod.AUTH_GUEST_HEADER]: guestId }),
    });
    const accountId = signUp.user.id;
    const [created] = await d
      .select()
      .from(db.profiles)
      .where(db.eq(db.profiles.userId, accountId));
    expect(created?.guestOrigin).toBe(guestId);
    // Nothing moves before the address is confirmed and the account signed in to.
    expect(await goalsOf(accountId)).toHaveLength(0);

    await confirm(accountId);
    await signIn('guest-upgrade@example.org', { cookie });

    const goals = await goalsOf(accountId);
    expect(goals).toHaveLength(1);
    const [entry] = await d
      .select()
      .from(db.journalEntries)
      .where(db.eq(db.journalEntries.id, entryId));
    expect(entry?.userId).toBe(accountId);
    const [np] = await d.select().from(db.profiles).where(db.eq(db.profiles.userId, accountId));
    const nDek = privacy.openDek(np!.dekWrapped!);
    expect(privacy.openFor(nDek, entry!.bodyCt, privacy.SEALED.journal, accountId, entryId)).toBe(
      'first entry',
    );
    // Goals are re-encrypted for the account's key too.
    expect(privacy.openFor(nDek, goals[0]!.titleCt, privacy.SEALED.goal, accountId, goalId)).toBe(
      'Finish SQL course',
    );
    expect(np?.guestOrigin).toBeNull();
    expect(await userRow(guestId)).toBeUndefined();
  });

  it('is deleted, not moved, when someone signs in to a different account on the device', async () => {
    const auth = authMod.getAuth();
    const owner = await auth.api.signUpEmail({
      body: { email: 'shared-phone@example.org', password: PASSWORD, name: 'Owner' },
      headers: new Headers(),
    });
    await confirm(owner.user.id);
    const { cookie, guestId } = await guestWithGoal('Someone else’s private goal');

    await signIn('shared-phone@example.org', { cookie });

    expect(await goalsOf(owner.user.id)).toHaveLength(0);
    expect(await goalsOf(guestId)).toHaveLength(0);
    expect(await userRow(guestId)).toBeUndefined();
  });

  it('comes along into another account when the person asks for it', async () => {
    const auth = authMod.getAuth();
    const owner = await auth.api.signUpEmail({
      body: { email: 'returning@example.org', password: PASSWORD, name: 'Returning' },
      headers: new Headers(),
    });
    await confirm(owner.user.id);
    const { cookie } = await guestWithGoal('Visit the job centre');

    await signIn('returning@example.org', { cookie, [authMod.KEEP_GUEST_HEADER]: '1' });

    expect(await goalsOf(owner.user.id)).toHaveLength(1);
  });

  it('is never tied to an account by a guest header naming someone who isn’t a guest', async () => {
    const auth = authMod.getAuth();
    const other = await auth.api.signUpEmail({
      body: { email: 'real-person@example.org', password: PASSWORD, name: 'Real' },
      headers: new Headers(),
    });
    for (const [email, forged] of [
      ['forged-1@example.org', other.user.id],
      ['forged-2@example.org', crypto.randomUUID()],
      ['forged-3@example.org', 'not-an-id'],
    ] as const) {
      const res = await auth.api.signUpEmail({
        body: { email, password: PASSWORD, name: 'Forger' },
        headers: new Headers({ [authMod.AUTH_GUEST_HEADER]: forged }),
      });
      const [p] = await db
        .getDb()
        .select()
        .from(db.profiles)
        .where(db.eq(db.profiles.userId, res.user.id));
      expect(p?.guestOrigin, forged).toBeNull();
    }
  });
});

describe('the auth library’s own limits in a shared database', () => {
  it('count a visitor without keeping their address', async () => {
    const storage = authMod.hashedRateLimitStorage();
    const key = '203.0.113.9|/sign-in/email';
    const rule = { window: 60, max: 2 };
    expect((await storage.consume(key, rule)).allowed).toBe(true);
    expect((await storage.consume(key, rule)).allowed).toBe(true);
    const third = await storage.consume(key, rule);
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
    // Another visitor has an allowance of their own.
    expect((await storage.consume('203.0.113.10|/sign-in/email', rule)).allowed).toBe(true);
    const stored = await db.getDb().execute(db.sql`select key from rate_limits`);
    expect(stored.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(stored.rows)).not.toContain('203.0.113');
  });
});
