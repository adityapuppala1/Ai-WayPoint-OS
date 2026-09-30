'use client';

import {
  AnimatedNumber,
  Avatar,
  Button,
  Checkbox,
  CommandPalette,
  type CommandSection,
  ConfirmDialog,
  Dialog,
  Disclosure,
  EmptyState,
  Icon,
  IconButton,
  LinkButton,
  List,
  ListItem,
  Menu,
  MenuItem,
  MenuSeparator,
  type ModuleKey,
  ModuleMark,
  Notice,
  NumberField,
  PageSkeleton,
  Panel,
  Probability,
  ProgressRing,
  Radio,
  RadioGroup,
  type RiskLevel,
  RiskMeter,
  Route,
  SearchField,
  Segmented,
  SelectField,
  Sign,
  Skeleton,
  SliderField,
  Sparkline,
  Spinner,
  Stat,
  type Station,
  StatStrip,
  Stepper,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  Tooltip,
  toast,
  useCommandShortcut,
} from '@waypoint/ui';
import { useEffect, useState } from 'react';
import styles from './design.module.css';

const STEPS = [
  { title: 'Finish the SQL practice set', detail: '25 min' },
  { title: 'Share your project with your circle', detail: '10 min' },
  { title: 'Apply to two supply-chain analyst roles', detail: '40 min' },
];

const MODULES: ModuleKey[] = [
  'today',
  'path',
  'shield',
  'circles',
  'ask',
  'signals',
  'money',
  'mind',
  'health',
  'civic',
  'surroundings',
  'goals',
  'org',
  'support',
];

const RISK: Array<{ id: RiskLevel; label: string; verdict: string }> = [
  { id: 'low', label: 'Looks safe', verdict: 'Looks safe' },
  { id: 'unclear', label: 'Unclear', verdict: 'We cannot tell' },
  { id: 'high', label: 'Likely scam', verdict: 'Likely a scam' },
  { id: 'very-high', label: 'Very likely', verdict: 'Very likely a scam' },
];

/** Each module's name and one line about it, as the go-to palette lists them. */
const MODULE_LINES: Array<{ id: ModuleKey; label: string; description: string }> = [
  { id: 'today', label: 'Today', description: 'Your next step, and what changed for you.' },
  { id: 'path', label: 'Your path', description: 'Roles that fit you, and a plan to get there.' },
  { id: 'shield', label: 'Scam Shield', description: 'Check a message before you reply or pay.' },
  { id: 'ask', label: 'Talk it through', description: 'Ask anything, in your own words.' },
  { id: 'signals', label: 'Signals', description: 'What is changing for your work and city.' },
  { id: 'circles', label: 'Circles', description: 'People going through the same change.' },
  { id: 'money', label: 'Money', description: 'Budget, runway and money safety.' },
  { id: 'mind', label: 'Mind', description: 'A ten-second check-in, and help on hard days.' },
  { id: 'health', label: 'Health', description: 'Sleep, movement and reminders.' },
  { id: 'civic', label: 'Services', description: 'Benefits, paperwork and who to call.' },
  { id: 'surroundings', label: 'Surroundings', description: 'Weather and air where you are.' },
  { id: 'goals', label: 'Goals', description: 'A few things that matter, reviewed weekly.' },
];

/** The sections of this page, for the palette's first group. */
const ON_THIS_PAGE: Array<{ id: string; label: string }> = [
  { id: 'sign', label: 'The sign and the route' },
  { id: 'actions', label: 'Actions' },
  { id: 'palette', label: 'Go to' },
  { id: 'forms', label: 'Forms' },
  { id: 'feedback', label: 'Status and honesty' },
  { id: 'figures', label: 'Figures' },
  { id: 'lists', label: 'Lists and panels' },
  { id: 'loading', label: 'Loading' },
];

/** Savings at the end of each of the last six weeks. */
const SAVINGS = [400, 520, 610, 800, 1020, 1250];

// The app passes its own formatter (next-intl). Here: English, and Arabic with its own digits.
const english = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const arabic = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });
const inEnglish = (n: number) => english.format(n);
const inArabic = (n: number) => arabic.format(n);

type Theme = 'light' | 'dark' | 'system';

