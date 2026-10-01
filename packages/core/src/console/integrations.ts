/**
 * The outside services Waypoint can use, and every setting of theirs an admin may manage
 * from the console. Settings that the server needs before it can read its own database, or
 * that decide who it trusts, are never here and stay in the server's environment: the site's
 * address, the database, the signing secret, the key that wraps every other key, the first
 * admin's password, proxies and allowed origins.
 *
 * A value in the server's environment always wins over the console's, so an operator who
 * keeps configuration in files or a secret store stays in charge of it.
 */

export type IntegrationGroup = 'ai' | 'judge' | 'texting' | 'email';

/**
 * secret: shown as its last four characters only, never sent back to the browser.
 * text / url / number: shown in full. choice: one of `options`. list: several of `options`
 * (or free values when there are none), stored comma-separated.
 */
export type FieldKind = 'secret' | 'text' | 'url' | 'number' | 'choice' | 'list';

export interface IntegrationField {
  /** The environment variable it stands for. */
  key: string;
  kind: FieldKind;
  options?: readonly string[];
  /** An example of the format, shown in the empty field. */
  placeholder?: string;
  /** What is used when nothing is set (the configuration's own default). */
  fallback?: string;
}

export interface Integration {
  id: string;
  /** The service's own name (not translated); the general settings cards have none. */
  name: string | null;
  group: IntegrationGroup;
  /** Settings that must all be set for the service to be in use. */
  needs: readonly string[];
  fields: readonly IntegrationField[];
  /** Whether the console can check it with a harmless call. */
  testable: boolean;
  /** Where the operator gets keys or reads about the service. */
  docs: string;
}

const AI_PROVIDERS = ['anthropic', 'openai', 'google', 'ollama'] as const;

const models = (prefix: string, small: string, large: string): IntegrationField[] => [
  { key: `AI_MODEL_${prefix}_SMALL`, kind: 'text', placeholder: small, fallback: small },
  { key: `AI_MODEL_${prefix}_LARGE`, kind: 'text', placeholder: large, fallback: large },
];

