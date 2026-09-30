/**
 * Personal details hidden by Circles moderation (see redactPII in @waypoint/core/privacy).
 * The stored text keeps an English placeholder such as "[phone]"; readers see it in their language.
 */
export const TOKENS = {
  '[email]': 'email',
  '[phone]': 'phone',
  '[card]': 'card',
  '[bank account]': 'bankAccount',
  '[id number]': 'idNumber',
  '[tax id]': 'taxId',
  '[payment id]': 'paymentId',
  '[ip address]': 'ipAddress',
  '[passport]': 'passport',
  '[bank id]': 'bankId',
} as const;

export type TokenId = (typeof TOKENS)[keyof typeof TOKENS];

/** Splits text around placeholders (the capture group keeps them in the result). */
export const TOKEN_RE =
  /(\[(?:email|phone|card|bank account|id number|tax id|payment id|ip address|passport|bank id)\])/g;

/** The kinds the API reports as masked, mapped to the labels people read. */
export const MASKED_KIND: Record<string, TokenId> = {
  email: 'email',
  phone: 'phone',
  card: 'card',
  iban: 'bankAccount',
  aadhaar: 'idNumber',
  ssn: 'idNumber',
  pan: 'taxId',
  upi: 'paymentId',
  ip: 'ipAddress',
  passport: 'passport',
  bvn: 'bankId',
};
