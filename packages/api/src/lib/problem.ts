/**
 * Errors as RFC 9457 problem details. Services throw `ApiError`; the app's error handler
 * turns it into `application/problem+json`. Messages are safe to show to people — never
 * stack traces or database errors.
 */
import { z } from '@hono/zod-openapi';

export class ApiError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 503,
    public readonly code: string,
    message: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (what = 'That item') =>
  new ApiError(404, 'not-found', `${what} was not found.`);
export const forbidden = (message = 'You do not have access to this.') =>
  new ApiError(403, 'forbidden', message);
export const unauthorized = () =>
  new ApiError(401, 'unauthorized', 'Please sign in or continue as a guest first.');
export const badRequest = (message: string, extra?: Record<string, unknown>) =>
  new ApiError(400, 'bad-request', message, extra);
export const conflict = (message: string) => new ApiError(409, 'conflict', message);
export const tooMany = (retryAfterSeconds: number) =>
  new ApiError(429, 'rate-limited', 'Too many requests. Please wait a moment and try again.', {
    retryAfter: retryAfterSeconds,
  });

export const ProblemSchema = z
  .object({
    type: z.string().openapi({ example: 'https://waypoint.app/problems/not-found' }),
    title: z.string(),
    status: z.number().int(),
    code: z.string(),
    detail: z.string().optional(),
    requestId: z.string().optional(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  })
  .openapi('Problem');

export type Problem = z.infer<typeof ProblemSchema>;

const TITLES: Record<number, string> = {
  400: 'Bad request',
  401: 'Sign in required',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  413: 'Too large',
  415: 'Unsupported media type',
  422: 'Invalid input',
  429: 'Too many requests',
  500: 'Server error',
  503: 'Unavailable',
};

export function problemBody(
  status: number,
  code: string,
  detail?: string,
  extra?: Record<string, unknown>,
): Problem & Record<string, unknown> {
  return {
    type: `https://waypoint.app/problems/${code}`,
    title: TITLES[status] ?? 'Error',
    status,
    code,
    ...(detail ? { detail } : {}),
    ...(extra ?? {}),
  };
}

export function problemResponse(
  status: number,
  code: string,
  detail?: string,
  extra?: Record<string, unknown>,
): Response {
  const headers = new Headers({ 'Content-Type': 'application/problem+json' });
  if (status === 429 && typeof extra?.retryAfter === 'number')
    headers.set('Retry-After', String(extra.retryAfter));
  return new Response(JSON.stringify(problemBody(status, code, detail, extra)), {
    status,
    headers,
  });
}
