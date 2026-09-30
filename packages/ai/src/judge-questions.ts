/**
 * How code asks the judge something.
 *
 * Questions are constants, written once at the top of a module and never built at run time.
 * What a person typed or pasted travels only in the `state`, under a named field, and a
 * question points at it with a backticked path such as `message`. Jev's own notes say text
 * written to steer it "can move the answer", so a person's words must never become part of
 * an instruction. Three things keep it that way:
 *
 *  1. the types refuse any wording that is not written out in the code (a variable, or a
 *     template with a variable in it, has the type `string`, which is refused);
 *  2. a set of questions is checked when it is defined (it must name the fields it reads, and
 *     may point only at those) and frozen, so nothing can be added to it later;
 *  3. when a request is prepared, the state must hold exactly those fields, and any longer
 *     piece of state text that also appears in a question stops the request.
 *
 * Personal details (phone numbers, email addresses, card and ID numbers) are removed from
 * every part of the state here, whoever the caller is: the judge is always an outside service.
 */
import { redactPII } from '@waypoint/core/privacy';
import { checkJevRequest, type JevQuestion, type JevRequest, type JsonValue } from './judge-client';

/** Wording for an instruction, a criterion, an option or a level: text, or labelled text. */
type Wording = string | { readonly [label: string]: string | readonly string[] };

/**
 * The same type, except that anything not written out in the code becomes `never`: plain
 * `string` (a variable), a template built around one (its type is a pattern such as
 * `Is it ${string}`, which would take any key in a record, where a written-out text names
 * exactly one) and objects with computed keys.
 */
type Fixed<T> = T extends string
  ? Record<never, never> extends Record<T, unknown>
    ? never
    : T
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: Fixed<T[K]> }
    : T extends object
      ? string extends keyof T
        ? never
        : { readonly [K in keyof T]: Fixed<T[K]> }
      : T;

interface NoulSpec {
  instructions: Wording;
  /** What counts as yes and as no, when the instructions alone leave room for doubt. */
  criteria?: { true?: Wording; false?: Wording };
}
interface ChoiceSpec {
  instructions: Wording;
  /** Each option and what it means (null: the name says it all). Include a "none of these". */
  options: { readonly [option: string]: Wording | null };
}
interface ScoreSpec {
  instructions: Wording;
  /** From lowest to highest: 2 to 10 levels, each described on its own. */
  levels: readonly Wording[];
}

export interface NoulQuestion {
  readonly type: 'noul';
  readonly instructions: Wording;
  readonly criteria?: { readonly true?: Wording; readonly false?: Wording };
}
export interface ChoiceQuestion<O extends string = string> {
  readonly type: 'choice';
  readonly instructions: Wording;
  readonly criteria: { readonly [K in O]: Wording | null };
}
export interface ScoreQuestion {
  readonly type: 'score';
  readonly instructions: Wording;
  readonly criteria: readonly Wording[];
}
export type JudgeQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

/** Yes or no: answered with the probability of yes. */
export function noul<const T extends NoulSpec>(spec: T & Fixed<T>): NoulQuestion {
  return spec.criteria
    ? { type: 'noul', instructions: spec.instructions, criteria: spec.criteria }
    : { type: 'noul', instructions: spec.instructions };
}

/** One of the options: answered with the option, a probability for each, and a confidence. */
export function choice<const T extends ChoiceSpec>(
  spec: T & Fixed<T>,
): ChoiceQuestion<Extract<keyof T['options'], string>> {
  return {
    type: 'choice',
    instructions: spec.instructions,
    criteria: spec.options as ChoiceQuestion<Extract<keyof T['options'], string>>['criteria'],
  };
}

/** A place on an ordered scale: answered with the expected level and a probability for each. */
export function score<const T extends ScoreSpec>(spec: T & Fixed<T>): ScoreQuestion {
  return { type: 'score', instructions: spec.instructions, criteria: spec.levels };
}

declare const made: unique symbol;

/** Questions made by `defineQuestions`, and the state fields they read. */
export interface QuestionSet<
  F extends string = string,
  Q extends Record<string, JudgeQuestion> = Record<string, JudgeQuestion>,
> {
  readonly reads: readonly F[];
  readonly questions: Q;
  readonly [made]: true;
}

export type AnswerOf<Q> = Q extends NoulQuestion
  ? { type: 'noul'; noul: number }
  : Q extends ChoiceQuestion<infer O>
    ? {
        type: 'choice';
        choice: O;
        /** How likely each option is. Read these, not only the winner. */
        probabilities: Partial<Record<O, number>>;
        /** How far ahead the winner is, 0 to 1. It is not how likely the answer is right. */
        confidence: number;
      }
    : Q extends ScoreQuestion
      ? {
          type: 'score';
          /** The expected level, from 0 (the first level) to the last. */
          score: number;
          /** How likely each level is, keyed "0", "1"… */
          probabilities: Record<string, number>;
          confidence: number;
        }
      : never;

/** The answers to a set of questions, each typed by its question. */
export type JudgeAnswers<S> =
  S extends QuestionSet<string, infer Q> ? { [K in keyof Q]: AnswerOf<Q[K]> } : never;

/** The state a set of questions reads: one value for each field it declares. */
export type JudgeState<F extends string> = { readonly [K in F]: StateValue };
export type StateValue =
  | string
  | number
  | boolean
  | readonly StateValue[]
  | { readonly [key: string]: StateValue };

