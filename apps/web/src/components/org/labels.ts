/** Message keys for organisation values (plain data, safe in server and client components). */
import type { OrgSizeBand } from '@waypoint/core';

export const SIZE_KEY: Record<OrgSizeBand, 'xs' | 's' | 'm' | 'l' | 'xl'> = {
  '1-49': 'xs',
  '50-249': 's',
  '250-999': 'm',
  '1000-4999': 'l',
  '5000+': 'xl',
};
