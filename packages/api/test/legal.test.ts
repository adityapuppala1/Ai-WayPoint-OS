/**
 * The privacy notice names the outside services this installation really uses, from its
 * configuration, and never repeats a secret from it.
 */
import { resetProvidersForTests } from '@waypoint/ai';
import { resetEnvForTests } from '@waypoint/core/env';
import { afterEach, describe, expect, it } from 'vitest';
import { legalFacts, smtpHost } from '../src/services/legal';

const KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OLLAMA_BASE_URL',
  'AI_PROVIDER_ORDER',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_SMS_FROM',
  'TWILIO_WHATSAPP_FROM',
  'TWILIO_MESSAGING_SERVICE_SID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'AFRICASTALKING_USERNAME',
  'AFRICASTALKING_API_KEY',
  'EMAIL_FROM',
  'RESEND_API_KEY',
  'SMTP_URL',
  'WAYPOINT_OPERATOR',
  'WAYPOINT_CONTACT_EMAIL',
  'WAYPOINT_DATA_LOCATION',
  'WAYPOINT_BACKUP_DAYS',
  'WAYPOINT_K_ANON_MIN',
] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function configure(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
  resetEnvForTests();
  resetProvidersForTests();
  return legalFacts();
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetEnvForTests();
  resetProvidersForTests();
});

describe('legal facts', () => {
  it('names nothing when nothing is set up', () => {
    expect(configure({})).toEqual({
      operator: null,
      contactEmail: null,
      dataLocation: null,
      backupDays: null,
      k: 50,
      aiProviders: [],
      privateModel: false,
      textingProviders: [],
      emailProvider: null,
    });
  });

  it('names the providers in use, in the configured order, and a private model separately', () => {
    const facts = configure({
      ANTHROPIC_API_KEY: 'sk-ant-test',
      GOOGLE_GENERATIVE_AI_API_KEY: 'g-test',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      AI_PROVIDER_ORDER: 'google,anthropic,ollama',
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_SMS_FROM: '+15550001111',
      AFRICASTALKING_USERNAME: 'sandbox',
      AFRICASTALKING_API_KEY: 'at-key',
      EMAIL_FROM: 'Waypoint <hello@example.org>',
      SMTP_URL: 'smtp://user:secret-password@smtp.example.org:587',
      WAYPOINT_OPERATOR: 'Example Trust',
      WAYPOINT_CONTACT_EMAIL: 'privacy@example.org',
      WAYPOINT_DATA_LOCATION: 'Nairobi, Kenya',
      WAYPOINT_BACKUP_DAYS: '30',
      WAYPOINT_K_ANON_MIN: '100',
    });
    expect(facts).toMatchObject({
      operator: 'Example Trust',
      contactEmail: 'privacy@example.org',
      dataLocation: 'Nairobi, Kenya',
      backupDays: 30,
      k: 100,
      aiProviders: ['Google', 'Anthropic'],
      privateModel: true,
      textingProviders: ['Twilio', 'Africa’s Talking'],
      emailProvider: 'smtp.example.org',
    });
    expect(JSON.stringify(facts)).not.toMatch(/secret-password|sk-ant|at-key|user/);
  });

  it('leaves out a provider that is configured but not in the provider order', () => {
    expect(
      configure({ OPENAI_API_KEY: 'sk-test', AI_PROVIDER_ORDER: 'anthropic' }).aiProviders,
    ).toEqual([]);
  });

  it('counts a texting service only when it can actually send', () => {
    // Twilio without a sender, Meta without a phone number id.
    expect(
      configure({
        TWILIO_ACCOUNT_SID: 'ACtest',
        TWILIO_AUTH_TOKEN: 'token',
        WHATSAPP_ACCESS_TOKEN: 'meta-token',
      }).textingProviders,
    ).toEqual([]);
    expect(
      configure({ WHATSAPP_ACCESS_TOKEN: 'meta-token', WHATSAPP_PHONE_NUMBER_ID: '123' })
        .textingProviders,
    ).toEqual(['Meta (WhatsApp)']);
  });

  it('names Resend when it sends the email, and no service without a sender address', () => {
    expect(
      configure({ EMAIL_FROM: 'a@example.org', RESEND_API_KEY: 're_x', SMTP_URL: 'smtp://h' })
        .emailProvider,
    ).toBe('Resend');
    expect(configure({ RESEND_API_KEY: 're_x' }).emailProvider).toBeNull();
    expect(smtpHost('not a url')).toBeNull();
  });
});
