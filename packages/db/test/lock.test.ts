import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'waypoint-lock-'));
process.env.WAYPOINT_DATA_DIR = dir;
delete process.env.DATABASE_URL;
process.env.WAYPOINT_AUTO_SEED = 'false';

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('the embedded database’s lock', () => {
  it('refuses a directory another process has open, and takes over one left behind', async () => {
    const m = await import('../src');
    const lock = join(dir, 'pglite.lock');
    // The process that started this test is alive, and is not this one.
    writeFileSync(lock, String(process.ppid));
    expect(() => m.getDb()).toThrow(/already open in another process/);
    expect(readFileSync(lock, 'utf8')).toBe(String(process.ppid));

    // A process that has ended leaves its lock behind: it is taken over, and let go on close.
    writeFileSync(lock, '2147483646');
    await m.dbReady();
    expect(readFileSync(lock, 'utf8')).toBe(String(process.pid));
    await m.closeDb();
    expect(existsSync(lock)).toBe(false);

    // With no lock at all, one is made.
    await m.dbReady();
    expect(readFileSync(lock, 'utf8')).toBe(String(process.pid));
    await m.closeDb();
  }, 120_000);
});
