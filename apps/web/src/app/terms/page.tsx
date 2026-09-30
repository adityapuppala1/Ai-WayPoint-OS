/** The public terms of use, in plain words and every language Waypoint speaks. */
import { legal } from '@waypoint/api';
import { LEGAL_UPDATED, MINIMUM_AGE } from '@waypoint/core';
import { LinkButton } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  Actions,
  contactSection,
  LegalDocument,
  LegalFoot,
  Points,
  updatedOn,
  WhoRuns,
} from '@/components/legal/LegalDocument';
import { PublicShell } from '@/components/shell/PublicShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.terms');
  return { title: t('title'), description: t('lead') };
}

export default async function TermsPage() {
  const [t, common, nav, format] = await Promise.all([
    getTranslations('legal.terms'),
    getTranslations('legal'),
    getTranslations('nav'),
    getFormatter(),
  ]);
  const facts = legal.legalFacts();

  const sections = [
    { id: 'about', title: t('about.title'), children: <p>{t('about.body')}</p> },
    {
      id: 'what',
      title: t('what.title'),
      children: (
        <>
          <p>{t('what.body')}</p>
          <Points
            items={(['advice', 'ai', 'shield', 'forecasts', 'services'] as const).map((id) => ({
              id,
              text: t(`what.${id}`),
            }))}
          />
        </>
      ),
    },
    {
      id: 'emergency',
      title: t('emergency.title'),
      children: (
        <>
          <p>{t('emergency.body')}</p>
          <Actions>
            <LinkButton href={'/support' as Route} variant="support" icon="support">
              {nav('support')}
            </LinkButton>
          </Actions>
        </>
      ),
    },
    {
      id: 'who',
      title: t('who.title'),
      children: (
        <Points
          items={[
            { id: 'age', text: t('who.age', { age: format.number(MINIMUM_AGE) }) },
            { id: 'account', text: t('who.account') },
            { id: 'guest', text: t('who.guest') },
          ]}
        />
      ),
    },
    {
      id: 'fair',
      title: t('fair.title'),
      children: (
        <Points
          items={(['harm', 'private', 'illegal', 'break', 'identify'] as const).map((id) => ({
            id,
            text: t(`fair.${id}`),
          }))}
        />
      ),
    },
    {
      id: 'circles',
      title: t('circles.title'),
      children: (
        <>
          <p>{t('circles.body')}</p>
          <p>{t('circles.moderation')}</p>
        </>
      ),
    },
    {
      id: 'content',
      title: t('content.title'),
      children: (
        <>
          <p>{t('content.body')}</p>
          <p>{t('content.reports')}</p>
        </>
      ),
    },
    {
      id: 'organisations',
      title: t('organisations.title'),
      children: <p>{t('organisations.body')}</p>,
    },
    { id: 'texting', title: t('texting.title'), children: <p>{t('texting.body')}</p> },
    {
      id: 'service',
      title: t('service.title'),
      children: (
        <>
          <p>{t('service.body')}</p>
          <p>{t('service.changes')}</p>
        </>
      ),
    },
    {
      id: 'ending',
      title: t('ending.title'),
      children: (
        <>
          <p>{t('ending.you')}</p>
          <p>{t('ending.us')}</p>
        </>
      ),
    },
    {
      id: 'liability',
      title: t('liability.title'),
      children: (
        <>
          <p>{t('liability.body')}</p>
          <p>{t('liability.rights')}</p>
        </>
      ),
    },
    { id: 'law', title: t('law.title'), children: <p>{t('law.body')}</p> },
    { id: 'changes', title: t('changes.title'), children: <p>{t('changes.body')}</p> },
    await contactSection(facts),
  ];

  return (
    <PublicShell>
      <LegalDocument
        title={t('title')}
        lead={t('lead')}
        updated={await updatedOn(LEGAL_UPDATED.terms)}
        who={<WhoRuns facts={facts} />}
        shortTitle={common('shortTitle')}
        short={[
          { icon: 'ask', text: t('short.guidance') },
          { icon: 'phone', text: t('short.emergency') },
          { icon: 'circles', text: t('short.kind') },
          { icon: 'lock', text: t('short.yours') },
        ]}
        contentsLabel={common('onThisPage')}
        sections={sections}
        foot={<LegalFoot current="terms" />}
      />
    </PublicShell>
  );
}
