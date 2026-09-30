/**
 * Ask on the phone: the same conversation protocol as the website (AI SDK UI messages over a
 * streamed response), the same server-side safety order — the crisis check runs before any AI
 * call — and tools that save anything wait for the person to allow them.
 */
import type { Conversation, ConversationSummary } from '@waypoint/api/client';
import type { CrisisResponsePlan } from '@waypoint/core';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { api, apiHeaders, credentials } from '../api';
import { API_URL } from '../config';

export interface AskMode {
  mode: 'ai' | 'safe' | 'guided';
  reason?: string;
  model?: string;
}

export type AskMessage = UIMessage<
  { createdAt?: string },
  { crisis: CrisisResponsePlan; mode: AskMode }
>;

export type AskPart = AskMessage['parts'][number];

export interface ToolPartLike {
  type: string;
  toolCallId: string;
  state: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  approval?: { id: string; approved?: boolean };
}

/**
 * When the support card is the whole answer, the server also sends its words as text (kept for
 * the transcript). True for that repeat, so the screen shows it once.
 */
export function echoesCrisis(message: AskMessage, text: string): boolean {
  const crisis = message.parts.find((p) => p.type === 'data-crisis');
  if (crisis?.type !== 'data-crisis') return false;
  return text.trim() === `${crisis.data.headline} ${crisis.data.message}`.trim();
}

export function isToolPart(p: AskPart): p is AskPart & ToolPartLike {
  return typeof p.type === 'string' && p.type.startsWith('tool-');
}

export const TOOL_NAMES = [
  'find_support',
  'check_message',
  'suggest_roles',
  'find_learning',
  'money_runway',
  'life_checklist',
  'create_goal',
  'save_memory',
  'draft_plan',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const isToolName = (v: string): v is ToolName =>
  (TOOL_NAMES as readonly string[]).includes(v);

/** Only the newest message goes up: the server keeps the history, so it can't be rewritten. */
export function askTransport() {
  return new DefaultChatTransport<AskMessage>({
    api: `${API_URL}/api/ask`,
    credentials,
    headers: () => apiHeaders(),
    prepareSendMessagesRequest: ({ id, messages }) => ({
      body: { id, message: messages.at(-1) },
    }),
  });
}

export const MAX_MESSAGE = 4000;

export function listConversations(signal?: AbortSignal) {
  return api<ConversationSummary[]>('/ask/conversations', { signal });
}

export async function loadConversation(id: string, signal?: AbortSignal) {
  const c = await api<Conversation>(`/ask/conversations/${encodeURIComponent(id)}`, { signal });
  return { ...c, messages: c.messages as unknown as AskMessage[] };
}

export function deleteConversation(id: string) {
  return api(`/ask/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** A UUID from the phone's secure random generator (conversation and message ids). */
export const uuid = (): string => globalThis.crypto.randomUUID();
