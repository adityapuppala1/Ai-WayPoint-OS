/**
 * How the measurement run (judge-cli.ts) asks the judge about one message of the golden set:
 * through the same function the app uses, so what is measured is what people would get: the
 * same questions, redaction, language check, arithmetic and reasons.
 */
import type { Database } from '@waypoint/db';
import { shieldJudgeOpinion } from '../features';
import type { AskJudge } from './judge-measure';

export const askShieldJudge =
  (db: Database): AskJudge =>
  async (c, rules) => {
    const judged = await shieldJudgeOpinion(
      // The golden set is Waypoint's own text, written for testing: there is nobody whose
      // consent is needed, and no account to record the call against.
      { db, userId: null, isGuest: false, allowExternal: true },
      { text: c.text, country: c.country, locale: c.lang, rules },
      // Nobody is waiting: ten seconds a try and two retries.
      'background',
    );
    return judged ? { opinion: judged.opinion, score: judged.score } : null;
  };
