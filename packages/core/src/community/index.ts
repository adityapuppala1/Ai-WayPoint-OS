/**
 * Circles moderation: every post is checked before anyone else sees it.
 *
 *  - Signs someone may be in danger (tier ≥ 2) → the post is held, and only its author sees it,
 *    with the support card. Peers are not crisis responders, and graphic posts can harm others.
 *  - Likely scams (Shield high or very high) → held for review. Peer groups of people who just
 *    lost work are a favourite target for fake job offers and "investment" pitches.
 *  - Phone numbers, emails, card, bank and ID numbers are masked, so nobody is contacted or
 *    defrauded off-platform because of a post.
 * All deterministic and multilingual; no AI involved.
 */
import { assessCrisis } from '../crisis';
import { redactPII } from '../privacy/redact';
import { checkMessage } from '../shield';
import type { CrisisAssessment, Locale, RiskLevel } from '../types';

export const POST_KINDS = ['post', 'win', 'question', 'checkin'] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const REACTIONS = ['support', 'helpful', 'celebrate'] as const;
export type Reaction = (typeof REACTIONS)[number];

export const REPORT_REASONS = ['harassment', 'scam', 'spam', 'worried', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Distinct reports that hide a post until a moderator looks at it. */
export const AUTO_HIDE_REPORTS = 3;

export type HoldReason = 'crisis' | 'scam';

export interface Moderation {
  /** Text to store and show: personal numbers and addresses masked. */
  text: string;
  /** What was masked (kinds only). */
  masked: string[];
  hold: HoldReason | null;
  crisis: CrisisAssessment;
  scamLevel: RiskLevel;
}

export function moderatePost(
  body: string,
  ctx: { country?: string | null; locale?: Locale } = {},
): Moderation {
  const crisis = assessCrisis(body);
  const shield = checkMessage({ text: body, country: ctx.country ?? undefined });
  const redaction = redactPII(body);
  const hold: HoldReason | null =
    crisis.tier >= 2
      ? 'crisis'
      : shield.level === 'high' || shield.level === 'very-high'
        ? 'scam'
        : null;
  return {
    text: redaction.text,
    masked: [...new Set(redaction.found.map((f) => f.kind))],
    hold,
    crisis,
    scamLevel: shield.level,
  };
}
