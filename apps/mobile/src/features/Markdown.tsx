/**
 * The little Markdown the assistant writes — paragraphs, lists, headings, bold, italics, code
 * and links — as native text. Anything else stays plain text: no images, no HTML, and links
 * only to the web, phone numbers, text messages, email and Waypoint's own pages.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { openLink } from '../links';
import { useTheme } from '../theme';
import { Text } from '../ui';
import { INLINE, parseBlocks, safeHref } from './markdown-parse';

function Inline({ text }: { text: string }) {
  const theme = useTheme();
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (token.startsWith('**') || token.startsWith('__')) {
      out.push(
        <Text key={at} weight="semibold">
          {token.slice(2, -2)}
        </Text>,
      );
    } else if (token.startsWith('`')) {
      out.push(
        <Text key={at} style={{ backgroundColor: theme.colors.sunken }}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else if (token.startsWith('[')) {
      const [, label = '', href = ''] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token) ?? [];
      const safe = safeHref(href);
      out.push(
        safe ? (
          <Text
            key={at}
            accessibilityRole="link"
            onPress={() => void openLink(safe)}
            style={{ textDecorationLine: 'underline' }}
            weight="medium"
          >
            {label}
          </Text>
        ) : (
          label
        ),
      );
    } else {
      out.push(
        <Text key={at} style={{ fontStyle: 'italic' }}>
          {token.slice(1, -1)}
        </Text>,
      );
    }
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function Markdown({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {parseBlocks(text).map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <Text key={i} variant="lead" weight="semibold" accessibilityRole="header">
                <Inline text={b.text} />
              </Text>
            );
          case 'quote':
            return (
              <View
                key={i}
                style={{
                  borderStartWidth: 3,
                  borderStartColor: theme.colors.borderStrong,
                  paddingStart: 12,
                }}
              >
                <Text tone="secondary">
                  <Inline text={b.text} />
                </Text>
              </View>
            );
          case 'list':
            return (
              <View key={i} style={{ gap: 6 }} accessibilityRole="list">
                {b.items.map((item, k) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text tabular style={{ minWidth: 18 }}>
                      {b.ordered ? `${k + 1}.` : '•'}
                    </Text>
                    <Text style={{ flex: 1 }}>
                      <Inline text={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          default:
            return (
              <Text key={i}>
                <Inline text={b.text} />
              </Text>
            );
        }
      })}
    </View>
  );
}
