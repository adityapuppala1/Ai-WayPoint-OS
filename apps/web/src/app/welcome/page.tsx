import { safeNextPath } from '@waypoint/core';
import { localeNames, locales } from '@waypoint/i18n';
import {
  Icon,
  type IconName,
  LinkButton,
  type ModuleKey,
  ModuleMark,
  Route as RouteLine,
  type Station,
} from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DeviceShot } from '@/components/landing/DeviceShot';
import { HeroArt } from '@/components/landing/HeroArt';
import { HeroStage } from '@/components/landing/HeroStage';
import styles from '@/components/landing/landing.module.css';
import { Reveal } from '@/components/landing/Reveal';
import { type Situation, SituationArt } from '@/components/landing/SituationArt';
import { NAV } from '@/components/shell/nav-items';
import { PublicShell } from '@/components/shell/PublicShell';
import { getViewer } from '@/lib/server';
import { startHref } from './start-href';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  const landing = await getTranslations('landing');
  return {
    title: { absolute: `${t('title')} — ${t('tagline')}` },
    description: landing('hero.lead'),
  };
}

/** What getting started asks, in order (the same five stations as on /start). */
const STATIONS = ['situation', 'place', 'skills', 'time', 'privacy'] as const;

/** The modules that open with no account, and where. */
const OPEN: { key: ModuleKey; href: string; benefit: string }[] = [
  { key: 'shield', href: '/shield', benefit: 'shield' },
  { key: 'support', href: '/support', benefit: 'support' },
  { key: 'civic', href: '/civic', benefit: 'civic' },
  { key: 'surroundings', href: '/surroundings', benefit: 'surroundings' },
  { key: 'signals', href: '/signals/forecasts', benefit: 'forecasts' },
];
const OPEN_KEYS = new Set<string>(['shield', 'civic', 'surroundings']);

/** Each situation, and where its link goes: open modules directly, the rest through getting started. */
const SITUATIONS: { key: Situation; href: string; action: 'own' | 'shield' | 'help' }[] = [
  { key: 'job', href: startHref('/'), action: 'own' },
  { key: 'scam', href: '/shield', action: 'shield' },
  { key: 'money', href: startHref('/money'), action: 'own' },
  { key: 'hardDay', href: '/support', action: 'help' },
  { key: 'moving', href: startHref('/civic'), action: 'own' },
  { key: 'caring', href: startHref('/'), action: 'own' },
];

const STEPS = ['tell', 'next', 'plan', 'help'] as const;

const ACCESS: { key: 'web' | 'app' | 'text' | 'offline' | 'languages' | 'free'; icon: IconName }[] =
  [
    { key: 'web', icon: 'web' },
    { key: 'app', icon: 'phone' },
    { key: 'text', icon: 'text' },
    { key: 'offline', icon: 'support' },
    { key: 'languages', icon: 'language' },
    { key: 'free', icon: 'quick' },
  ];

