/**
 * Minimal structured logger (JSON lines on stdout/stderr). Never log message text, emails,
 * phone numbers or anything a person typed — ids, codes and timings only.
 */
import { getEnv } from '@waypoint/core/env';
import { scrubLogText } from '@waypoint/core/privacy';

const LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100,
} as const;
type Level = Exclude<keyof typeof LEVELS, 'silent'>;

function threshold(): number {
  try {
    return LEVELS[getEnv().LOG_LEVEL];
  } catch {
    return LEVELS.info;
  }
}

function write(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (LEVELS[level] < threshold()) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields });
  if (LEVELS[level] >= LEVELS.warn) process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => write('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};

/**
 * What to log about an error: its kind, database error code and a scrubbed message (statement
 * values, one-time tokens, addresses and numbers removed), and where it happened.
 */
export function errorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    const code =
      (err as { code?: unknown }).code ??
      (cause && typeof cause === 'object' ? (cause as { code?: unknown }).code : undefined);
    return {
      err: err.name,
      ...(typeof code === 'string' ? { code } : {}),
      errMessage: scrubLogText(err.message, 300),
      // The first line of a stack repeats the message: only the frames are kept.
      stack: err.stack
        ?.split('\n')
        .filter((l) => l.trimStart().startsWith('at '))
        .slice(0, 6)
        .map((l) => l.trim())
        .join(' | '),
    };
  }
  return { err: scrubLogText(String(err), 300) };
}
