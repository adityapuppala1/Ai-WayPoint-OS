/** Browser-side API calls with problem-details errors. */
export interface ProblemIssue {
  path: string;
  message: string;
}

export class ApiProblem extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: ProblemIssue[] = [],
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiProblem';
  }
}

export async function api<T>(
  path: string,
  init: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    json?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.json !== undefined ? 'POST' : 'GET'),
      headers: init.json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      credentials: 'same-origin',
      signal: init.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiProblem(0, 'network', 'network');
  }
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  let body: {
    code?: string;
    detail?: string;
    title?: string;
    issues?: ProblemIssue[];
    retryAfter?: number;
  } = {};
  try {
    body = await res.json();
  } catch {
    // not JSON
  }
  throw new ApiProblem(
    res.status,
    body.code ?? 'error',
    body.detail ?? body.title ?? res.statusText,
    body.issues,
    body.retryAfter,
  );
}

/** A UUID v4, with a fallback for browsers without crypto.randomUUID (non-secure contexts). */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Which `errors.*` message fits a failed call. */
export function problemKey(err: unknown): 'network' | 'tooMany' | 'generic' {
  if (err instanceof ApiProblem) {
    if (err.status === 0) return 'network';
    if (err.status === 429) return 'tooMany';
  }
  return 'generic';
}

/**
 * Which `admin.*` message says why a second check on a verdict was refused (a colleague was
 * quicker, it is this person's own verdict, or there is nothing to confirm yet). The server's
 * own words for these are English only. Null for any other failure.
 */
export function secondCheckRefusal(err: unknown): 'cAlready' | 'cOwnVerdict' | 'cNotJudged' | null {
  if (!(err instanceof ApiProblem)) return null;
  if (err.code === 'checked') return 'cAlready';
  if (err.code === 'same-person') return 'cOwnVerdict';
  if (err.code === 'not-judged') return 'cNotJudged';
  return null;
}
