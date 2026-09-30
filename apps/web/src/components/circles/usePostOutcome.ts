'use client';

import type { PostResult } from '@waypoint/api/client';
import type { CrisisResponsePlan } from '@waypoint/core';
import { toast } from '@waypoint/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { MASKED_KIND } from './masked';

/**
 * What happens after someone posts or replies: a crisis card if the words suggested danger (the
 * post stays private), a note if it's held as a possible scam, and which personal details were
 * hidden. Shared by the composer and replies so both behave the same way.
 */
export function usePostOutcome() {
  const t = useTranslations('circles');
  const format = useFormatter();
  const [crisis, setCrisis] = useState<CrisisResponsePlan | null>(null);

  const report = (res: PostResult, success: string) => {
    if (res.crisis) {
      setCrisis(res.crisis);
      return;
    }
    if (res.post.held === 'scam') {
      toast(
        { title: t('held.scamTitle'), description: t('held.scamBody'), tone: 'caution' },
        10_000,
      );
    } else {
      toast({ title: success, tone: 'safe' }, 3000);
    }
    const kinds = [
      ...new Set(res.masked.map((k) => MASKED_KIND[k]).filter((k) => k !== undefined)),
    ];
    if (kinds.length) {
      toast(
        {
          title: t('maskedToast', {
            kinds: format.list(
              kinds.map((k) => t(`tokens.${k}`)),
              { type: 'conjunction' },
            ),
          }),
          tone: 'info',
        },
        8000,
      );
    }
  };

  return { crisis, clearCrisis: () => setCrisis(null), report };
}