export const INTEGRATIONS: readonly Integration[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    group: 'ai',
    needs: ['ANTHROPIC_API_KEY'],
    fields: [
      { key: 'ANTHROPIC_API_KEY', kind: 'secret', placeholder: 'sk-ant-…' },
      ...models('ANTHROPIC', 'claude-haiku-4-5', 'claude-sonnet-5-5'),
    ],
    testable: true,
    docs: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    group: 'ai',
    needs: ['OPENAI_API_KEY'],
    fields: [
      { key: 'OPENAI_API_KEY', kind: 'secret', placeholder: 'sk-…' },
      ...models('OPENAI', 'gpt-5.4-mini', 'gpt-5.5'),
    ],
    testable: true,
    docs: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    group: 'ai',
    needs: ['GOOGLE_GENERATIVE_AI_API_KEY'],
    fields: [
      { key: 'GOOGLE_GENERATIVE_AI_API_KEY', kind: 'secret', placeholder: 'AIza…' },
      ...models('GOOGLE', 'gemini-3.5-flash-lite', 'gemini-2.5-pro'),
    ],
    testable: true,
    docs: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'ollama',
    name: 'Ollama (your own server)',
    group: 'ai',
    needs: ['OLLAMA_BASE_URL'],
    fields: [
      { key: 'OLLAMA_BASE_URL', kind: 'url', placeholder: 'http://localhost:11434' },
      ...models('OLLAMA', 'llama3.2', 'llama3.1:8b'),
    ],
    testable: true,
    docs: 'https://ollama.com/download',
  },
  {
    id: 'ai-settings',
    name: null,
    group: 'ai',
    needs: [],
    fields: [
      {
        key: 'AI_PROVIDER_ORDER',
        kind: 'list',
        options: AI_PROVIDERS,
        fallback: 'anthropic,openai,google,ollama',
      },
      { key: 'AI_MONTHLY_BUDGET_USD', kind: 'number', placeholder: '25', fallback: '25' },
      {
        key: 'AI_EMBEDDING_PROVIDER',
        kind: 'choice',
        options: ['none', 'openai', 'google', 'ollama'],
        fallback: 'none',
      },
    ],
    testable: false,
    docs: '/docs/AI.md',
  },
  {
    id: 'typesafe',
    name: 'TypeSafe Jev',
    group: 'judge',
    needs: ['TYPESAFE_API_KEY'],
    fields: [
      { key: 'TYPESAFE_API_KEY', kind: 'secret' },
      { key: 'AI_JUDGE_MODEL', kind: 'text', placeholder: 'jev-1.13.0', fallback: 'jev-1.13.0' },
      {
        key: 'AI_JUDGE_LOCALES',
        kind: 'list',
        options: ['en', 'hi', 'es', 'fr', 'pt', 'ar', 'sw'],
        fallback: 'en',
      },
    ],
    testable: true,
    docs: 'https://docs.typesafe.ai',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    group: 'texting',
    needs: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    fields: [
      { key: 'TWILIO_ACCOUNT_SID', kind: 'text', placeholder: 'AC…' },
      { key: 'TWILIO_AUTH_TOKEN', kind: 'secret' },
      { key: 'TWILIO_SMS_FROM', kind: 'text', placeholder: '+15550001234' },
      { key: 'TWILIO_MESSAGING_SERVICE_SID', kind: 'text', placeholder: 'MG…' },
      { key: 'TWILIO_WHATSAPP_FROM', kind: 'text', placeholder: 'whatsapp:+14155238886' },
    ],
    testable: true,
    docs: 'https://console.twilio.com',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Cloud API (Meta)',
    group: 'texting',
    needs: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
    fields: [
      { key: 'WHATSAPP_ACCESS_TOKEN', kind: 'secret' },
      { key: 'WHATSAPP_PHONE_NUMBER_ID', kind: 'text' },
      { key: 'WHATSAPP_APP_SECRET', kind: 'secret' },
      { key: 'WHATSAPP_VERIFY_TOKEN', kind: 'secret' },
    ],
    testable: true,
    docs: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
  },
  {
    id: 'africastalking',
    name: "Africa's Talking",
    group: 'texting',
    needs: ['AFRICASTALKING_USERNAME', 'AFRICASTALKING_API_KEY'],
    fields: [
      { key: 'AFRICASTALKING_USERNAME', kind: 'text', placeholder: 'sandbox' },
      { key: 'AFRICASTALKING_API_KEY', kind: 'secret' },
      { key: 'AFRICASTALKING_SENDER_ID', kind: 'text' },
      { key: 'AFRICASTALKING_WEBHOOK_KEY', kind: 'secret' },
    ],
    testable: true,
    docs: 'https://account.africastalking.com',
  },
  {
    id: 'texting-settings',
    name: null,
    group: 'texting',
    needs: [],
    fields: [
      {
        key: 'WAYPOINT_TEXT_REPLIES_PER_HOUR',
        kind: 'number',
        placeholder: '2000',
        fallback: '2000',
      },
      {
        key: 'WAYPOINT_TEXT_REPLIES_PER_DAY',
        kind: 'number',
        placeholder: '20000',
        fallback: '20000',
      },
      { key: 'WAYPOINT_TEXT_COUNTRIES', kind: 'list', placeholder: 'KE,TZ,UG' },
      { key: 'WAYPOINT_SMS_NUMBER', kind: 'text', placeholder: '+254700000000' },
      { key: 'WAYPOINT_WHATSAPP_NUMBER', kind: 'text', placeholder: '+254700000000' },
      { key: 'WAYPOINT_USSD_CODE', kind: 'text', placeholder: '*384*123#' },
    ],
    testable: false,
    docs: '/docs/CHANNELS.md',
  },
  {
    id: 'resend',
    name: 'Resend',
    group: 'email',
    needs: ['RESEND_API_KEY'],
    fields: [{ key: 'RESEND_API_KEY', kind: 'secret', placeholder: 're_…' }],
    testable: true,
    docs: 'https://resend.com/api-keys',
  },
  {
    id: 'smtp',
    name: 'SMTP mail server',
    group: 'email',
    needs: ['SMTP_URL'],
    // The address carries the mail server's password, so it is kept like a key.
    fields: [{ key: 'SMTP_URL', kind: 'secret', placeholder: 'smtp://user:password@host:587' }],
    testable: true,
    docs: '/docs/DEPLOYMENT.md',
  },
  {
    id: 'email-settings',
    name: null,
    group: 'email',
    needs: [],
    fields: [{ key: 'EMAIL_FROM', kind: 'text', placeholder: 'Waypoint <help@example.org>' }],
    testable: false,
    docs: '/docs/DEPLOYMENT.md',
  },
];

/** Every setting the console may manage, by environment variable. */
export const CONSOLE_SETTINGS: ReadonlyMap<string, IntegrationField> = new Map(
  INTEGRATIONS.flatMap((i) => i.fields.map((f) => [f.key, f] as const)),
);

export function integrationById(id: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

/** The last four characters of a secret, the only part ever shown again. */
export function secretHint(value: string): string {
  const v = value.trim();
  return v.length <= 8 ? '••••' : `••••${v.slice(-4)}`;
}