export function DesignShowcase() {
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [theme, setTheme] = useState<Theme>('system');
  const [lite, setLite] = useState(false);
  const [size, setSize] = useState('medium');
  const [risk, setRisk] = useState<RiskLevel>('very-high');
  const [chance, setChance] = useState(0.68);
  const [hours, setHours] = useState(Number.NaN);
  const [skeleton, setSkeleton] = useState(true);
  const [palette, setPalette] = useState(false);
  const [savings, setSavings] = useState(SAVINGS);
  const [stepsDone, setStepsDone] = useState(3);
  // Ctrl+K (Cmd+K on a Mac) anywhere on the page, except while typing in a field.
  const shortcut = useCommandShortcut(() => setPalette(true));
  const saved = savings[savings.length - 1] ?? 0;

  // Start from what the page was rendered with (the person's own theme and lite mode).
  useEffect(() => {
    const root = document.documentElement;
    const current = root.getAttribute('data-theme');
    setTheme(current === 'light' || current === 'dark' ? current : 'system');
    setLite(root.getAttribute('data-lite') === 'true');
    setReady(true);
  }, []);

  // The two switches change this page only. They are not saved: Settings does that.
  const showTheme = (next: Theme) => {
    setTheme(next);
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);
  };
  const showLite = (next: boolean) => {
    setLite(next);
    if (next) document.documentElement.setAttribute('data-lite', 'true');
    else document.documentElement.removeAttribute('data-lite');
  };

  // What the palette offers: places on this page, the other page, every module, two actions.
  // Every label is the caller's own text; the last group shows that matching works in scripts
  // that have no lower case.
  const commands: CommandSection[] = [
    {
      id: 'here',
      title: 'On this page',
      items: ON_THIS_PAGE.map((s) => ({
        id: `here-${s.id}`,
        label: s.label,
        href: `#${s.id}`,
        mark: <Icon name="forward" size={18} />,
      })),
    },
    {
      id: 'pages',
      title: 'Pages',
      items: [
        {
          id: 'example',
          label: 'An example module page',
          description: 'A header band, two columns and next stops.',
          href: '/design/module',
          mark: <Icon name="external" size={18} />,
        },
      ],
    },
    {
      id: 'modules',
      title: 'Modules',
      items: MODULE_LINES.map((m) => ({
        id: `module-${m.id}`,
        label: m.label,
        description: m.description,
        href: `/design/module?module=${m.id}`,
        mark: <ModuleMark module={m.id} size="sm" />,
      })),
    },
    {
      id: 'do',
      title: 'Actions',
      items: [
        {
          id: 'do-toast',
          label: 'Show a toast',
          keywords: ['message', 'confirm'],
          onAction: () => toast({ title: 'Opened from the palette', tone: 'info' }),
          mark: <Icon name="info" size={18} />,
        },
        {
          id: 'do-dark',
          label: theme === 'dark' ? 'Switch to light' : 'Switch to dark',
          keywords: ['theme', 'appearance'],
          onAction: () => showTheme(theme === 'dark' ? 'light' : 'dark'),
          mark: <Icon name={theme === 'dark' ? 'light' : 'dark'} size={18} />,
        },
      ],
    },
    {
      id: 'scripts',
      title: 'In other scripts',
      items: [
        {
          id: 'script-ar',
          label: 'المال',
          description: 'الميزانية والمدخرات',
          href: '/design/module?module=money',
          mark: <ModuleMark module="money" size="sm" />,
        },
        {
          id: 'script-hi',
          label: 'पैसा',
          description: 'बजट और बचत',
          href: '/design/module?module=money',
          mark: <ModuleMark module="money" size="sm" />,
        },
      ],
    },
  ];

  const done = Math.min(step, STEPS.length);
  const current = STEPS[done] ?? null;
  const stations: Station[] = STEPS.map((s, i) => ({
    id: s.title,
    label: s.title,
    detail: s.detail,
    state: i < done ? 'done' : i === done ? 'current' : 'upcoming',
    href: '#route',
  }));

  const markDone = () => {
    setStep((s) => s + 1);
    toast({
      title: 'Marked as done',
      tone: 'safe',
      // The same step can be taken back for ten seconds: the toast stays that long.
      action: { label: 'Undo', onAction: () => setStep((s) => Math.max(0, s - 1)) },
    });
  };

  return (
    <>
      <section className={styles.section} aria-labelledby="look">
        <h2 id="look">Look at it your way</h2>
        <p className="wp-secondary wp-measure">
          Everything below can be seen in light and dark, and with lite mode on (system fonts, no
          motion). These two switches change this page only.
        </p>
        <div className="wp-cluster">
          <Segmented
            label="Appearance"
            value={theme}
            onChange={(id) => showTheme(id as Theme)}
            options={[
              { id: 'light', label: 'Light', icon: 'light' },
              { id: 'dark', label: 'Dark', icon: 'dark' },
              { id: 'system', label: 'Device', icon: 'system' },
            ]}
          />
          <Switch isSelected={lite} onChange={showLite}>
            Lite mode
          </Switch>
          {ready ? <span data-testid="showcase-ready" hidden /> : null}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sign">
        <h2 id="sign">The sign and the route</h2>
        <p className="wp-secondary wp-measure">
          The one bold element, and the one orchestrated moment: mark the step as done and the route
          fills to the next station, the dot settles there and the sign flips to the new step, like
          a departures board. A toast confirms it and offers to take it back.
        </p>
        <div data-testid="demo-sign">
          {current ? (
            <Sign
              eyebrow="Your next step"
              module="path"
              context={`Step ${done + 1} of ${STEPS.length}`}
              flipKey={done}
              title={current.title}
              details={[
                { label: 'Time', value: current.detail },
                { label: 'From', value: 'Data analyst plan' },
              ]}
              actions={
                <>
                  <Button variant="primary" icon="check" onPress={markDone}>
                    Mark as done
                  </Button>
                  <Button variant="onSign">Not today</Button>
                </>
              }
            />
          ) : (
            <Sign
              eyebrow="This week"
              module="path"
              flipKey={done}
              title="All three steps are done"
              actions={
                <Button variant="onSign" icon="retry" onPress={() => setStep(0)}>
                  Start the week again
                </Button>
              }
            />
          )}
        </div>
        <Panel title="This week" mark={<ModuleMark module="path" />}>
          <Route label="Steps this week" module="path" stations={stations} />
        </Panel>
      </section>

      <section className={styles.section} aria-labelledby="route">
        <h2 id="route">Route</h2>
        <div className={styles.swatchGroups}>
          <Panel title="Your 12-week plan" mark={<ModuleMark module="path" />}>
            <Route
              label="Plan progress"
              module="path"
              stations={[
                { id: '1', label: 'Map your skills', detail: 'Done 3 Sep', state: 'done' },
                { id: '2', label: 'Learn SQL basics', detail: 'Done 12 Sep', state: 'done' },
                {
                  id: '3',
                  label: 'Build a supply-chain dashboard',
                  detail: 'This week',
                  state: 'current',
                },
                { id: '4', label: 'Get it reviewed by a mentor', state: 'upcoming' },
                { id: '5', label: 'Apply with your verified project', state: 'upcoming' },
              ]}
            />
          </Panel>
          <Panel title="Onboarding">
            <Route
              label="Setup progress"
              orientation="horizontal"
              module="today"
              stations={[
                { id: 'a', label: 'Language', state: 'done' },
                { id: 'b', label: 'Situation', state: 'done' },
                { id: 'c', label: 'Consent', state: 'current' },
                { id: 'd', label: 'Attention', state: 'upcoming' },
              ]}
            />
          </Panel>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="marks">
        <h2 id="marks">Module marks</h2>
        {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none */}
        <ul role="list" className={styles.lines}>
          {MODULES.map((m) => (
            <li key={m} className={styles.line} style={{ gridTemplateColumns: 'auto 1fr' }}>
              <ModuleMark module={m} />
              <span>{m}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="actions">
        <h2 id="actions">Actions</h2>
        <p className="wp-secondary wp-measure">
          Every control answers a press at once: it gives a little and takes a shade. Hover fills
          appear only where there is a pointer that hovers, so nothing stays lit after a tap on a
          phone. Press Tab to see the focus ring.
        </p>
        <div className="wp-cluster">
          <Button variant="primary">Start my plan</Button>
          <Button variant="secondary" icon="add">
            Add a goal
          </Button>
          <Button variant="quiet">Skip for now</Button>
          <Button variant="danger" onPress={() => setConfirm(true)}>
            Delete my account
          </Button>
          <Button variant="support" icon="phone">
            Call 14416
          </Button>
          <Button variant="primary" isBusy>
            Checking
          </Button>
          <Button variant="secondary" isDisabled>
            Not available
          </Button>
          <LinkButton href="#route" variant="secondary">
            See the route
          </LinkButton>
        </div>
        <div className="wp-cluster">
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary">Medium</Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
          <IconButton icon="settings" label="Settings" />
          <IconButton icon="share" label="Share" tone="outlined" />
          <Menu
            label="More actions"
            trigger={<IconButton icon="more" label="More actions" tone="outlined" />}
          >
            <MenuItem icon="edit">Rename</MenuItem>
            <MenuItem icon="copy">Copy the link</MenuItem>
            <MenuSeparator />
            <MenuItem icon="delete" tone="danger">
              Delete
            </MenuItem>
          </Menu>
          <Tooltip content="Shown on hover and on keyboard focus" placement="top">
            <Button variant="secondary">With a tooltip</Button>
          </Tooltip>
        </div>
        <div className="wp-cluster">
          <Segmented
            label="Text size"
            value={size}
            onChange={setSize}
            options={[
              { id: 'small', label: 'Small' },
              { id: 'medium', label: 'Medium' },
              { id: 'large', label: 'Large' },
            ]}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="palette">
        <h2 id="palette">Go to</h2>
        <p className="wp-secondary wp-measure">
          One dialog for getting anywhere: type a few letters, choose with the arrow keys and Enter.
          It matches in the reader's own language, so accents and case never matter and Arabic and
          Hindi work as well as English. On a phone it is a sheet that rests on the keyboard. It
          opens from a button that anyone can see, and from the keyboard.
        </p>
        <div className="wp-cluster">
          <Button variant="secondary" icon="search" onPress={() => setPalette(true)}>
            Go to a section
          </Button>
          {shortcut ? <kbd data-testid="palette-shortcut">{shortcut}</kbd> : null}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="overlays">
        <h2 id="overlays">Dialogs, sheets and toasts</h2>
        <p className="wp-secondary wp-measure">
          They leave the way they came. A toast with an action stays ten seconds, long enough to
          reach it; pausing the pointer over it or moving focus into it holds it.
        </p>
        <div className="wp-cluster">
          <Button variant="secondary" onPress={() => setSheet(true)}>
            Open a sheet
          </Button>
          <Button variant="secondary" onPress={() => setDialog(true)}>
            Open a dialog
          </Button>
          <Button variant="secondary" onPress={() => toast({ title: 'Saved', tone: 'safe' })}>
            Show a toast
          </Button>
          <Button
            variant="secondary"
            onPress={() =>
              toast({
                title: 'You are offline',
                description: 'Your check-in is kept on this phone and sent when you are back.',
                tone: 'caution',
              })
            }
          >
            Toast with detail
          </Button>
          <Button
            variant="secondary"
            onPress={() =>
              toast({
                title: 'Goal deleted',
                tone: 'info',
                action: { label: 'Undo', onAction: () => toast({ title: 'Goal restored' }) },
              })
            }
          >
            Toast with Undo
          </Button>
          <Button
            variant="secondary"
            onPress={() => toast({ title: 'That did not save. Try again.', tone: 'danger' })}
          >
            Toast for a problem
          </Button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="forms">
        <h2 id="forms">Forms</h2>
        <div className={styles.swatchGroups}>
          <div className="wp-stack">
            <TextField label="Your name" description="Shown only to your circle." isRequired />
            <TextField
              label="Email"
              type="email"
              errorMessage="Enter an email like name@example.com"
              isInvalid
              defaultValue="priya@"
            />
            <TextField label="What's on your mind?" multiline optionalLabel="optional" />
            <SelectField
              label="Country"
              placeholder="Choose your country"
              options={[
                { id: 'IN', label: 'India' },
                { id: 'KE', label: 'Kenya' },
                { id: 'BR', label: 'Brazil' },
              ]}
            />
            <SearchField label="Search your plan" placeholder="Search your plan" />
            <NumberField label="Monthly rent" defaultValue={12000} minValue={0} />
          </div>
          <div className="wp-stack">
            <RadioGroup label="What's happening in your life?" defaultValue="lost-job">
              <Radio value="first-job">Looking for my first job</Radio>
              <Radio
                value="lost-job"
                description="We'll start with money, benefits and a 90-day plan."
              >
                I recently lost my job
              </Radio>
              <Radio value="changing">Changing career</Radio>
            </RadioGroup>
            <Checkbox description="Only redacted text is sent, never your name or contact details.">
              Use an external AI model for better answers
            </Checkbox>
            <Switch description="At most one bundled message a day.">Daily brief</Switch>
            <Stepper
              label="Sleep last night"
              unit="hours"
              unitLabel="hours"
              value={hours}
              onChange={setHours}
              startValue={7}
              minValue={0}
              maxValue={24}
              step={0.5}
            />
            <SliderField label="How was today?" defaultValue={6} minValue={0} maxValue={10} />
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="feedback">
        <h2 id="feedback">Status and honesty</h2>
        <div className={styles.swatchGroups}>
          <Panel title="Scam Shield verdict" description="The meter grows to its verdict.">
            <div className="wp-stack">
              <RiskMeter
                key={risk}
                level={risk}
                verdict={RISK.find((r) => r.id === risk)?.verdict ?? ''}
                scale={['Looks safe', 'Unclear', 'Likely scam', 'Very likely']}
              />
              <SelectField
                label="Show a verdict"
                selectedKey={risk}
                onSelectionChange={(key) => setRisk(key as RiskLevel)}
                options={RISK.map((r) => ({ id: r.id, label: r.label }))}
              />
            </div>
          </Panel>
          <Panel
            title="Supply-chain analyst demand rises in Pune by March"
            description="The bar grows to its value, and moves when the forecast is updated."
          >
            <div className="wp-stack">
              <Probability
                value={chance}
                words={chance >= 0.6 ? 'Likely' : 'About as likely as not'}
                baseRate={0.4}
                baseRateLabel="Usual for new roles:"
                record="Our record: 42 forecasts, Brier 0.18"
                label="Chance this happens"
              />
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setChance((c) => (c > 0.6 ? 0.52 : 0.68))}
                >
                  Update the forecast
                </Button>
              </div>
            </div>
          </Panel>
        </div>
        <div className={styles.stats}>
          <Stat value="42" label="Forecasts resolved" note="Since January" />
          <Stat value="0.18" label="Brier score" note="Lower is better" />
          <Stat value="5 weeks" label="Savings runway" />
          <div className="wp-cluster">
            <Avatar name="Priya Nair" />
            <Avatar name="Omar" size={48} />
            <Spinner label="Checking the message" />
          </div>
        </div>
        <div className="wp-stack">
          <Notice tone="danger" title="Don't pay the registration fee">
            Real employers never ask you to pay to get a job. Stop replying and report the number.
          </Notice>
          <Notice
            tone="support"
            title="You don't have to carry this alone"
            actions={
              <Button variant="support" icon="phone">
                Call Tele-MANAS 14416
              </Button>
            }
          >
            Talking to a trained person can help, right now.
          </Notice>
          <Notice tone="caution" title="Your savings cover about 5 weeks">
            Let's make a plan before that gets tighter.
          </Notice>
          <Notice tone="safe" title="Your project was verified">
            Employers can check it with the link on your work passport.
          </Notice>
          <Notice tone="info" title="Forecasts are updated every Monday">
            We publish every one, and what happened.
          </Notice>
          <Notice tone="neutral" title="This plan is a draft">
            Only you can see it until you share it.
          </Notice>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="figures">
        <h2 id="figures">Figures</h2>
        <p className="wp-secondary wp-measure">
          Small drawings beside a number, never instead of it, and each one says in words what it
          shows. No chart library: a few lines of SVG in the colour of the text or of a module line.
          A line of values runs from left to right in every language; a ring runs clockwise from the
          top. A number counts to its new value when it changes, in the digits of the reader's
          language.
        </p>
        <div className={styles.swatchGroups}>
          <Panel
            title="Savings"
            description="A line of values with the last one marked."
            mark={<ModuleMark module="money" />}
          >
            <div className="wp-stack">
              <div className={styles.figure}>
                <Stat
                  value={
                    <span data-testid="demo-number">
                      <AnimatedNumber value={saved} format={inEnglish} />
                    </span>
                  }
                  label="Saved so far"
                />
                <Stat
                  value={
                    <span data-testid="demo-number-arabic" lang="ar">
                      <AnimatedNumber value={saved} format={inArabic} />
                    </span>
                  }
                  label="The same, in Arabic digits"
                />
                <Sparkline
                  values={savings}
                  module="money"
                  width={160}
                  height={40}
                  label={`Savings over ${savings.length} weeks: from ${inEnglish(
                    savings[0] ?? 0,
                  )} to ${inEnglish(saved)}`}
                />
              </div>
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setSavings((s) => [...s.slice(1), (s[s.length - 1] ?? 0) + 250])}
                >
                  Add this week's saving
                </Button>
              </div>
            </div>
          </Panel>
          <Panel
            title="Steps this week"
            description="A value out of a total, with the number in the middle."
            mark={<ModuleMark module="path" />}
          >
            <div className="wp-stack">
              <div className="wp-cluster">
                <ProgressRing
                  value={stepsDone}
                  total={5}
                  module="path"
                  label="Steps done this week"
                  valueText={`${stepsDone} of 5`}
                  size="lg"
                />
                <ProgressRing
                  value={stepsDone}
                  total={5}
                  module="path"
                  label="Steps done this week, as a share"
                />
                <ProgressRing
                  value={stepsDone}
                  total={5}
                  label="Steps done this week, small"
                  valueText={`${stepsDone}/5`}
                  size="sm"
                />
              </div>
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setStepsDone((n) => (n >= 5 ? 0 : n + 1))}
                >
                  Complete a step
                </Button>
              </div>
            </div>
          </Panel>
        </div>
        <StatStrip label="Our forecasting record">
          <Stat value="42" label="Forecasts resolved" note="Since January" />
          <Stat value="0.18" label="Brier score" note="Lower is better" />
          <Stat value="31" label="Came true" />
          <Stat
            value={
              <span className={styles.figure}>
                74%
                <Sparkline
                  values={[61, 66, 64, 70, 72, 74]}
                  series={1}
                  label="Share that came true, last six months: from 61% to 74%"
                />
              </span>
            }
            label="Share that came true"
          />
        </StatStrip>
      </section>

      <section className={styles.section} aria-labelledby="lists">
        <h2 id="lists">Lists and panels</h2>
        <Panel title="Signals for you" description="Based on your city, role and plan." flush>
          <List>
            <ListItem
              leading={<ModuleMark module="signals" size="sm" />}
              title="Entry-level analyst postings fell this quarter"
              description="Pune, data roles"
              meta="3 days ago"
              href="#lists"
            />
            <ListItem
              leading={<ModuleMark module="shield" size="sm" />}
              title="Fake courier fee messages are rising"
              description="India"
              meta="Today"
              href="#lists"
            />
            <ListItem
              leading={<ModuleMark module="circles" size="sm" />}
              title="Your circle meets Thursday at 7 pm"
              description="Next Step: data careers"
              meta="Thu"
            />
          </List>
        </Panel>
        <div className={styles.swatchGroups}>
          <Panel
            title="A card that is a way in"
            description="Lifts one step under the pointer."
            mark={<ModuleMark module="money" />}
            interactive
          >
            <LinkButton href="#lists" variant="secondary">
              Open the money plan
            </LinkButton>
          </Panel>
          <Panel title="A quiet panel" description="No surface of its own." tone="quiet">
            <p className="wp-secondary">For grouping on the page without another raised box.</p>
          </Panel>
        </div>
        <Panel title="Circles" flush>
          <EmptyState
            title="You're not in a circle yet"
            action={<Button variant="primary">Find a circle</Button>}
          >
            Circles are 6 to 10 people going through the same change. They meet weekly and keep each
            other going.
          </EmptyState>
        </Panel>
        <Panel title="Questions" flush>
          <Disclosure title="Why am I seeing this?">
            We matched it to your city and the role in your plan. You can turn off matching in
            Privacy.
          </Disclosure>
          <Disclosure title="How accurate are these forecasts?">
            We publish our record: every forecast, what happened, and our score.
          </Disclosure>
        </Panel>
        <Tabs>
          <TabList label="Plan views">
            <Tab id="route" icon="path">
              Route
            </Tab>
            <Tab id="skills" icon="learn">
              Skills
            </Tab>
            <Tab id="proof" icon="certificate">
              Proof
            </Tab>
          </TabList>
          <TabPanel id="route">Your route shows each step in order.</TabPanel>
          <TabPanel id="skills">Skills you have and skills this plan builds.</TabPanel>
          <TabPanel id="proof">Verified work you can share with employers.</TabPanel>
        </Tabs>
      </section>

      <section className={styles.section} aria-labelledby="loading">
        <h2 id="loading">Loading</h2>
        <p className="wp-secondary wp-measure">
          A page is never blank while it loads: it shows its own shape (a heading, the Sign, two
          panels) and the content takes its place without a jump. The blocks shimmer where motion is
          welcome and stay still in lite mode.
        </p>
        <div className="wp-cluster">
          <Switch isSelected={skeleton} onChange={setSkeleton}>
            Show the loading page
          </Switch>
        </div>
        <Panel title="Lines in a panel">
          <div className="wp-stack">
            <Skeleton width="60%" />
            <Skeleton />
            <Skeleton width="80%" />
          </div>
        </Panel>
        {skeleton ? (
          <div className={styles.frame}>
            <PageSkeleton label="Loading your day" />
          </div>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="pages">
        <h2 id="pages">Pages</h2>
        <p className="wp-secondary wp-measure">
          A module page starts with a band in the module's tint (this page has one at the top), uses
          two columns on a wide screen, and ends with up to three places to go next. Going from one
          page to the other, the old page fades out and the new one rises in, while the bar at the
          top stays where it is. Lite mode and a request for less motion switch that off.
        </p>
        <div className="wp-cluster">
          <LinkButton href="/design/module" variant="secondary" icon="forward">
            Open the example page
          </LinkButton>
        </div>
      </section>

      <CommandPalette
        isOpen={palette}
        onOpenChange={setPalette}
        title="Go to"
        searchLabel="Search the design system"
        placeholder="Type a name"
        emptyLabel="Nothing matches. Try another word."
        closeLabel="Close"
        countLabel={(n) => (n === 1 ? '1 result' : `${n} results`)}
        sections={commands}
      />
      <Dialog
        isOpen={sheet}
        onOpenChange={setSheet}
        title="Check-in with your circle"
        variant="sheet"
        footer={
          <Button variant="primary" onPress={() => setSheet(false)}>
            Save check-in
          </Button>
        }
      >
        <div className="wp-stack">
          <TextField label="What did you do this week?" multiline />
          <RadioGroup label="How did it go?" defaultValue="partly">
            <Radio value="done">Done</Radio>
            <Radio value="partly">Partly</Radio>
            <Radio value="not">Not this week</Radio>
          </RadioGroup>
        </div>
      </Dialog>
      <Dialog
        isOpen={dialog}
        onOpenChange={setDialog}
        title="Share your project"
        footer={
          <>
            <Button variant="secondary" onPress={() => setDialog(false)}>
              Not now
            </Button>
            <Button variant="primary" onPress={() => setDialog(false)}>
              Share with my circle
            </Button>
          </>
        }
      >
        Your circle will see the project and your notes. You can stop sharing at any time.
      </Dialog>
      <ConfirmDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title="Delete your account?"
        confirmLabel="Delete my account"
        cancelLabel="Keep my account"
        confirmWord="delete"
        confirmWordLabel='Type "delete" to confirm'
        onConfirm={() => setConfirm(false)}
      >
        <p>
          This permanently removes your plans, check-ins, journal and memories. Encrypted data
          becomes unreadable immediately. This can't be undone.
        </p>
      </ConfirmDialog>
    </>
  );
}
