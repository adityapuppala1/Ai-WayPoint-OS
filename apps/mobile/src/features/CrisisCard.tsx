/**
 * The calm harbour: support first, in the person's language, with real local numbers. Calm
 * blue, never alarm red. The same card as on the website, from the same plan (see
 * planCrisisResponse in @waypoint/core), so it also works with no connection.
 */
import type { TrustedContact } from '@waypoint/api/client';
import type { CrisisResponsePlan } from '@waypoint/core';
import { isolateNumbers, ltr } from '@waypoint/core/text';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { api } from '../api';
import { openLink, openWebsite, telHref } from '../links';
import { useTheme } from '../theme';
import { Button, Icon, type IconName, Text } from '../ui';

const ICON: Record<string, IconName> = {
  emergency: 'phone',
  call: 'phone',
  text: 'text',
  chat: 'ask',
  web: 'web',
  'trusted-contact': 'account',
  grounding: 'mind',
  circle: 'circles',
  stay: 'check',
};

export function CrisisCard({ plan, onStay }: { plan: CrisisResponsePlan; onStay?: () => void }) {
  const theme = useTheme();
  const t = useTranslations('support');
  const a11y = useTranslations('a11y');
  const [grounding, setGrounding] = useState(false);
  // The person's trusted contacts, to call or text themselves: nothing is ever sent for them.
  const [contacts, setContacts] = useState<TrustedContact[] | null>(null);
  const showContacts = () => {
    if (contacts) return setContacts(null);
    api<TrustedContact[]>('/me/trusted-contacts')
      .then(setContacts)
      .catch(() => void openWebsite('/settings/privacy#trusted'));
  };
  const primary = plan.actions.filter(
    (a) => a.href && (a.kind === 'emergency' || a.kind === 'call' || a.kind === 'text'),
  );
  const secondary = plan.actions.filter((a) => !primary.includes(a));

  return (
    <View
      accessibilityRole="summary"
      accessibilityLiveRegion="assertive"
      style={{
        gap: 16,
        padding: 20,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: `${theme.colors.support.slice(0, 7)}59`,
        borderStartWidth: 4,
        borderStartColor: theme.colors.support,
        backgroundColor: theme.colors.supportTint,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: theme.radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.support,
          }}
        >
          <Icon name="support" size={24} weight="fill" color={theme.colors.raised} />
        </View>
        <Text variant="h4" style={{ flex: 1 }}>
          {plan.headline}
        </Text>
      </View>
      <Text variant="lead">{plan.message}</Text>

      {primary.length ? (
        <View style={{ gap: 10 }}>
          {primary.map((a, i) => (
            <Button
              key={`${a.kind}-${a.href}`}
              variant={i === 0 ? 'support' : 'secondary'}
              size="lg"
              block
              icon={ICON[a.kind] ?? 'phone'}
              onPress={() => a.href && void openLink(a.href)}
            >
              {isolateNumbers(a.label)}
            </Button>
          ))}
        </View>
      ) : null}

      {secondary.length ? (
        <View style={{ gap: 4 }}>
          {secondary.map((a) => {
            const press =
              a.kind === 'grounding'
                ? () => setGrounding((g) => !g)
                : a.kind === 'stay'
                  ? onStay
                  : a.kind === 'trusted-contact'
                    ? showContacts
                    : a.kind === 'circle'
                      ? () => void openWebsite('/circles')
                      : a.href
                        ? () => void openLink(a.href as string)
                        : undefined;
            if (!press) return null;
            return (
              <Button
                key={`${a.kind}-${a.label}`}
                variant="quiet"
                icon={ICON[a.kind] ?? 'web'}
                onPress={press}
              >
                {isolateNumbers(a.label)}
              </Button>
            );
          })}
        </View>
      ) : null}

      {contacts?.length ? (
        <View style={{ gap: 10 }} accessibilityLiveRegion="polite">
          {contacts.map((c) => (
            <View
              key={c.id}
              style={{
                gap: 8,
                padding: 14,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.raised,
              }}
            >
              <Text weight="semibold">{c.relation ? `${c.name} (${c.relation})` : c.name}</Text>
              {c.phone ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button
                    variant="support"
                    icon="phone"
                    accessibilityLabel={a11y('call', { name: c.name })}
                    onPress={() => void openLink(telHref(c.phone as string))}
                  >
                    {ltr(c.phone)}
                  </Button>
                  <Button
                    icon="text"
                    accessibilityLabel={a11y('text', { name: c.name })}
                    onPress={() =>
                      void openLink(`sms:${(c.phone as string).replace(/[^\d+]/g, '')}`)
                    }
                  >
                    {t('text')}
                  </Button>
                </View>
              ) : c.email ? (
                <Button icon="email" onPress={() => void openLink(`mailto:${c.email}`)}>
                  {c.email}
                </Button>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {grounding ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            gap: 6,
            padding: 16,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.raised,
          }}
        >
          <Text weight="semibold">{t('groundingTitle')}</Text>
          <Text tone="secondary">{t('groundingBody')}</Text>
        </View>
      ) : null}

      <Text variant="small" tone="secondary">
        {t('notAlone')}
      </Text>
    </View>
  );
}
