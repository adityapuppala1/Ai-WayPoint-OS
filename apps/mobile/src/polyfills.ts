/**
 * What the shared code expects from the JavaScript engine and Hermes leaves out. Each one only
 * fills a gap: where the engine already has it (the web build), nothing changes.
 *
 * Expo already provides fetch with streaming, TextDecoder(Stream), URL and structuredClone;
 * Hermes has Intl.NumberFormat, DateTimeFormat, Collator and getCanonicalLocales.
 */
import { getRandomValues, randomUUID } from 'expo-crypto';
import { installPluralRules } from './plural-rules';

// "1 minute" / "2 minutes", in all seven languages (see plural-rules.ts).
installPluralRules();

// Random ids (conversation and message ids are UUIDs) come from the phone's secure generator.
const g = globalThis as { crypto?: Partial<Crypto> };
g.crypto ??= {};
g.crypto.getRandomValues ??= getRandomValues as Crypto['getRandomValues'];
g.crypto.randomUUID ??= randomUUID as Crypto['randomUUID'];
