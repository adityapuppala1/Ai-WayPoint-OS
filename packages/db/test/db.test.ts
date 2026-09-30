import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-db-'));
process.env.WAYPOINT_DATA_DIR = dir;
delete process.env.DATABASE_URL;
// This suite seeds explicitly to test idempotency.
process.env.WAYPOINT_AUTO_SEED = 'false';

type Mod = typeof import('../src');
let m: Mod;
let seed: typeof import('../src/seed');

beforeAll(async () => {
  m = await import('../src');
  seed = await import('../src/seed');
  await m.dbReady();
}, 120_000);

afterAll(async () => {
  await m.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe('embedded database', () => {
  it('migrates with pgvector and pg_trgm available', async () => {
    const db = m.getDb();
    const res = await db.execute<{ extname: string }>(
      m.sql`select extname from pg_extension where extname in ('vector','pg_trgm') order by extname`,
    );
    expect(res.rows.map((r) => r.extname)).toEqual(['pg_trgm', 'vector']);
  });

  it('seeds idempotently', async () => {
    const db = m.getDb();
    const first = await seed.seedBase(db);
    const second = await seed.seedBase(db);
    expect(first.circles).toBeGreaterThan(20);
    expect(second).toEqual({ circles: 0, signals: 0 });
  });

  it('searches signals with the generated full-text column', async () => {
    const db = m.getDb();
    const rows = await db
      .select({ title: m.signals.title })
      .from(m.signals)
      .where(m.sql`${m.signals.search} @@ plainto_tsquery('simple', 'hotline')`);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('stores and ranks embeddings', async () => {
    const db = m.getDb();
    const userId = 'u-test';
    await db.insert(m.users).values({ id: userId, name: 'Test', email: 'test@example.org' });
    const vec = (hot: number) =>
      Array.from({ length: m.EMBEDDING_DIMENSIONS }, (_, i) => (i === hot ? 1 : 0));
    await db.insert(m.memories).values([
      { userId, kind: 'fact', content: 'wants a data job', embedding: vec(1) },
      { userId, kind: 'fact', content: 'lives near the coast', embedding: vec(2) },
    ]);
    const q = `[${vec(1).join(',')}]`;
    const [top] = await db
      .select({ content: m.memories.content })
      .from(m.memories)
      .orderBy(m.sql`${m.memories.embedding} <=> ${q}::vector`)
      .limit(1);
    expect(top?.content).toBe('wants a data job');
  });

  it('cascades deletes from users', async () => {
    const db = m.getDb();
    await db.delete(m.users).where(m.eq(m.users.id, 'u-test'));
    const left = await db.select().from(m.memories);
    expect(left).toHaveLength(0);
  });
});