const PROMISES: {
  key: 'crisis' | 'exit' | 'encrypted' | 'noAds' | 'ai' | 'delete';
  icon: IconName;
}[] = [
  { key: 'crisis', icon: 'support' },
  { key: 'exit', icon: 'close' },
  { key: 'encrypted', icon: 'lock' },
  { key: 'noAds', icon: 'hide' },
  { key: 'ai', icon: 'ask' },
  { key: 'delete', icon: 'delete' },
];

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getViewer();
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  if (viewer) redirect(safeNext as Route);
  const [t, start, nav, welcome, forecasts, a11y, shell, legal, byText] = await Promise.all([
    getTranslations('landing'),
    getTranslations('start'),
    getTranslations('nav'),
    getTranslations('welcome'),
    getTranslations('forecasts'),
    getTranslations('a11y'),
    getTranslations('shell'),
    getTranslations('legal'),
    getTranslations('byText'),
  ]);
  const begin = startHref(safeNext) as Route;

  // Nothing is answered yet, so every station of getting started is still ahead.
  const setup: Station[] = STATIONS.map((key) => ({
    id: key,
    label: start(`steps.${key}`),
    state: 'upcoming',
  }));

  const moduleName = (key: ModuleKey, href: string) =>
    href === '/signals/forecasts' ? forecasts('title') : nav(key as 'today');

  const actions = (
    <div className={styles.actions}>
      <LinkButton variant="primary" size="lg" href={begin}>
        {t('hero.start')}
      </LinkButton>
      <LinkButton variant="onSign" size="lg" href={'/sign-in' as Route}>
        {shell('signIn')}
      </LinkButton>
    </div>
  );

  return (
    <PublicShell bleed>
      <div className={styles.landing}>
        {/* 1. What it is, who it is for, and how to begin. Drawn by the server, at once. */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <h1 id="hero-title" className={styles.heroTitle}>
                {t('hero.title')}
              </h1>
              <p className={styles.heroLead}>{t('hero.lead')}</p>
              {actions}
              <ul className={styles.facts} aria-label={t('hero.factsLabel')}>
                <li>
                  <Icon name="check" size={18} weight="bold" />
                  {t('hero.free')}
                </li>
                <li>
                  <Icon name="language" size={18} weight="bold" />
                  {t('hero.languages')}
                </li>
                <li>
                  <Icon name="support" size={18} weight="bold" />
                  {t('hero.offline')}
                </li>
              </ul>
              <p className={styles.urgent}>
                {t('hero.urgent')}{' '}
                <Link href={'/support' as Route} className={styles.urgentLink}>
                  {shell('help')}
                </Link>
              </p>
            </div>
            <HeroStage>
              <HeroArt />
            </HeroStage>
          </div>
        </section>

        {/* 2. By life situation: where Waypoint starts for each. */}
        <section className={styles.section} aria-labelledby="situations-title">
          <div className={styles.sectionHead}>
            <h2 id="situations-title">{t('situations.title')}</h2>
            <p className={styles.sectionLead}>{t('situations.lead')}</p>
          </div>
          <ul className={styles.situations}>
            {SITUATIONS.map((s, i) => (
              <li key={s.key}>
                <Reveal className={styles.situation} delay={(i % 3) * 90}>
                  <SituationArt situation={s.key} />
                  <h3 className={styles.itemTitle}>{t(`situations.${s.key}.title`)}</h3>
                  <p className={styles.itemBody}>{t(`situations.${s.key}.body`)}</p>
                  <Link href={s.href as Route} className={styles.itemLink}>
                    {s.action === 'shield'
                      ? welcome('checkMessage')
                      : s.action === 'help'
                        ? shell('help')
                        : t(`situations.${s.key as 'job'}.action`)}
                    <Icon name="forward" size={16} weight="bold" />
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. How it works: a real sequence, so a route with stations. */}
        <section className={styles.section} aria-labelledby="how-title">
          <div className={styles.sectionHead}>
            <h2 id="how-title">{t('how.title')}</h2>
            <p className={styles.sectionLead}>{t('how.lead')}</p>
          </div>
          <div className={styles.how}>
            <Reveal className={styles.howRoute}>
              <ol className={styles.steps} aria-label={t('how.label')}>
                {STEPS.map((step) => (
                  <li key={step} className={styles.step}>
                    <h3 className={styles.itemTitle}>{t(`how.${step}.title`)}</h3>
                    <p className={styles.itemBody}>{t(`how.${step}.body`)}</p>
                    {step === 'tell' ? (
                      <div className={styles.setup}>
                        <p className={styles.setupTitle}>{t('how.setupTitle')}</p>
                        <RouteLine
                          stations={setup}
                          module="today"
                          label={start('progressLabel')}
                          stateLabels={{
                            done: a11y('routeDone'),
                            current: a11y('routeCurrent'),
                            upcoming: a11y('routeUpcoming'),
                          }}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal className={styles.howShot} delay={120}>
              <DeviceShot shot="today" alt={t('shots.today')} caption={nav('today')} wide />
            </Reveal>
          </div>
        </section>

        {/* 4. What you get: every module, with one plain benefit each. */}
        <section className={styles.section} aria-labelledby="modules-title">
          <div className={styles.sectionHead}>
            <h2 id="modules-title">{t('modules.title')}</h2>
            <p className={styles.sectionLead}>{t('modules.lead')}</p>
          </div>
          <div className={styles.modules}>
            <div className={styles.directory}>
              <h3 className={styles.groupTitle}>{t('modules.openTitle')}</h3>
              <ul className={styles.rows}>
                {OPEN.map((m) => (
                  <li key={m.href}>
                    <Link href={m.href as Route} className={styles.row}>
                      <ModuleMark module={m.key} size="sm" />
                      <span className={styles.rowText}>
                        <span className={styles.rowName}>{moduleName(m.key, m.href)}</span>
                        <span className={styles.rowBenefit}>
                          {t(`modules.benefit.${m.benefit as 'shield'}`)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <h3 className={styles.groupTitle}>{t('modules.afterTitle')}</h3>
              <ul className={styles.rows}>
                {NAV.filter((item) => !OPEN_KEYS.has(item.key)).map((item) => (
                  <li key={item.key}>
                    <Link href={startHref(item.href) as Route} className={styles.row}>
                      <ModuleMark module={item.key} size="sm" />
                      <span className={styles.rowText}>
                        <span className={styles.rowName}>{nav(item.key as 'today')}</span>
                        <span className={styles.rowBenefit}>
                          {t(`modules.benefit.${item.key as 'today'}`)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.screens}>
              <Reveal>
                <DeviceShot shot="shield" alt={t('shots.shield')} caption={nav('shield')} />
              </Reveal>
              <Reveal delay={120}>
                <DeviceShot shot="ask" alt={t('shots.ask')} caption={nav('ask')} />
              </Reveal>
            </div>
          </div>
          <p className={styles.note}>{t('shots.note')}</p>
        </section>

        {/* 5. How to reach it. */}
        <section className={styles.section} aria-labelledby="access-title">
          <div className={styles.sectionHead}>
            <h2 id="access-title">{t('access.title')}</h2>
          </div>
          <ul className={styles.board}>
            {ACCESS.map((a) => (
              <li key={a.key} className={styles.boardItem}>
                <Icon name={a.icon} size={24} className={styles.boardIcon} />
                <h3 className={styles.itemTitle}>{t(`access.${a.key}.title`)}</h3>
                <p className={styles.itemBody}>{t(`access.${a.key}.body`)}</p>
                {a.key === 'text' ? (
                  <Link href={'/text' as Route} className={styles.itemLink}>
                    {byText('title')}
                    <Icon name="forward" size={16} weight="bold" />
                  </Link>
                ) : null}
                {a.key === 'languages' ? (
                  <ul className={styles.languages} aria-label={t('access.languagesLabel')}>
                    {locales.map((code) => (
                      <li key={code} lang={code} dir={code === 'ar' ? 'rtl' : 'ltr'}>
                        {localeNames[code]}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {/* 6. Safety and privacy: only what the code keeps. */}
        <section className={styles.section} aria-labelledby="safety-title">
          <div className={styles.sectionHead}>
            <h2 id="safety-title">{t('safety.title')}</h2>
            <p className={styles.sectionLead}>{t('safety.lead')}</p>
          </div>
          <div className={styles.safety}>
            <ul className={styles.promises}>
              {PROMISES.map((p) => (
                <li key={p.key} className={styles.promise}>
                  <span className={styles.promiseIcon}>
                    <Icon name={p.icon} size={20} />
                  </span>
                  <div>
                    <h3 className={styles.itemTitle}>{t(`safety.${p.key}.title`)}</h3>
                    <p className={styles.itemBody}>
                      {p.key === 'noAds'
                        ? legal('privacy.short.never')
                        : t(`safety.${p.key as 'crisis'}.body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className={styles.safetyAside}>
              <Reveal>
                <DeviceShot shot="help" alt={t('shots.help')} caption={shell('help')} />
              </Reveal>
              <Link href={'/privacy' as Route} className={styles.itemLink}>
                {legal('privacyLink')}
                <Icon name="forward" size={16} weight="bold" />
              </Link>
            </div>
          </div>
        </section>

        {/* 7. The way in, again, at the end. */}
        <section className={styles.final} aria-labelledby="final-title">
          <div className={styles.finalInner}>
            <h2 id="final-title">{t('cta.title')}</h2>
            <p className={styles.sectionLead}>{t('cta.body')}</p>
            <div className={styles.finalActions}>
              <LinkButton variant="primary" size="lg" href={begin}>
                {t('hero.start')}
              </LinkButton>
              <LinkButton variant="secondary" size="lg" href={'/sign-in' as Route}>
                {shell('signIn')}
              </LinkButton>
            </div>
            <p className={styles.finalHelp}>
              {t('hero.urgent')} <Link href={'/support' as Route}>{shell('help')}</Link>
            </p>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
