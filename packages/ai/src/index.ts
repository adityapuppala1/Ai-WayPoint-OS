/**
 * @waypoint/ai — the AI gateway. Server-only.
 */
export {
  type AskDataParts,
  type AskInput,
  type AskMode,
  type AskUIMessage,
  askResponse,
  conversationCrisis,
} from './ask';
export {
  type CallerContext,
  channelAnswer,
  digestArticle,
  embedText,
  personalisePlan,
  plainChannelText,
  type SignalDigest,
  shieldOpinion,
} from './features';
export {
  type JudgeContext,
  type JudgeOutcome,
  type JudgeRefusal,
  type JudgeStandIn,
  judgeAvailable,
  judgeConfigured,
  judgeLanguageEnabled,
  overrideJudgeForTests,
  runJudge,
} from './judge';
export {
  type JevAnswer,
  type JevRequest,
  type JevResponse,
  JUDGE_LIMITS,
  JUDGE_PACE,
  JUDGE_PROVIDER,
  JudgeError,
  type JudgeErrorKind,
} from './judge-client';
export {
  type AnswerOf,
  choice,
  defineQuestions,
  type JudgeAnswers,
  type JudgeState,
  noul,
  type QuestionSet,
  score,
} from './judge-questions';
export { detectIntent, guidedIntent, offlineReply } from './offline';
export { companionInstructions, LANGUAGE_NAMES } from './prompts';
export {
  aiAvailable,
  configuredProviders,
  embeddingModel,
  type ModelChoice,
  modelCandidates,
  overrideModelsForTests,
  type ProviderId,
  pickModel,
  providerHealthy,
  reportProviderFailure,
  reportProviderSuccess,
  resetProvidersForTests,
  type Tier,
} from './providers';
export { type RunOutcome, runModel } from './run';
export { APPROVAL_TOOLS, type CompanionTools, companionTools, type ToolContext } from './tools';
export {
  type AiFeature,
  checkBudget,
  DAILY_LIMITS,
  estimateCostUsd,
  GUEST_BUDGET_SHARE,
  JUDGE_FEATURES,
  type JudgeFeature,
  monthSpendUsd,
  recordUsage,
  reserveUsage,
  resetSpendCacheForTests,
  settleUsage,
} from './usage';
