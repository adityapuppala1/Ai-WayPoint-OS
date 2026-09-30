/**
 * The public privacy notice. Plain words, in every language Waypoint speaks, and specific to
 * this installation: who runs it and which outside services it really uses come from its
 * configuration (see `legal.legalFacts`).
 */
import { legal } from '@waypoint/api';
import { LEGAL_UPDATED, MINIMUM_AGE, UNCONFIRMED_ACCOUNT_DAYS } from '@waypoint/core';
import { LinkButton } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  Actions,
  contactSection,
  LegalDocument,
  LegalFoot,
  Points,
  Rows,
  updatedOn,
  WhoRuns,
} from '@/components/legal/LegalDocument';
import { PublicShell } from '@/components/shell/PublicShell';
import { OFFERED_CONSENTS } from '@/lib/options';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.privacy');
  return { title: t('title'), description: t('lead') };
}

export default async function PrivacyNoticePage() {
  const [t, common, consents, settings, nav, format] = await Promise.all([
    getTranslations('legal.privacy'),
    getTranslations('legal'),
    getTranslations('consents'),
    getTranslations('settings'),
    getTranslations('nav'),
    getFormatter(),
  ]);
  const facts = legal.legalFacts();
  const k = format.number(facts.k);
  const uses = (names: string[]) =>
    names.length
      ? common('inUse', { names: format.list(names, { type: 'conjunction' }) })
      : common('notInUse');
  const inUse = (names: string[]) => <span className="wp-meta">{uses(names)}</span>;

  const sections = [
    {
      id: 'collect',
      title: t('collect.title'),
      children: (
        <>
          <p>{t('collect.lead')}</p>
          <Rows
            rows={(['account', 'profile', 'writing', 'phone', 'security'] as const).map((id) => ({
              id,
              term: t(`collect.${id}`),
              detail: t(`collect.${id}Why`),
            }))}
          />
        </>
      ),
    },
    {
      id: 'never',
      title: t('never.title'),
      children: (
        <Points
          items={(['scam', 'crisis', 'location', 'tracking'] as const).map((id) => ({
            id,
            text: t(`never.${id}`),
          }))}
        />
      ),
    },
    {
      id: 'choices',
      title: t('choices.title'),
      children: (
        <>
          <p>{t('choices.lead')}</p>
          <Rows
            // Only the choices Privacy settings offers: a purpose nothing acts on is not listed.
            rows={OFFERED_CONSENTS.map((purpose) => ({
              id: purpose,
              term: consents(purpose),
              detail: consents(`${purpose}Hint`),
            }))}
          />
        </>
      ),
    },
    {
      id: 'ai',
      title: t('ai.title'),
      children: (
        <>
          <p>{t('ai.guide')}</p>
          <p>{t('ai.off')}</p>
          <p>{t('ai.on')}</p>
          <p>{t('ai.shield')}</p>
          <p>{facts.aiProviders.length ? uses(facts.aiProviders) : t('ai.noProviders')}</p>
          <p>{t('ai.training')}</p>
          <p>{t('ai.approval')}</p>
        </>
      ),
    },
    {
      id: 'crisis',
      title: t('crisis.title'),
      children: (
        <>
          <p>{t('crisis.body')}</p>
          <p>{t('crisis.contact')}</p>
          <Actions>
            <LinkButton href={'/support' as Route} variant="support" icon="support">
              {nav('support')}
            </LinkButton>
          </Actions>
        </>
      ),
    },
    {
      id: 'share',
      title: t('share.title'),
      children: (
        <>
          <p>{t('share.lead')}</p>
          <Rows
            rows={[
              {
                id: 'ai',
                term: t('share.ai'),
                detail: (
                  <>
                    <span>{t('share.aiGets')}</span>
                    {inUse(facts.aiProviders)}
                  </>
                ),
              },
              {
                id: 'texting',
                term: t('share.texting'),
                detail: (
                  <>
                    <span>{t('share.textingGets')}</span>
                    {inUse(facts.textingProviders)}
                  </>
                ),
              },
              {
                id: 'email',
                term: t('share.email'),
                detail: (
                  <>
                    <span>{t('share.emailGets')}</span>
                    {inUse(facts.emailProvider ? [facts.emailProvider] : [])}
                  </>
                ),
              },
              { id: 'weather', term: t('share.weather'), detail: t('share.weatherGets') },
              {
                id: 'hosting',
                term: t('share.hosting'),
                detail: (
                  <>
                    <span>{t('share.hostingGets')}</span>
                    {facts.dataLocation ? (
                      <span className="wp-meta">
                        {common('dataLocation', { place: facts.dataLocation })}
                      </span>
                    ) : null}
                  </>
                ),
              },
              {
                id: 'organisations',
                term: t('share.organisations'),
                detail: t('share.organisationsGets', { k }),
              },
              {
                id: 'authorities',
                term: t('share.authorities'),
                detail: t('share.authoritiesGets'),
              },
            ]}
          />
        </>
      ),
    },
    {
      id: 'keep',
      title: t('keep.title'),
      children: (
        <Rows
          rows={[
            ...(['conversations', 'guests'] as const).map((id) => ({
              id,
              term: t(`keep.${id}`),
              detail: t(`keep.${id}Time`),
            })),
            {
              id: 'unconfirmed',
              term: t('keep.unconfirmed'),
              detail: t('keep.unconfirmedTime', { count: UNCONFIRMED_ACCOUNT_DAYS }),
            },
            ...(['numbers', 'outbox', 'totals', 'reports', 'rest'] as const).map((id) => ({
              id,
              term: t(`keep.${id}`),
              detail: t(`keep.${id}Time`),
            })),
            ...(facts.backupDays
              ? [
                  {
                    id: 'backups',
                    term: t('keep.backups'),
                    detail: t('keep.backupsTime', { count: facts.backupDays }),
                  },
                ]
              : []),
          ]}
        />
      ),
    },
    {
      id: 'security',
      title: t('security.title'),
      children: (
        <Points
          items={(['encryption', 'transport', 'sessions', 'staff'] as const).map((id) => ({
            id,
            text: t(`security.${id}`),
          }))}
        />
      ),
    },
    {
      id: 'rights',
      title: t('rights.title'),
      children: (
        <>
          <p>{t('rights.lead')}</p>
          <Points
            items={(['see', 'correct', 'delete', 'withdraw', 'complain'] as const).map((id) => ({
              id,
              text: t(`rights.${id}`),
            }))}
          />
          <p className="wp-meta">{common('appNote')}</p>
          <Actions>
            <LinkButton href={'/settings/privacy' as Route} variant="secondary" icon="lock">
              {settings('privacyTitle')}
            </LinkButton>
          </Actions>
        </>
      ),
    },
    {
      id: 'children',
      title: t('children.title'),
      children: (
        <>
          <p>{t('children.body', { age: format.number(MINIMUM_AGE) })}</p>
          <p>{t('children.remove')}</p>
        </>
      ),
    },
    {
      id: 'transfers',
      title: t('transfers.title'),
      children: (
        <>
          {facts.dataLocation ? (
            <p>{common('dataLocation', { place: facts.dataLocation })}</p>
          ) : null}
          <p>{t('transfers.body')}</p>
        </>
      ),
    },
    { id: 'changes', title: t('changes.title'), children: <p>{t('changes.body')}</p> },
    await contactSection(facts),
  ];

  return (
    <PublicShell>
      <LegalDocument
        title={t('title')}
        lead={t('lead')}
        updated={await updatedOn(LEGAL_UPDATED.privacy)}
        who={<WhoRuns facts={facts} />}
        shortTitle={common('shortTitle')}
        short={[
          { icon: 'check', text: t('short.optional') },
          { icon: 'lock', text: t('short.encrypted') },
          { icon: 'hide', text: t('short.never') },
          { icon: 'team', text: t('short.organisations', { k }) },
          { icon: 'download', text: t('short.control') },
        ]}
        contentsLabel={common('onThisPage')}
        sections={sections}
        foot={<LegalFoot current="privacy" />}
      />
    </PublicShell>
  );
}
