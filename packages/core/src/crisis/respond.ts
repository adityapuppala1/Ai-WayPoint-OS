import {
  getEmergency,
  getSupportResources,
  type SupportKind,
  type SupportResource,
} from '@waypoint/content';
import {
  type CrisisAction,
  type CrisisAssessment,
  type CrisisResponsePlan,
  LOCALES,
  type Locale,
} from '../types';
import { CRISIS_COPY, fill } from './copy';

export interface CrisisContext {
  country?: string | null;
  locale?: Locale | string | null;
  hasTrustedContact?: boolean;
  inCircle?: boolean;
}

/** Keep `*` and `#` (e.g. Chile's *4141, Japan's #8008); `#` must be escaped in a URI. */
const dialable = (n: string) => n.replace(/[^\d+*#]/g, '').replace(/#/g, '%23');
const telHref = (n: string) => `tel:${dialable(n)}`;
/** `?&body=` pre-fills a keyword and works on both iOS and Android. */
const smsHref = (n: string, keyword?: string) =>
  `sms:${dialable(n)}${keyword ? `?&body=${encodeURIComponent(keyword)}` : ''}`;

function pickLocale(a: CrisisAssessment, ctx: CrisisContext): Locale {
  const want = (ctx.locale ?? '').toString().toLowerCase().split('-')[0] ?? '';
  if ((LOCALES as readonly string[]).includes(want)) return want as Locale;
  if ((LOCALES as readonly string[]).includes(a.language)) return a.language as Locale;
  return 'en';
}

function kindsFor(a: CrisisAssessment): SupportKind[] {
  const c = new Set(a.categories);
  if (c.has('abuse') || c.has('violence-risk'))
    return ['domestic-violence', 'crisis-line', 'mental-health'];
  if (c.has('suicidal-ideation') || c.has('suicidal-plan') || c.has('self-harm'))
    return ['crisis-line', 'text-line', 'chat', 'mental-health'];
  return ['mental-health', 'crisis-line', 'text-line', 'chat'];
}

/**
 * Turns an assessment into what the person sees: a short, warm message and concrete
 * actions with real local numbers. Works without any AI and on every channel.
 */
export function planCrisisResponse(
  a: CrisisAssessment,
  ctx: CrisisContext = {},
): CrisisResponsePlan {
  const locale = pickLocale(a, ctx);
  const copy = CRISIS_COPY[locale];
  const cats = new Set(a.categories);
  const em = getEmergency(ctx.country);
  const emergencyNumber = em?.general ?? em?.ambulance ?? em?.police;
  const medical = cats.has('medical-emergency');
  const abuse = cats.has('abuse') || cats.has('violence-risk');

  const resources: SupportResource[] =
    a.tier === 0 || medical
      ? []
      : getSupportResources(ctx.country, { kinds: kindsFor(a), language: locale }).slice(0, 4);
  const primary = resources.find((r) => r.kind !== 'directory' && (r.phone || r.sms || r.url));
  const directory = resources.find((r) => r.kind === 'directory');
  const name = primary?.name;

  const actions: CrisisAction[] = [];
  const addEmergency = () => {
    if (emergencyNumber)
      actions.push({
        kind: 'emergency',
        label: fill(copy.actions.emergency, { emergency: emergencyNumber }),
        href: telHref(emergencyNumber),
      });
  };
  const addPrimary = (talkNow = false) => {
    if (!primary) return;
    if (primary.phone)
      actions.push({
        kind: 'call',
        label: talkNow ? copy.actions.talkNow : fill(copy.actions.call, { name: primary.name }),
        href: telHref(primary.phone),
        resourceId: primary.id,
      });
    if (primary.sms)
      actions.push({
        kind: 'text',
        label: fill(copy.actions.text, { name: primary.name }),
        href: smsHref(primary.sms, primary.smsKeyword),
        resourceId: primary.id,
      });
    if (!primary.phone && !primary.sms && primary.url)
      actions.push({
        kind: 'chat',
        label: fill(copy.actions.chat, { name: primary.name }),
        href: primary.url,
        resourceId: primary.id,
      });
  };
  const addDirectory = () => {
    if (directory?.url)
      actions.push({
        kind: 'web',
        label: copy.actions.directory,
        href: directory.url,
        resourceId: directory.id,
      });
  };

  let headline: string;
  let message: string;

  if (medical) {
    headline = copy.medical.headline;
    message = emergencyNumber
      ? fill(copy.medical.message, { emergency: emergencyNumber })
      : copy.medical.messageNoNumber;
    addEmergency();
  } else if (a.aboutOther) {
    headline = copy.other.headline;
    message =
      name && emergencyNumber
        ? fill(copy.other.message, { emergency: emergencyNumber, name })
        : copy.other.messageNoService;
    if (a.tier === 3) addEmergency();
    addPrimary();
    if (!primary) addDirectory();
  } else if (abuse && a.tier >= 2) {
    headline = copy.abuse.headline;
    message =
      name && emergencyNumber
        ? fill(copy.abuse.message, { emergency: emergencyNumber, name })
        : copy.abuse.messageNoService;
    addEmergency();
    addPrimary();
    if (!primary) addDirectory();
  } else if (a.tier === 3) {
    headline = copy.imminent.headline;
    message = emergencyNumber
      ? fill(copy.imminent.message, { emergency: emergencyNumber })
      : copy.imminent.messageNoNumber;
    addEmergency();
    addPrimary();
    if (!primary) addDirectory();
    if (ctx.hasTrustedContact)
      actions.push({ kind: 'trusted-contact', label: copy.actions.trustedContact });
  } else if (a.tier === 2) {
    headline = copy.ideation.headline;
    message = name ? fill(copy.ideation.message, { name }) : copy.ideation.messageNoService;
    addPrimary();
    if (!primary) addDirectory();
    if (ctx.hasTrustedContact)
      actions.push({ kind: 'trusted-contact', label: copy.actions.trustedContact });
    actions.push({ kind: 'grounding', label: copy.actions.grounding });
  } else {
    headline = copy.distress.headline;
    message = copy.distress.message;
    actions.push({ kind: 'grounding', label: copy.actions.grounding });
    if (ctx.inCircle) actions.push({ kind: 'circle', label: copy.actions.circle });
    addPrimary(true);
    if (!primary) addDirectory();
  }
  if (!medical) actions.push({ kind: 'stay', label: copy.actions.stay });

  return {
    tier: a.tier,
    categories: a.categories,
    locale,
    headline,
    message,
    actions,
    resources,
    emergencyNumber,
    followUpHours: medical ? null : a.tier === 3 ? 12 : a.tier === 2 ? 24 : null,
    safeMode: a.tier >= 2,
    suppressAiReply: a.tier === 3 || medical,
  };
}
