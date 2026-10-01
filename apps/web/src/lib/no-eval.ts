/**
 * The content security policy never allows text to be turned into code (no 'unsafe-eval').
 * Zod, which the chat library uses to check messages, tests for that ability once with
 * `Function("")`. The test is harmless, but Firefox reports it as a policy violation on every
 * visit. Telling zod up front that it may not compile code skips the test in every browser.
 *
 * Import this before anything that checks data with zod in the browser.
 */
import * as z from 'zod';

z.config({ jitless: true });
