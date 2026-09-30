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
export { detectIntent, offlineReply } from './offline';
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
  monthSpendUsd,
  recordUsage,
  reserveUsage,
  resetSpendCacheForTests,
  settleUsage,
} from './usage';
