import {
  LinkButton,
  List,
  ListItem,
  type ModuleKey,
  ModuleMark,
  NextStops,
  PageHeader,
  Panel,
  ProgressRing,
  Sparkline,
  Stat,
  StatStrip,
} from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import styles from '../design.module.css';

export const metadata: Metadata = { title: 'An example module page' };

/** Each module's heading and lead, as its own page would give them. */
const MODULES: Record<ModuleKey, { title: string; lead: string }> = {
  today: { title: 'Today', lead: 'Your next step, and what changed for you.' },
  path: { title: 'Your path', lead: 'Roles that fit you, and a plan to get there.' },
  shield: { title: 'Scam Shield', lead: 'Check a message before you reply or pay.' },
  circles: { title: 'Circles', lead: 'Six to ten people going through the same change.' },
  ask: { title: 'Talk it through', lead: 'Ask anything about your situation, in your own words.' },
  signals: { title: 'Signals', lead: 'What is changing for your work, city and plan.' },
  money: { title: 'Money', lead: 'Budget, runway and money safety.' },
  mind: { title: 'Mind', lead: 'A ten-second check-in, and help on hard days.' },
  health: { title: 'Health', lead: 'Sleep, movement and reminders, week by week.' },
  civic: { title: 'Services', lead: 'Benefits, paperwork and who to call, step by step.' },
  surroundings: { title: 'Surroundings', lead: 'Weather and air where you are.' },
  goals: { title: 'Goals', lead: 'A few things that matter, reviewed once a week.' },
  org: { title: 'Your organisation', lead: 'Programmes and totals, never individuals.' },
  support: { title: 'Get help', lead: 'People to talk to, right now, in your country.' },
};

const isModule = (key: string | undefined): key is ModuleKey =>
  key !== undefined && Object.hasOwn(MODULES, key);

/** Savings at the end of each of the last six weeks. */
const SAVINGS = [400, 520, 610, 800, 1020, 1250];

/**
 * A module page put together from the design system's page parts: the header band, two
 * columns on a wide screen, a strip of figures and "Also on Waypoint" at its foot. Add
 * `?module=path` (or any other module) to see the band in that module's tint.
 */
export default async function ExampleModulePage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const asked = (await searchParams).module;
  const key: ModuleKey = isModule(asked) ? asked : 'money';
  const { title, lead } = MODULES[key];
  return (
    <main id="main" className={styles.example}>
      <div className="wp-page wp-page-wide">
        <PageHeader
          module={key}
          title={title}
          lead={lead}
          actions={
            <LinkButton href="/design#pages" variant="secondary">
              How this page is built
            </LinkButton>
          }
        />
        <div className="wp-split">
          <div className="wp-split-main" data-testid="split-main">
            <Panel title="Where things stand">
              <StatStrip label="Where things stand">
                <Stat value="1,250" label="Saved so far" note="Since March" />
                <Stat value="5 weeks" label="Savings runway" />
                <Stat value="3 of 5" label="Steps done this week" />
              </StatStrip>
            </Panel>
            <Panel
              title="Savings"
              description="A small line beside the number that says where it stands."
              mark={<ModuleMark module="money" />}
            >
              <div className={styles.figure}>
                <Stat value="1,250" label="Saved so far" />
                <Sparkline
                  values={SAVINGS}
                  module="money"
                  width={160}
                  height={40}
                  label="Savings over 6 weeks: from 400 to 1,250"
                />
                <ProgressRing
                  value={3}
                  total={5}
                  module="path"
                  label="Steps done this week"
                  valueText="3/5"
                />
              </div>
            </Panel>
            <Panel
              title="The same page, as another module"
              description="Only the band and the mark change."
              flush
            >
              <List>
                {(Object.keys(MODULES) as ModuleKey[]).map((m) => (
                  <ListItem
                    key={m}
                    leading={<ModuleMark module={m} size="sm" />}
                    title={MODULES[m].title}
                    render={({ className, children }) => (
                      <Link
                        href={`/design/module?module=${m}` as Route}
                        className={className}
                        aria-current={m === key ? 'page' : undefined}
                      >
                        {children}
                      </Link>
                    )}
                  />
                ))}
              </List>
            </Panel>
          </div>
          <div className="wp-split-aside" data-testid="split-aside">
            <Panel title="Beside the main column">
              <p className="wp-secondary">
                From 72rem this column sits beside the main one, 20rem wide, on the right (on the
                left in right-to-left languages). On a smaller screen it follows the main column.
              </p>
            </Panel>
            <NextStops
              title="Also on Waypoint"
              stops={[
                {
                  module: 'money',
                  title: 'Figures',
                  description: 'A line, a ring and a number that counts.',
                  href: '/design#figures',
                },
                {
                  module: 'ask',
                  title: 'Go to',
                  description: 'A palette for getting anywhere.',
                  href: '/design#palette',
                },
                {
                  module: 'path',
                  title: 'The sign and the route',
                  href: '/design#sign',
                },
                // Two more than a page has room for: only three are ever shown.
                { module: 'goals', title: 'Forms', href: '/design#forms' },
                { module: 'signals', title: 'Lists and panels', href: '/design#lists' },
              ]}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
