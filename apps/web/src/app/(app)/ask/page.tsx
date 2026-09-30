import type { AskUIMessage } from '@waypoint/ai';
import { ask } from '@waypoint/api';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AskChat } from '@/components/ask/AskChat';
import { uuid } from '@/lib/api';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ask');
  return { title: t('title') };
}

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string }>;
}) {
  const viewer = await requireViewer('/ask');
  const { c, q } = await searchParams;
  const conversations = await ask.listConversations(viewer.db, viewer.user.id);
  const valid = Boolean(
    c && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c),
  );
  // A new conversation gets its id here; the client puts it in the URL on the first message.
  const chatId = valid && c ? c.toLowerCase() : uuid();
  let initial: AskUIMessage[] = [];
  if (valid) {
    const convo = await ask.getConversation(viewer.db, viewer.user.id, chatId).catch(() => null);
    if (convo) initial = convo.messages as unknown as AskUIMessage[];
  }
  return (
    <AskChat
      key={chatId}
      chatId={chatId}
      initialMessages={initial}
      conversations={conversations}
      prompt={typeof q === 'string' ? q.slice(0, 500) : undefined}
    />
  );
}
