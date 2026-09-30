/**
 * Get help now. Emergency numbers and checked support services for the person's country,
 * built into the app so they work with no connection at all. Only the "reach us by text"
 * numbers come from the server, and the last ones seen are kept for offline use.
 */
import type { PublicChannels } from '@waypoint/api/client';
import { type SupportResourceView, supportDirectory } from '@waypoint/content';
import { ltr } from '@waypoint/core/text';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { api } from '../../src/api';
import { useAppLocale } from '../../src/i18n';
import { openLink, telHref } from '../../src/links';
import { countryName, useCountry } from '../../src/place';
import { readJson, writeJson } from '../../src/storage';
import { useTheme } from '../../src/theme';
import { Button, Icon, Panel, Screen, Text } from '../../src/ui';

type KindKey =
  | 'crisis-line'
  | 'text-line'
  | 'chat'
  | 'mental-health'
  | 'domestic-violence'
  | 'child-helpline'
  | 'elder-abuse'
  | 'poison'
  | 'directory';

const CHANNELS_KEY = 'waypoint.channels.v1';

/** Where people can text Waypoint; the last answer is kept so it shows offline too. */
function useTextChannels(): PublicChannels | null {
  const [channels, setChannels] = useState<PublicChannels | null>(null);
  useEffect(() => {
    let alive = true;
    readJson<PublicChannels>(CHANNELS_KEY).then((saved) => {
      if (alive && saved) setChannels((current) => current ?? saved);
    });
    api<PublicChannels>('/channels')
      .then((fresh) => {
        if (!alive) return;
        setChannels(fresh);
        void writeJson(CHANNELS_KEY, fresh);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return channels;
}

function Service({ r }: { r: SupportResourceView }) {
  const t = useTranslations('support');
  const kinds = useTranslations('supportKinds');
  const theme = useTheme();
  return (
    <View
      style={{
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: theme.colors.borderSubtle,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text variant="lead" weight="semibold">
          {r.name}
        </Text>
        <Text variant="small" tone="muted">
          {kinds(r.kind as KindKey)}
        </Text>
      </View>
      {r.audience ? <Text tone="secondary">{r.audience}</Text> : null}
      {r.hours || r.free ? (
        <View style={{ gap: 2 }}>
          {r.hours ? (
            <Text variant="small" tone="secondary">
              {`${t('hours')}: ${r.hours}`}
            </Text>
          ) : null}
          {r.free ? (
            <Text variant="small" tone="secondary">
              {t('free')}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {r.telHref ? (
          <Button variant="support" icon="phone" onPress={() => void openLink(r.telHref as string)}>
            {`${t('call')} ${ltr(r.phone ?? '')}`}
          </Button>
        ) : null}
        {r.smsHref ? (
          <Button
            variant="secondary"
            icon="text"
            onPress={() => void openLink(r.smsHref as string)}
          >
            {r.smsKeyword
              ? `${t('text')} ${r.smsKeyword}: ${ltr(r.sms ?? '')}`
              : `${t('text')} ${ltr(r.sms ?? '')}`}
          </Button>
        ) : null}
        {r.whatsappHref ? (
          <Button
            variant="secondary"
            icon="text"
            onPress={() => void openLink(r.whatsappHref as string)}
          >
            {`WhatsApp ${ltr(r.whatsapp ?? '')}`}
          </Button>
        ) : null}
        {r.url ? (
          <Button variant="quiet" icon="external" onPress={() => void openLink(r.url as string)}>
            {t('website')}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

export default function HelpScreen() {
  const t = useTranslations('support');
  const m = useTranslations('mobile.help');
  const byText = useTranslations('byText');
  const common = useTranslations('common');
  const theme = useTheme();
  const router = useRouter();
  const { locale } = useAppLocale();
  const { country, chosen } = useCountry();
  const dir = useMemo(() => supportDirectory(country, { language: locale }), [country, locale]);
  const name = countryName(dir.country, locale);
  const em = dir.emergency;
  const channels = useTextChannels();
  const [grounding, setGrounding] = useState(false);

  const numbers = em
    ? (
        [
          ['police', em.police],
          ['ambulance', em.ambulance],
          ['fire', em.fire],
        ] as const
      ).filter((entry): entry is readonly ['police' | 'ambulance' | 'fire', string] =>
        Boolean(entry[1]),
      )
    : [];

  return (
    <Screen title={t('title')} lead={t('lead')}>
      <View
        style={{
          gap: 12,
          padding: 20,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: `${theme.colors.support.slice(0, 7)}59`,
          borderStartWidth: 4,
          borderStartColor: theme.colors.support,
          backgroundColor: theme.colors.supportTint,
        }}
      >
        <Text variant="lead" weight="semibold" accessibilityRole="header">
          {t('dangerTitle')}
        </Text>
        {em?.general ? (
          <>
            <Text>{t('dangerBody', { number: ltr(em.general) })}</Text>
            <Button
              variant="support"
              size="lg"
              icon="phone"
              block
              onPress={() => void openLink(telHref(em.general as string))}
            >
              {t('callNumber', { number: ltr(em.general) })}
            </Button>
          </>
        ) : (
          <Text>{t('dangerNoNumber')}</Text>
        )}
        {numbers.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {numbers.map(([kind, number]) => (
              <Button
                key={kind}
                variant="secondary"
                size="sm"
                icon="phone"
                onPress={() => void openLink(telHref(number))}
                accessibilityLabel={`${t(kind)} ${number}`}
              >
                {`${t(kind)} ${ltr(number)}`}
              </Button>
            ))}
          </View>
        ) : null}
        {em?.notes ? (
          <Text variant="small" tone="secondary">
            {em.notes}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="place" size={18} color={theme.colors.textSecondary} />
          <Text weight="medium" style={{ flex: 1 }}>
            {name ? `${t('country')}: ${name}` : m('noCountry')}
          </Text>
        </View>
        {name && !chosen ? (
          <Text variant="small" tone="secondary">
            {m('fromPhone')}
          </Text>
        ) : null}
        <Button variant="secondary" icon="search" onPress={() => router.push('/country')}>
          {t('changeCountry')}
        </Button>
        {locale !== 'en' ? (
          <Text variant="small" tone="muted">
            {common('contentInEnglish')}
          </Text>
        ) : null}
      </View>

      <Panel title={name ? t('servicesTitleCountry', { country: name }) : t('servicesTitle')} flush>
        {dir.services.length ? (
          dir.services.map((r) => <Service key={r.id} r={r} />)
        ) : (
          <View
            style={{ padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle }}
          >
            <Text tone="secondary">{t('noServices')}</Text>
          </View>
        )}
      </Panel>

      <Panel title={t('directoriesTitle')} flush>
        {dir.directories.map((r) => (
          <Service key={r.id} r={r} />
        ))}
      </Panel>

      <Panel>
        <Button variant="quiet" icon="mind" onPress={() => setGrounding((g) => !g)}>
          {t('groundingTitle')}
        </Button>
        {grounding ? (
          <Text tone="secondary" accessibilityLiveRegion="polite">
            {t('groundingBody')}
          </Text>
        ) : null}
      </Panel>

      {channels && (channels.sms || channels.whatsapp || channels.ussd) ? (
        <Panel title={t('textTitle')} description={t('textBody')}>
          {channels.sms ? (
            <Button
              variant="secondary"
              icon="text"
              onPress={() => void openLink(channels.sms?.href ?? '')}
            >
              {`${byText('sms.title')} ${ltr(channels.sms.shown)}`}
            </Button>
          ) : null}
          {channels.whatsapp ? (
            <Button
              variant="secondary"
              icon="text"
              onPress={() => void openLink(channels.whatsapp?.href ?? '')}
            >
              {`${byText('whatsapp.title')} ${ltr(channels.whatsapp.shown)}`}
            </Button>
          ) : null}
          {channels.ussd ? (
            <Button
              variant="secondary"
              icon="phone"
              onPress={() => void openLink(channels.ussd?.href ?? '')}
            >
              {byText('ussd.action', { code: ltr(channels.ussd.shown) })}
            </Button>
          ) : null}
          <Text variant="small" tone="secondary">
            {byText('cost')}
          </Text>
        </Panel>
      ) : null}

      <View style={{ gap: 6 }}>
        <Text variant="small" tone="secondary">
          {t('notAlone')}
        </Text>
        <Text variant="small" tone="muted">
          {t('verified')}
        </Text>
      </View>
    </Screen>
  );
}
