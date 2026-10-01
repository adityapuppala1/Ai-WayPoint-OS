'use client';

import type { integrations } from '@waypoint/api';
import { integrationById } from '@waypoint/core/console';
import {
  Button,
  Checkbox,
  Disclosure,
  Icon,
  IconButton,
  type IconName,
  SelectField,
  Sparkline,
  TextField,
  toast,
} from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useState, useTransition } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import styles from './admin.module.css';

type View = integrations.IntegrationView;
type Field = View['fields'][number];

const STATUS_ICON: Record<View['status'], IconName> = {
  ok: 'safe',
  failing: 'danger',
  untested: 'info',
  off: 'minus',
};

/** The order AI providers are tried in, with every provider listed once. */
function providerOrder(value: string | null, options: string[]): string[] {
  const chosen = (value ?? 'anthropic,openai,google,ollama')
    .split(',')
    .filter((v) => options.includes(v));
  return [...new Set([...chosen, ...options])];
}

/**
 * One outside service: how it is doing, what it has been used for, its last check, and its
 * settings. A secret is never shown or sent back: only its last four characters, with a way to
 * replace or remove it. A setting made on the server can only be read here.
 */
export function IntegrationCard({
  view,
  name,
  at,
}: {
  view: View;
  name: string;
  /** When the page was drawn: times read "3 minutes ago" from it, the same on both sides. */
  at: string;
}) {
  const t = useTranslations('admin.int');
  const errorsT = useTranslations('errors');
  const format = useFormatter();
  const now = new Date(at);
  const router = useRouter();
  const [, startTransition] = useTransition();
  /** Pending changes by setting: a value, or null to remove the saved one. */
  const [edits, setEdits] = useState<Record<string, string | null>>({});
  /** Secrets being replaced (the field shows instead of the saved hint). */
  const [replacing, setReplacing] = useState<Record<string, boolean>>({});
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'save' | 'check' | null>(null);

  const dirty = Object.keys(edits).length > 0;
  const models = view.check?.models ?? [];
  const label = (key: string) =>
    /_API_KEY$/.test(key)
      ? t('fields.apiKey')
      : /^AI_MODEL_.+_SMALL$/.test(key)
        ? t('fields.small')
        : /^AI_MODEL_.+_LARGE$/.test(key)
          ? t('fields.large')
          : t.has(`fields.${key}` as 'fields.apiKey')
            ? t(`fields.${key}` as 'fields.apiKey')
            : t('fields.secret');

  const set = (key: string, value: string | null) => {
    setEdits((e) => ({ ...e, [key]: value }));
    setProblems((p) => {
      const { [key]: _, ...rest } = p;
      return rest;
    });
  };
  const undo = (key: string) => {
    setEdits(({ [key]: _, ...rest }) => rest);
    setReplacing(({ [key]: _, ...rest }) => rest);
  };

  const check = async () => {
    setBusy('check');
    try {
      const result = await api<{ ok: boolean; detail: string }>(
        `/api/admin/integrations/${view.id}/check`,
        { method: 'POST' },
      );
      toast({
        title: result.ok
          ? t('checkOk', { detail: result.detail })
          : t('checkFailed', { detail: result.detail }),
        tone: result.ok ? 'safe' : 'danger',
      });
      startTransition(() => router.refresh());
    } catch (err) {
      toast({ title: errorsT(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const save = async (thenCheck: boolean) => {
    if (!dirty) return;
    setBusy('save');
    try {
      await api(`/api/admin/integrations/${view.id}`, { method: 'PUT', json: { values: edits } });
      setEdits({});
      setReplacing({});
      setProblems({});
      toast({ title: t('saved'), tone: 'safe' });
      if (thenCheck) await check();
      else startTransition(() => router.refresh());
    } catch (err) {
      if (err instanceof ApiProblem && err.issues.length) {
        setProblems(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
        toast({ title: t('notSaved'), tone: 'danger' });
      } else toast({ title: errorsT(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const field = (f: Field) => {
    const error = problems[f.key];
    const edited = f.key in edits;
    const value = edited ? (edits[f.key] ?? '') : null;

    if (f.source === 'server')
      return (
        <div key={f.key} className={styles.readonlyField}>
          <span className={styles.readonlyLabel}>{label(f.key)}</span>
          <span className={styles.readonlyValue}>
            <Icon name="lock" size={16} />
            {t('fromServer', { shown: f.shown ?? '' })}
          </span>
        </div>
      );

    if (f.kind === 'secret' && f.shown && !replacing[f.key])
      return (
        <div key={f.key} className={styles.readonlyField}>
          <span className={styles.readonlyLabel}>{label(f.key)}</span>
          <span className={styles.readonlyValue}>
            {edited && edits[f.key] === null ? t('willRemove') : t('savedHere', { shown: f.shown })}
          </span>
          <span className="wp-row">
            {edited ? (
              <Button size="sm" variant="quiet" onPress={() => undo(f.key)}>
                {t('keep')}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => setReplacing((r) => ({ ...r, [f.key]: true }))}
                >
                  {t('replace')}
                </Button>
                <Button size="sm" variant="quiet" onPress={() => set(f.key, null)}>
                  {t('remove')}
                </Button>
              </>
            )}
          </span>
        </div>
      );

    if (f.key === 'AI_PROVIDER_ORDER') {
      const order = providerOrder(value ?? f.shown ?? f.fallback, f.options ?? []);
      const move = (from: number, to: number) => {
        const next = [...order];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item!);
        set(f.key, next.join(','));
      };
      return (
        <fieldset key={f.key} className={styles.orderField}>
          <legend>{label(f.key)}</legend>
          <p className="wp-meta">{t('orderHint')}</p>
          <ol className={styles.orderList}>
            {order.map((id, i) => (
              <li key={id}>
                <span className="wp-num">{i + 1}</span>
                <span>{integrationById(id)?.name ?? id}</span>
                <IconButton
                  icon="chevronDown"
                  className={styles.flipUp}
                  label={t('moveUp', { name: integrationById(id)?.name ?? id })}
                  isDisabled={i === 0}
                  onPress={() => move(i, i - 1)}
                />
                <IconButton
                  icon="chevronDown"
                  label={t('moveDown', { name: integrationById(id)?.name ?? id })}
                  isDisabled={i === order.length - 1}
                  onPress={() => move(i, i + 1)}
                />
              </li>
            ))}
          </ol>
        </fieldset>
      );
    }

    if (f.kind === 'list' && f.options) {
      const chosen = new Set((value ?? f.shown ?? f.fallback ?? '').split(',').filter(Boolean));
      return (
        <fieldset
          key={f.key}
          className={styles.checkField}
          aria-describedby={error ? `${f.key}-error` : undefined}
        >
          <legend>{label(f.key)}</legend>
          <div className={styles.checkRow}>
            {f.options.map((o) => (
              <Checkbox
                key={o}
                isSelected={chosen.has(o)}
                onChange={(on) => {
                  const next = new Set(chosen);
                  if (on) next.add(o);
                  else next.delete(o);
                  set(f.key, f.options!.filter((x) => next.has(x)).join(','));
                }}
              >
                {o}
              </Checkbox>
            ))}
          </div>
          {error ? (
            <p id={`${f.key}-error`} className={styles.fieldError}>
              {error}
            </p>
          ) : null}
        </fieldset>
      );
    }

    if (f.kind === 'choice' && f.options)
      return (
        <SelectField
          key={f.key}
          label={label(f.key)}
          options={f.options.map((o) => ({ id: o, label: o }))}
          selectedKey={value ?? f.shown ?? f.fallback ?? f.options[0] ?? null}
          onSelectionChange={(k) => set(f.key, String(k))}
          errorMessage={error}
          isInvalid={Boolean(error)}
        />
      );

    const isModel = /^AI_MODEL_/.test(f.key);
    if (isModel && models.length) {
      const current = value ?? f.shown ?? f.fallback ?? '';
      const options = [...new Set([current, ...models].filter(Boolean))];
      return (
        <SelectField
          key={f.key}
          label={label(f.key)}
          options={options.map((o) => ({ id: o, label: o }))}
          selectedKey={current}
          onSelectionChange={(k) => set(f.key, String(k))}
          description={f.fallback ? t('defaultValue', { value: f.fallback }) : undefined}
          errorMessage={error}
          isInvalid={Boolean(error)}
        />
      );
    }

    return (
      <TextField
        key={f.key}
        label={label(f.key)}
        type={
          f.kind === 'secret'
            ? 'password'
            : f.kind === 'number'
              ? 'text'
              : f.kind === 'url'
                ? 'url'
                : 'text'
        }
        inputMode={f.kind === 'number' ? 'decimal' : undefined}
        autoComplete="off"
        spellCheck="false"
        placeholder={f.placeholder ?? undefined}
        value={value ?? (f.kind === 'secret' ? '' : (f.shown ?? ''))}
        onChange={(v) => set(f.key, v)}
        description={f.fallback ? t('defaultValue', { value: f.fallback }) : undefined}
        errorMessage={error}
        isInvalid={Boolean(error)}
      />
    );
  };

  const usage = view.usage;
  const isAi = view.group === 'ai' || view.group === 'judge';
  const countLabel = isAi
    ? t('usage.calls')
    : view.group === 'email'
      ? t('usage.emails')
      : t('usage.messages');
  const percent = (n: number, of: number) =>
    format.number(of ? n / of : 0, { style: 'percent', maximumFractionDigits: 1 });
  const ms = (v: number) =>
    v >= 1000
      ? format.number(v / 1000, { style: 'unit', unit: 'second', maximumFractionDigits: 1 })
      : format.number(v, { style: 'unit', unit: 'millisecond', maximumFractionDigits: 0 });

  return (
    <article
      className={styles.intCard}
      data-status={view.status}
      aria-labelledby={`int-${view.id}`}
    >
      <header className={styles.intHead}>
        <h3 id={`int-${view.id}`}>{name}</h3>
        {view.id.endsWith('-settings') ? null : (
          <span className={styles.statusPill} data-status={view.status}>
            <Icon name={STATUS_ICON[view.status]} size={16} />
            {t(`status.${view.status}`)}
          </span>
        )}
      </header>

      {view.id === 'typesafe' ? <p className="wp-meta">{t('judgeNote')}</p> : null}

      {usage && view.configured ? (
        <div className={styles.intUsage}>
          <dl className={styles.intStats}>
            <div>
              <dt>{countLabel}</dt>
              <dd className="wp-num">{format.number(usage.count)}</dd>
              {usage.breakdown.length === 2 ? (
                <dd className="wp-meta">
                  {t('usage.inOut', {
                    in: format.number(usage.breakdown[0]!.count),
                    out: format.number(usage.breakdown[1]!.count),
                  })}
                </dd>
              ) : usage.breakdown.length === 3 ? (
                <dd className="wp-meta">
                  {t('usage.waiting', { n: format.number(usage.breakdown[2]!.count) })}
                </dd>
              ) : null}
            </div>
            <div>
              <dt>{t('usage.failed')}</dt>
              <dd className="wp-num">{format.number(usage.errors)}</dd>
              <dd className="wp-meta">
                {t('usage.failRate', {
                  rate: percent(
                    usage.errors,
                    view.group === 'email' ? usage.count + usage.errors : usage.count,
                  ),
                })}
              </dd>
            </div>
            {usage.costUsd !== null ? (
              <div>
                <dt>{t('usage.cost')}</dt>
                <dd className="wp-num">
                  {format.number(usage.costUsd, { style: 'currency', currency: 'USD' })}
                </dd>
                {usage.inputTokens !== null ? (
                  <dd className="wp-meta">
                    {t('usage.tokens', {
                      input: format.number(usage.inputTokens, { notation: 'compact' }),
                      output: format.number(usage.outputTokens ?? 0, { notation: 'compact' }),
                    })}
                  </dd>
                ) : null}
              </div>
            ) : null}
            {usage.latencyP50Ms !== null ? (
              <div>
                <dt>{t('usage.latency')}</dt>
                <dd className="wp-num">{ms(usage.latencyP50Ms)}</dd>
                <dd className="wp-meta">
                  {t('usage.latencyNote', {
                    p50: ms(usage.latencyP50Ms),
                    p95: ms(usage.latencyP95Ms ?? usage.latencyP50Ms),
                  })}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>{t('usage.lastUsed')}</dt>
              <dd>
                {usage.lastUsedAt ? (
                  <time dateTime={usage.lastUsedAt}>
                    {format.relativeTime(new Date(usage.lastUsedAt), now)}
                  </time>
                ) : (
                  t('usage.never')
                )}
              </dd>
            </div>
          </dl>
          {usage.daily.length && usage.count ? (
            <Sparkline
              values={usage.daily.map((d) => d.count)}
              label={`${countLabel}. ${t('usage.daily')}`}
              module="ask"
            />
          ) : null}
        </div>
      ) : null}

      {view.check ? (
        <p className={styles.intCheck} data-ok={view.check.ok}>
          <Icon name={view.check.ok ? 'check' : 'caution'} size={16} />
          <span>
            {t('lastCheck', {
              when: format.relativeTime(new Date(view.check.checkedAt), now),
              detail: view.check.detail,
            })}
          </span>
        </p>
      ) : null}

      <div className="wp-row">
        {view.testable && view.configured ? (
          <Button
            size="sm"
            variant="secondary"
            icon="retry"
            isBusy={busy === 'check'}
            isDisabled={busy !== null}
            onPress={check}
          >
            {t('check')}
          </Button>
        ) : null}
        {view.docs.startsWith('http') ? (
          <a className={styles.intDocs} href={view.docs} target="_blank" rel="noreferrer noopener">
            {t('docs')}
            <Icon name="external" size={14} />
          </a>
        ) : null}
      </div>

      <Disclosure title={t('settings')} headingLevel={4} defaultExpanded={false}>
        <form
          className={styles.intForm}
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void save(false);
          }}
          noValidate
        >
          {view.fields.map(field)}
          <div className="wp-row">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isBusy={busy === 'save'}
              isDisabled={!dirty || busy !== null}
            >
              {t('save')}
            </Button>
            {view.testable ? (
              <Button
                size="sm"
                variant="secondary"
                isDisabled={!dirty || busy !== null}
                onPress={() => void save(true)}
              >
                {t('saveCheck')}
              </Button>
            ) : null}
          </div>
        </form>
      </Disclosure>
    </article>
  );
}
