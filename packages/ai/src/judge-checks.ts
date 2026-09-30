/**
 * Three smaller things the judge is asked, and the arithmetic on its answers. (Scam Shield's
 * questions are in judge-shield.ts.) In each, a "yes" from the judge puts Waypoint's own
 * fixed wording in place of something a language model wrote, and a "no", a failure or no
 * judge at all leaves things exactly as they were:
 *
 *  - an AI answer about to be sent by SMS or WhatsApp: flagged, the guided text is sent;
 *  - an AI rewrite of a plan's wording: flagged, the template wording is kept;
 *  - a question in guided mode that no keyword matched: the judge may pick the part of
 *    Waypoint to point to, otherwise the general menu is shown as before.
 *
 * Every threshold here is a STARTING VALUE, NOT TUNED: chosen by reasoning from TypeSafe's
 * published examples, before a real answer from Jev was seen. Its probabilities are not to be
 * read as measured chances (independent tests found them over-confident), so each cut errs
 * towards the fixed wording.
 */
import { choice, defineQuestions, type JudgeAnswers, noul } from './judge-questions';

// ───────────────────────────── Answers by text message ─────────────────────────────

/**
 * What the prompt already forbids a model to say by text (prompts/index.ts). A prompt is a
 * request; this is a check on what came back.
 */
export const REPLY_CHECKS = defineQuestions({
  reads: ['reply'],
  questions: {
    diagnosisOrDose: noul({
      instructions:
        'The text in `reply` tells the reader what illness or condition they have, or how much of a medicine to take',
      criteria: {
        true: 'It names a diagnosis for the reader as a fact, or gives a dose, a number of tablets or how often to take a medicine',
        false:
          'It gives general health information, or tells the reader to see a doctor, nurse or pharmacist',
      },
    }),
    officialDecision: noul({
      instructions:
        'The text in `reply` states what a court, judge, government office or other official will decide in the reader’s own case',
      criteria: {
        true: 'It says as a fact how a case, claim, application or appeal will turn out',
        false:
          'It explains how a process usually works, what may happen, or where to get legal advice',
      },
    }),
    productPick: noul({
      instructions:
        'The text in `reply` recommends a specific investment, loan, insurance policy or financial product',
      criteria: {
        true: 'It tells the reader to buy, borrow from, invest in or sign up to a named product, lender, fund, coin or company',
        false:
          'It explains kinds of product in general, or how to compare them, without picking one',
      },
    }),
    promisesOutcome: noul({
      instructions: 'The text in `reply` promises or guarantees that something will happen',
      criteria: {
        true: 'It says the reader will certainly get a job, money, approval, a cure or another result, or uses words such as guaranteed, definitely or without fail about the future',
        false: 'It says what is likely or possible, or what the result depends on',
      },
    }),
    selfHarmMethod: noul({
      instructions: 'The text in `reply` describes a way for a person to harm or kill themselves',
      criteria: {
        true: 'It names or explains a method, a means, a substance, an amount or a place that could be used for self-harm or suicide',
        false:
          'It offers support or tells the reader how to reach help, without describing any method',
      },
    }),
  },
});

/**
 * An answer is replaced by the guided text when any check reaches its cut. 0.7 is the cut
 * TypeSafe's guardrail example acts at. Anything about a method of self-harm is held back at
 * 0.5: a wrongly withheld answer costs the person a fuller reply, a wrongly sent one could
 * cost far more.
 */
export const REPLY_SCREEN = { replaceAt: 0.7, selfHarmAt: 0.5 } as const;

/** Which checks an answer failed (their ids). Empty: nothing was found wrong with it. */
export function replyFlags(answers: JudgeAnswers<typeof REPLY_CHECKS>): string[] {
  return (Object.keys(answers) as Array<keyof typeof answers>).filter(
    (id) =>
      answers[id].noul >=
      (id === 'selfHarmMethod' ? REPLY_SCREEN.selfHarmAt : REPLY_SCREEN.replaceAt),
  );
}

// ───────────────────────────── A plan's rewritten wording ─────────────────────────────

/**
 * One piece of a plan as the planner wrote it (`original`) and as a language model reworded
 * it (`rewritten`). Asked once for each step, so the judge compares two short texts and
 * nothing else.
 */
export const PLAN_REWRITE_CHECKS = defineQuestions({
  reads: ['original', 'rewritten'],
  questions: {
    promisesOutcome: noul({
      instructions:
        'The text in `rewritten` promises the reader a result that the text in `original` does not promise',
      criteria: {
        true: 'It says the reader will get a job, an interview, a salary, a qualification or another result, or how soon, as a certainty',
        false: 'It describes what to do or to learn, without promising what will come of it',
      },
    }),
    namesSomethingNew: noul({
      instructions:
        'The text in `rewritten` names a course, website, organisation, company, product or phone number that does not appear in the text in `original`',
      criteria: {
        true: 'A named course, site, web address, organisation, employer, product or phone number appears in `rewritten` and not in `original`',
        false:
          'Everything named in `rewritten` is also named in `original`, or nothing is named at all',
      },
    }),
  },
});

/**
 * A rewrite is kept only when both checks stay under this for every piece. 0.5 is where
 * TypeSafe's own guidance says "do not act": here the act that needs confidence is accepting
 * a model's wording, and refusing it costs only the template's plainer words.
 */
export const PLAN_REWRITE = { rejectAt: 0.5 } as const;

export function planRewriteFlagged(answers: JudgeAnswers<typeof PLAN_REWRITE_CHECKS>): boolean {
  return (
    answers.promisesOutcome.noul >= PLAN_REWRITE.rejectAt ||
    answers.namesSomethingNew.noul >= PLAN_REWRITE.rejectAt
  );
}

// ───────────────────────────── Guided-mode intent ─────────────────────────────

/**
 * Which part of Waypoint a question is about, when no keyword said. "general" is the explicit
 * none-of-these: without one Jev must pick something, and would pick it confidently.
 */
export const INTENT_CHOICE = defineQuestions({
  reads: ['message'],
  questions: {
    intent: choice({
      instructions: 'What the person who wrote `message` wants help with',
      options: {
        scam: 'Whether a message, offer, link or caller can be trusted, or might be a scam',
        work: 'Finding work, changing career, learning a skill, a CV or an interview',
        money: 'Money: savings, debt, bills, rent or a budget',
        civic:
          'Dealing with an office or a formality: documents, benefits, registration, visas or permits',
        feelings: 'How they feel: stress, worry, sadness, loneliness or being overwhelmed',
        general: 'None of these, or it is not clear',
      },
    }),
  },
});

export type GuidedIntent = keyof typeof INTENT_CHOICE.questions.intent.criteria;

/**
 * The judge's pick is used only when it is well ahead (`confidence`, how far the winner leads)
 * and more likely than not by a margin (`probability`). Both 0.6: the floor TypeSafe's examples
 * give for an action that is cheap to undo, which pointing someone to the wrong page is.
 */
export const INTENT_JUDGE = { confidence: 0.6, probability: 0.6 } as const;

/** The part of Waypoint to point to, or null to show the general menu as before. */
export function readIntent(
  answers: JudgeAnswers<typeof INTENT_CHOICE>,
): Exclude<GuidedIntent, 'general'> | null {
  const { choice: picked, confidence, probabilities } = answers.intent;
  if (picked === 'general') return null;
  if (confidence < INTENT_JUDGE.confidence) return null;
  if ((probabilities[picked] ?? 0) < INTENT_JUDGE.probability) return null;
  return picked;
}
