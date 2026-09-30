/** Small helpers so route definitions stay short and consistent. */
import { OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '../types';
import { ProblemSchema } from './problem';

export const jsonContent = <T extends z.ZodType>(schema: T, description = 'OK') => ({
  content: { 'application/json': { schema } },
  description,
});

export const jsonBody = <T extends z.ZodType>(schema: T) => ({
  body: { content: { 'application/json': { schema } }, required: true },
});

const problem = (description: string) => ({
  content: { 'application/problem+json': { schema: ProblemSchema } },
  description,
});

/** Error responses shared by most routes. */
export const errors = {
  400: problem('The request was not valid'),
  401: problem('Sign in (or continue as a guest) first'),
  403: problem('Not allowed'),
  404: problem('Not found'),
  409: problem('Conflicts with what is already there (for example, a limit was reached)'),
  422: problem('Some fields need attention'),
  429: problem('Too many requests'),
} as const;

export const OkSchema = z.object({ ok: z.literal(true) }).openapi('Ok');

/** A router with Waypoint's validation error format. */
export function router() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issues = result.error.issues.slice(0, 20).map((i) => ({
          path: i.path.map(String).join('.'),
          message: i.message,
        }));
        return c.json(
          {
            type: 'https://waypoint.app/problems/invalid-input',
            title: 'Invalid input',
            status: 422,
            code: 'invalid-input',
            detail: 'Some fields need attention.',
            issues,
            requestId: c.get('requestId'),
          },
          422,
          { 'Content-Type': 'application/problem+json' },
        );
      }
    },
  });
}

export const IdParam = z.object({
  id: z.uuid().openapi({
    param: { name: 'id', in: 'path' },
    example: '0199a3c4-7b1e-7cc0-9f00-3b4c5d6e7f80',
  }),
});

export const CountryQuery = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .transform((v) => v.toUpperCase())
  .optional()
  .openapi({ example: 'IN', description: 'ISO 3166-1 alpha-2 country code' });
