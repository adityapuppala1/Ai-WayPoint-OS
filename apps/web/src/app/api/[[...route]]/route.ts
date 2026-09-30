/**
 * Mounts the Waypoint API (packages/api, Hono) at /api. The same app runs standalone in
 * split deployments (apps/api), so the web app has no API logic of its own.
 */
import { handleRequest } from '@waypoint/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const handler = (request: Request) => handleRequest(request);

export {
  handler as DELETE,
  handler as GET,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
