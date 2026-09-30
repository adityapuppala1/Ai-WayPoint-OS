import { List, type ModuleKey, ModuleMark, Panel } from '@waypoint/ui';
import { getTranslations } from 'next-intl/server';
import { LinkRow } from '@/components/LinkRow';

/** The places a page may point on to. Each is worded the way Today words that module. */
export type NextStop =
  | 'support'
  | 'ask'
  | 'civic'
  | 'path'
  | 'circles'
  | 'signals'
  | 'money'
  | 'mind'
  | 'shield'
  | 'health'
  | 'goals';

/** Never a feed: a page points to a few places that fit where the person is, and stops. */
const MOST = 3;

/**
 * "Also on Waypoint": up to three links from the foot of one module to others that fit what
 * the person is doing there, so the modules read as one companion. A plain titled list of
 * rows. The page chooses the stops from what it knows; nothing here is ranked or guessed.
 *
 * Local for now: the design system is getting a version of this, and the props are kept
 * small (a list of stops) so that swap is a one-line change per page.
 */
export async function NextStops({ stops }: { stops: NextStop[] }) {
  const shown = [...new Set(stops)].slice(0, MOST);
  if (!shown.length) return null;
  const [explore, today, nav, modules, path] = await Promise.all([
    getTranslations('explore'),
    getTranslations('today'),
    getTranslations('nav'),
    getTranslations('modules'),
    getTranslations('path'),
  ]);
  const words: Record<
    NextStop,
    { module: ModuleKey; href: string; title: string; description: string }
  > = {
    support: {
      module: 'support',
      href: '/support',
      title: today('toolHelp'),
      description: today('toolHelpHint'),
    },
    ask: {
      module: 'ask',
      href: '/ask',
      title: today('toolAsk'),
      description: today('toolAskHint'),
    },
    civic: { module: 'civic', href: '/civic', title: nav('civic'), description: modules('civic') },
    path: {
      module: 'path',
      href: '/path',
      title: path('makePlan'),
      description: path('noPlanBody'),
    },
    circles: {
      module: 'circles',
      href: '/circles',
      title: today('toolCircles'),
      description: today('toolCirclesHint'),
    },
    signals: {
      module: 'signals',
      href: '/signals',
      title: nav('signals'),
      description: modules('signals'),
    },
    money: {
      module: 'money',
      href: '/money',
      title: today('toolMoney'),
      description: today('toolMoneyHint'),
    },
    mind: {
      module: 'mind',
      href: '/mind',
      title: today('toolMind'),
      description: today('toolMindHint'),
    },
    shield: {
      module: 'shield',
      href: '/shield',
      title: today('toolShield'),
      description: today('toolShieldHint'),
    },
    health: {
      module: 'health',
      href: '/health',
      title: nav('health'),
      description: modules('health'),
    },
    goals: { module: 'goals', href: '/goals', title: nav('goals'), description: modules('goals') },
  };
  return (
    <Panel title={explore('moreTitle')} as="section" flush>
      <List>
        {shown.map((stop) => {
          const w = words[stop];
          return (
            <LinkRow
              key={stop}
              href={w.href}
              leading={<ModuleMark module={w.module} size="sm" />}
              title={w.title}
              description={w.description}
            />
          );
        })}
      </List>
    </Panel>
  );
}
