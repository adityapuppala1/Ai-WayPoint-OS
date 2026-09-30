'use client';

// First: nothing in this module may try to compile code (see the file for why).
import '@/lib/no-eval';
import { useChat } from '@ai-sdk/react';
import type { AskUIMessage } from '@waypoint/ai';
import type { CrisisResponsePlan } from '@waypoint/core';
import { isInternalPath, safeExternalHref } from '@waypoint/core';
import { Button, ConfirmDialog, IconButton, Notice, Spinner, TextField } from '@waypoint/ui';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CrisisCard } from '@/components/support/CrisisCard';
import { uuid } from '@/lib/api';
import styles from './ask.module.css';

const MAX = 4000;

type ToolName =
  | 'find_support'
  | 'check_message'
  | 'suggest_roles'
  | 'find_learning'
  | 'money_runway'
  | 'life_checklist'
  | 'create_goal'
  | 'save_memory'
  | 'draft_plan';

type AnyPart = AskUIMessage['parts'][number];

interface ToolPartLike {
  type: string;
  toolCallId: string;
  state: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
  approval?: { id: string; approved?: boolean };
}

function isToolPart(p: AnyPart): p is AnyPart & ToolPartLike {
  return typeof p.type === 'string' && p.type.startsWith('tool-');
}

/** Only safe Markdown: no images, no raw HTML, links open outside the app. */
function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      allowedElements={[
        'p',
        'strong',
        'em',
        'ul',
        'ol',
        'li',
        'a',
        'code',
        'br',
        'h3',
        'h4',
        'blockquote',
      ]}
      unwrapDisallowed
      components={{
        a: ({ href, children }) => {
          if (href && isInternalPath(href)) return <Link href={href as Route}>{children}</Link>;
          const safe = href && /^(https?:|tel:|sms:|mailto:)/i.test(href) ? href : undefined;
          return safe ? (
            <a
              href={safe}
              target={safe.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer nofollow"
            >
              {children}
            </a>
          ) : (
            <span>{children}</span>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export interface ConversationListItem {
  id: string;
  title: string | null;
  updatedAt: string;
}

/** True when a text part only repeats the support card shown in the same message. */
function echoesCrisis(message: AskUIMessage, text: string): boolean {
  const crisis = message.parts.find((p) => p.type === 'data-crisis');
  if (!crisis) return false;
  const plan = crisis.data as CrisisResponsePlan;
  return text.trim() === `${plan.headline} ${plan.message}`.trim();
}

export function AskChat({
  chatId,
  initialMessages,
  conversations,
  prompt,
}: {
  chatId: string;
  initialMessages: AskUIMessage[];
  conversations: ConversationListItem[];
  prompt?: string;
}) {
  const t = useTranslations('ask');
  const common = useTranslations('common');
  const router = useRouter();
  const [input, setInput] = useState(prompt ?? '');
  const [dismissedCrisis, setDismissedCrisis] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AskUIMessage>({
        api: '/api/ask',
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { id, message: messages.at(-1) },
        }),
      }),
    [],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    clearError,
    regenerate,
    addToolApprovalResponse,
  } = useChat<AskUIMessage>({
    id: chatId,
    messages: initialMessages,
    generateId: uuid,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => router.refresh(),
  });

  const busy = status === 'submitted' || status === 'streaming';

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when a message arrives or the status changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, status]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    if (error) clearError();
    // Give the conversation a stable URL so refreshing (or router.refresh) keeps it open.
    if (!new URLSearchParams(window.location.search).get('c')) {
      window.history.replaceState(null, '', `/ask?c=${chatId}`);
    }
    void sendMessage({ text: value.slice(0, MAX) });
    setInput('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  const modeNote = (data: { mode: string; reason?: string }) => {
    if (data.mode === 'safe') return t('modeSafe');
    if (data.mode !== 'guided') return null;
    if (data.reason === 'no-consent') return t('modeGuidedNoConsent');
    if (
      data.reason === 'budget' ||
      data.reason === 'daily-limit' ||
      data.reason === 'monthly-budget'
    )
      return t('modeGuidedBudget');
    return t('modeGuided');
  };

  const renderTool = (part: ToolPartLike) => {
    const name = part.type.slice(5) as ToolName;
    const label = t(`tools.${name}` as 'tools.find_support');
    if (part.state === 'approval-requested' && part.approval) {
      const approvalId = part.approval.id;
      const input = part.input ?? {};
      const summary =
        typeof input.title === 'string'
          ? input.title
          : typeof input.content === 'string'
            ? input.content
            : undefined;
      return (
        <fieldset key={part.toolCallId} className={styles.approval}>
          <legend className={styles.approvalTitle}>{t('approveTitle', { action: label })}</legend>
          {summary ? <p className={styles.approvalDetail}>“{summary}”</p> : null}
          <div className="wp-row">
            <Button
              variant="primary"
              size="sm"
              icon="check"
              onPress={() => addToolApprovalResponse({ id: approvalId, approved: true })}
            >
              {t('approve')}
            </Button>
            <Button
              variant="quiet"
              size="sm"
              onPress={() =>
                addToolApprovalResponse({
                  id: approvalId,
                  approved: false,
                  reason: 'declined by person',
                })
              }
            >
              {t('decline')}
            </Button>
          </div>
        </fieldset>
      );
    }
    if (part.state === 'approval-responded') {
      return (
        <p key={part.toolCallId} className={styles.toolLine}>
          {part.approval?.approved ? t('approved') : t('declined')}
        </p>
      );
    }
    if (part.state === 'output-denied') {
      return (
        <p key={part.toolCallId} className={styles.toolLine}>
          {t('declined')}
        </p>
      );
    }
    if (part.state === 'output-error') {
      return (
        <p key={part.toolCallId} className={styles.toolLine}>
          {t('errorGeneric')}
        </p>
      );
    }
    if (part.state === 'output-available') {
      const out = part.output ?? {};
      const href = typeof out.href === 'string' ? out.href : null;
      const savedLabel =
        name === 'create_goal'
          ? t('savedGoal')
          : name === 'draft_plan'
            ? t('savedPlan')
            : name === 'save_memory'
              ? t('savedMemory')
              : label;
      return (
        <p key={part.toolCallId} className={styles.toolLine}>
          <span>{savedLabel}</span>
          {href ? <Link href={href as Route}>{t('openIt')}</Link> : null}
        </p>
      );
    }
    return (
      <p key={part.toolCallId} className={styles.toolLine}>
        <Spinner label={t('toolRunning')} /> <span>{label}</span>
      </p>
    );
  };

  return (
    <div className={styles.layout}>
      <section className={styles.chat} aria-label={t('title')}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('title')}</h1>
            <p className={styles.disclosure}>{t('disclosure')}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon="add"
            onPress={() => router.push('/ask' as Route)}
          >
            {t('newChat')}
          </Button>
        </div>

        <ol className={styles.messages} aria-live="polite" aria-busy={busy}>
          {messages.length === 0 ? (
            <li className={styles.starters}>
              <p className={styles.startersTitle}>{t('starters')}</p>
              <ul>
                {(['starter1', 'starter2', 'starter3', 'starter4'] as const).map((k) => (
                  <li key={k}>
                    <Button variant="secondary" onPress={() => send(t(k))}>
                      {t(k)}
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
          {messages.map((m) => (
            <li key={m.id} className={m.role === 'user' ? styles.user : styles.assistant}>
              <p className="wp-visually-hidden">{m.role === 'user' ? t('you') : t('waypoint')}:</p>
              {m.parts.map((part, i) => {
                const key = `${m.id}-${i}`;
                if (part.type === 'text') {
                  // When the support card is the whole answer, the text repeats it word for word
                  // (kept for the transcript); show it only once the card is closed.
                  if (m.role !== 'user' && !dismissedCrisis.has(m.id) && echoesCrisis(m, part.text))
                    return null;
                  return m.role === 'user' ? (
                    <p key={key} className={styles.userText} dir="auto">
                      {part.text}
                    </p>
                  ) : (
                    <div key={key} className={styles.assistantText} dir="auto">
                      <Markdown text={part.text} />
                    </div>
                  );
                }
                if (part.type === 'data-crisis') {
                  if (dismissedCrisis.has(m.id)) return null;
                  return (
                    <CrisisCard
                      key={key}
                      plan={part.data as CrisisResponsePlan}
                      onStay={() => setDismissedCrisis((s) => new Set(s).add(m.id))}
                    />
                  );
                }
                if (part.type === 'data-mode') {
                  const note = modeNote(part.data);
                  return note ? (
                    <p key={key} className={styles.mode}>
                      {note}
                    </p>
                  ) : null;
                }
                if (part.type === 'source-url') {
                  // A source a model cited is data: only a secure web page becomes a link.
                  const href = safeExternalHref(part.url);
                  return (
                    <p key={key} className={styles.source}>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {part.title ?? part.url}
                        </a>
                      ) : (
                        (part.title ?? part.url)
                      )}
                    </p>
                  );
                }
                if (isToolPart(part)) return renderTool(part);
                return null;
              })}
            </li>
          ))}
          {status === 'submitted' ? (
            <li className={styles.assistant}>
              <p className={styles.toolLine}>
                <Spinner label={t('thinking')} /> <span>{t('thinking')}</span>
              </p>
            </li>
          ) : null}
        </ol>

        {error ? (
          <Notice
            tone="danger"
            role="alert"
            title={t('errorGeneric')}
            actions={
              <Button variant="secondary" size="sm" icon="retry" onPress={() => void regenerate()}>
                {common('retry')}
              </Button>
            }
          />
        ) : null}
        <div ref={bottomRef} />

        <form className={styles.composer} onSubmit={onSubmit}>
          <div className={styles.inputWrap}>
            <TextField
              label={t('inputLabel')}
              multiline
              rows={2}
              placeholder={t('inputPlaceholder')}
              value={input}
              onChange={(v) => setInput(v.slice(0, MAX))}
              maxLength={MAX}
              className={styles.input}
              onKeyDown={onKeyDown}
            />
          </div>
          <div className={styles.composerActions}>
            {input.length > MAX * 0.8 ? (
              <span className="wp-meta">{t('charCount', { count: input.length, max: MAX })}</span>
            ) : null}
            {busy ? (
              <Button variant="secondary" icon="stop" onPress={() => void stop()}>
                {t('stop')}
              </Button>
            ) : (
              <Button type="submit" variant="primary" icon="send" isDisabled={!input.trim()}>
                {t('send')}
              </Button>
            )}
          </div>
        </form>
      </section>

      <aside className={styles.history} aria-labelledby="history-title">
        <h2 id="history-title" className={styles.historyTitle}>
          {t('history')}
        </h2>
        {conversations.length ? (
          <ul className={styles.historyList}>
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/ask?c=${c.id}` as Route}
                  className={styles.historyLink}
                  aria-current={c.id === chatId ? 'page' : undefined}
                >
                  {c.title ?? t('title')}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-secondary">{t('historyEmpty')}</p>
        )}
        {conversations.some((c) => c.id === chatId) ? (
          <>
            <IconButton
              icon="delete"
              label={t('deleteChat')}
              tone="outlined"
              onPress={() => setConfirmDelete(true)}
            />
            <ConfirmDialog
              isOpen={confirmDelete}
              onOpenChange={setConfirmDelete}
              title={t('deleteChat')}
              confirmLabel={common('delete')}
              cancelLabel={common('cancel')}
              tone="danger"
              onConfirm={async () => {
                await fetch(`/api/ask/conversations/${chatId}`, { method: 'DELETE' });
                router.push('/ask' as Route);
                router.refresh();
              }}
            >
              <p>{t('deleteConfirm')}</p>
            </ConfirmDialog>
          </>
        ) : null}
      </aside>
    </div>
  );
}
