'use client';

import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  Disclosure,
  EmptyState,
  IconButton,
  LinkButton,
  List,
  ListItem,
  type ModuleKey,
  ModuleMark,
  Notice,
  Panel,
  Probability,
  Radio,
  RadioGroup,
  RiskMeter,
  Route,
  Segmented,
  SelectField,
  Sign,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  toast,
} from '@waypoint/ui';
import { useState } from 'react';
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

export function DesignShowcase() {
  const [step, setStep] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [theme, setTheme] = useState('system');
  const current = STEPS[step % STEPS.length]!;

  return (
    <>
      <section className={styles.section} aria-labelledby="sign">
        <h2 id="sign">The sign</h2>
        <p className="wp-secondary wp-measure">
          The one bold element. Completing the step plays the only orchestrated motion in the
          product: the title flips like a departures board.
        </p>
        <Sign
          eyebrow="Your next step"
          module="path"
          context={`Week 2 of 12`}
          flipKey={step}
          title={current.title}
          details={[
            { label: 'Time', value: current.detail },
            { label: 'From', value: 'Data analyst plan' },
          ]}
          actions={
            <>
              <Button
                variant="primary"
                icon="check"
                onPress={() => {
                  setStep((s) => s + 1);
                  toast({ title: 'Marked as done', tone: 'safe' });
                }}
              >
                Mark as done
              </Button>
              <Button variant="onSign">Not today</Button>
            </>
          }
        />
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
          <IconButton icon="settings" label="Settings" />
          <IconButton icon="more" label="More actions" tone="outlined" />
          <LinkButton href="#route" variant="secondary">
            See the route
          </LinkButton>
        </div>
        <div className="wp-cluster">
          <Segmented
            label="Appearance"
            value={theme}
            onChange={setTheme}
            options={[
              { id: 'light', label: 'Light', icon: 'light' },
              { id: 'dark', label: 'Dark', icon: 'dark' },
              { id: 'system', label: 'Device', icon: 'system' },
            ]}
          />
          <Button variant="secondary" onPress={() => setDialog(true)}>
            Open a sheet
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
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="feedback">
        <h2 id="feedback">Status and honesty</h2>
        <div className={styles.swatchGroups}>
          <Panel title="Scam Shield verdict">
            <RiskMeter
              level="very-high"
              verdict="Very likely a scam"
              scale={['Looks safe', 'Unclear', 'Likely scam', 'Very likely']}
            />
          </Panel>
          <Panel title="Supply-chain analyst demand rises in Pune by March">
            <Probability
              value={0.68}
              words="Likely"
              baseRate={0.4}
              baseRateLabel="Usual for new roles:"
              record="Our record: 42 forecasts, Brier 0.18"
              label="Chance this happens"
            />
          </Panel>
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
        </div>
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

      <Dialog
        isOpen={dialog}
        onOpenChange={setDialog}
        title="Check-in with your circle"
        variant="sheet"
        footer={
          <Button variant="primary" onPress={() => setDialog(false)}>
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
