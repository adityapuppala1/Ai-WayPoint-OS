/** Earlier conversations in Ask: open one to carry on, or delete it for good. */
import type { ConversationSummary } from '@waypoint/api/client';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFormatter, useTranslations } from 'use-intl';
import { confirm } from '../src/confirm';
import { deleteConversation, listConversations } from '../src/features/ask';
import { useRemote } from '../src/remote';
import { useTheme } from '../src/theme';
import { IconButton, Notice, Panel, Row, Text, useToast } from '../src/ui';

export default function ConversationsScreen() {
  const t = useTranslations('ask');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const list = useRemote<ConversationSummary[]>('conversations', (signal) =>
    listConversations(signal),
  );
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const items = (list.data ?? []).filter((c) => !removed.has(c.id));

  const remove = async (id: string) => {
    const ok = await confirm({
      title: t('deleteChat'),
      message: t('deleteConfirm'),
      confirmLabel: common('delete'),
      cancelLabel: common('cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteConversation(id);
      setRemoved((s) => new Set(s).add(id));
    } catch {
      toast(errors('generic'), 'danger');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        padding: 16,
        gap: 16,
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <Stack.Screen options={{ title: t('history') }} />
      {list.error && !list.data ? (
        <Notice
          tone="caution"
          title={list.error.offline ? errors('offlineTitle') : errors('generic')}
        />
      ) : null}
      {list.data && !items.length ? <Text tone="secondary">{t('historyEmpty')}</Text> : null}
      {items.length ? (
        <Panel flush>
          {items.map((c, i) => (
            <Row
              key={c.id}
              first={i === 0}
              title={c.title ?? t('title')}
              description={format.dateTime(new Date(c.updatedAt), {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
              onPress={() => router.navigate({ pathname: '/(tabs)/ask', params: { c: c.id } })}
              trailing={
                <View>
                  <IconButton
                    icon="delete"
                    label={`${t('deleteChat')}: ${c.title ?? ''}`}
                    onPress={() => void remove(c.id)}
                  />
                </View>
              }
            />
          ))}
        </Panel>
      ) : null}
    </ScrollView>
  );
}