const FIELD = /^[a-z][A-Za-z0-9_]*$/;
const PATH = /^([A-Za-z_][A-Za-z0-9_]*)(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\])*$/;

const defined = new WeakSet<object>();

function textsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const inner of value) textsIn(inner, out);
  else if (value && typeof value === 'object')
    for (const inner of Object.values(value)) textsIn(inner, out);
  return out;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** The state fields a piece of wording points at; throws when a backtick is used for anything else. */
function fieldsNamedIn(wording: unknown, reads: readonly string[], at: string): string[] {
  const named: string[] = [];
  for (const text of textsIn(wording)) {
    if ((text.match(/`/g)?.length ?? 0) % 2 === 1)
      throw new Error(`${at} has an unmatched backtick: "${text}"`);
    for (const [, inside = ''] of text.matchAll(/`([^`]*)`/g)) {
      const root = PATH.exec(inside)?.[1];
      if (!root || !reads.includes(root))
        throw new Error(
          `${at} points at \`${inside}\`, which is not a field it reads (${reads.join(', ')}). Backticks are only for state fields.`,
        );
      named.push(root);
    }
  }
  return named;
}

/**
 * Define the questions a feature asks, once, at the top of its module.
 *
 * `reads` names the fields of the state the questions are about; each question's instructions
 * must point at one or more of them with a backticked path (`message`, `reply.steps[0]`).
 * Throws on a mistake, so a wrong set fails when the module loads, not in front of a person.
 */
export function defineQuestions<
  const F extends string,
  const Q extends Record<string, JudgeQuestion>,
>(spec: { reads: readonly F[]; questions: Q }): QuestionSet<F, Q> {
  const reads = [...spec.reads];
  if (!reads.length || reads.some((field) => !FIELD.test(field)))
    throw new Error(
      `Questions need the state fields they read, named like "message" or "replyText" (got: ${reads.join(', ') || 'none'})`,
    );
  const ids = Object.keys(spec.questions);
  if (!ids.length) throw new Error('A set needs at least one question');
  for (const id of ids) {
    const q = spec.questions[id]!;
    const at = `Question "${id}"`;
    if (!fieldsNamedIn(q.instructions, reads, at).length)
      throw new Error(
        `${at} does not say which part of the state it is about: point at a field in backticks, e.g. \`${reads[0]}\``,
      );
    fieldsNamedIn(q.criteria, reads, at);
  }
  const problem = checkJevRequest({
    state: Object.fromEntries(reads.map((field) => [field, '…'])),
    model: 'unset',
    questions: spec.questions as unknown as Record<string, JevQuestion>,
  });
  if (problem) throw new Error(`These questions cannot be asked: ${problem}`);
  const set = deepFreeze({ reads, questions: structuredClone(spec.questions) });
  defined.add(set);
  return set as unknown as QuestionSet<F, Q>;
}

/** Remove personal details from every piece of text in a value. */
function redacted(value: StateValue): JsonValue {
  if (typeof value === 'string') return redactPII(value).text;
  if (Array.isArray(value)) return value.map((inner) => redacted(inner as StateValue));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, redacted(inner as StateValue)]),
    );
  return value as JsonValue;
}

/** Shorter than this, a value is a code or a word (a country, a language), not someone's text. */
const SMUGGLED_MIN_CHARS = 16;

/**
 * Turn a set of questions and a state into the request that is sent, or say why it must not
 * be. Nothing here calls out: see `runJudge` for who may ask, and when.
 */
export function prepareJudgeRequest<F extends string, Q extends Record<string, JudgeQuestion>>(
  set: QuestionSet<F, Q>,
  state: JudgeState<NoInfer<F>>,
  model: string,
): { ok: true; request: JevRequest } | { ok: false; problem: string } {
  const no = (problem: string) => ({ ok: false as const, problem });
  if (!set || typeof set !== 'object' || !defined.has(set))
    return no('questions must be made with defineQuestions, as constants');
  if (!state || typeof state !== 'object' || Array.isArray(state))
    return no('the state must be an object with one named field for each thing the questions read');
  const given = state as Record<string, StateValue>;
  const missing = set.reads.filter((field) => given[field] === undefined || given[field] === null);
  if (missing.length) return no(`the state is missing ${missing.join(', ')}`);
  const extra = Object.keys(given).filter(
    (field) => !(set.reads as readonly string[]).includes(field),
  );
  // Only what the questions need is sent: anything else is noise to Jev and exposure for the person.
  if (extra.length)
    return no(`the state has ${extra.join(', ')}, which these questions do not read`);

  const asked = textsIn(set.questions);
  const smuggled = set.reads.find((field) =>
    textsIn(given[field]).some(
      (text) =>
        text.trim().length >= SMUGGLED_MIN_CHARS && asked.some((q) => q.includes(text.trim())),
    ),
  );
  if (smuggled)
    return no(
      `the text of "${smuggled}" also appears in a question: what a person wrote may only travel in the state`,
    );

  const request: JevRequest = {
    state: Object.fromEntries(set.reads.map((field) => [field, redacted(given[field]!)])),
    model,
    questions: set.questions as unknown as Record<string, JevQuestion>,
  };
  const problem = checkJevRequest(request);
  return problem ? no(problem) : { ok: true, request };
}
