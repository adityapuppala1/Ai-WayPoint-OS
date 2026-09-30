/**
 * Privacy: what Waypoint may do with your information, one purpose at a time (everything is
 * off until you turn it on), and deleting conversations or the whole account from the app.
 */
import type { Consents } from '@waypoint/api/client';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { api } from '../src/api';
import { confirm } from '../src/confirm';
import { OFFERED_CONSENTS } from '../src/place';
import { useRemote } from '../src/remote';
import { deleteAccount, fetchMe, type Me } from '../src/session';
import { useTheme } from '../src/theme';
import { Button, Field, Notice, Panel, SwitchRow, Text, useToast } from '../src/ui';

export default function PrivacyScreen() {
  const t = useTranslations('settings');
  const consentText = useTranslations('consents');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const me = useRemote<Me>('me', (signal) => fetchMe(signal));
  const [consents, setConsents] = useState<Consents | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (me.data) setConsents(me.data.consents);
  }, [me.data]);

  const toggle = async (purpose: keyof Consents, on: boolean) => {
    if (!consents) return;
    const before = consents;
    setConsents({ ...consents, [purpose]: on });
    try {
      const saved = await api<Consents>('/me/consents', { method: 'PUT', json: { [purpose]: on } });
      setConsents(saved);
      toast(t('consentSaved'));
    } catch {
      setConsents(before);
      toast(errors('generic'), 'danger');
    }
  };

  const deleteChats = async () => {
    const ok = await confirm({
      title: t('deleteChats'),
      message: t('deleteChatsConfirm'),
      confirmLabel: common('delete'),
      cancelLabel: common('cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api('/ask/conversations', { method: 'DELETE' });
      toast(common('done'));
    } catch {
      toast(errors('generic'), 'danger');
    }
  };

  const removeAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      toast(t('deleted'));
      router.dismissTo('/(tabs)/more');
    } catch {
      toast(errors('generic'), 'danger');
      setDeleting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 40,
        gap: 20,
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: t('privacyTitle') }} />
      <Text tone="secondary">{t('privacyLead')}</Text>

      {me.error && !me.data ? (
        <Notice
          tone="caution"
          title={me.error.offline ? errors('offlineTitle') : errors('generic')}
        />
      ) : null}

      {consents ? (
        <Panel title={t('consentsTitle')} flush>
          {OFFERED_CONSENTS.map((c, i) => (
            <SwitchRow
              key={c}
              first={i === 0}
              label={consentText(c)}
              description={consentText(`${c}Hint`)}
              value={consents[c]}
              onChange={(on) => void toggle(c, on)}
            />
          ))}
        </Panel>
      ) : null}

      <Panel title={t('deleteChats')}>
        <Text tone="secondary">{t('deleteChatsConfirm')}</Text>
        <Button icon="delete" onPress={() => void deleteChats()}>
          {t('deleteChats')}
        </Button>
      </Panel>

      <Panel title={t('deleteTitle')}>
        <Text tone="secondary">{t('deleteBody')}</Text>
        <Field
          label={t('deleteConfirmWord')}
          value={confirmWord}
          onChangeText={setConfirmWord}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <View>
          <Button
            variant="danger"
            icon="delete"
            busy={deleting}
            disabled={confirmWord.trim() !== 'DELETE'}
            onPress={() => void removeAccount()}
          >
            {t('deleteButton')}
          </Button>
        </View>
      </Panel>
    </ScrollView>
  );
}
