/**
 * Scam Shield's English source text: link and sender signals, advice and the AI note.
 * Translations live in ./l10n and are checked against these ids in tests.
 */
import type { ScamCategory } from '@waypoint/content';
import type { RiskLevel, UrlFlag } from '../types';

export interface SignalText {
  title: string;
  explanation: string;
}

export const URL_SIGNALS: Record<UrlFlag, SignalText & { weight: number }> = {
  lookalike: {
    weight: 0.75,
    title: 'Link imitates a well-known website',
    explanation: 'The web address looks like a real brand but isn’t its official site.',
  },
  'ip-host': {
    weight: 0.5,
    title: 'Link is a bare number, not a name',
    explanation: 'Real companies use named websites, not numeric addresses.',
  },
  punycode: {
    weight: 0.5,
    title: 'Link uses look-alike letters',
    explanation: 'Special characters can make a fake address look identical to a real one.',
  },
  'at-sign': {
    weight: 0.5,
    title: 'Link hides its real destination',
    explanation: 'An “@” in a web address can send you somewhere other than the name you see.',
  },
  'data-uri': {
    weight: 0.5,
    title: 'Link contains a hidden page',
    explanation: 'This link carries a whole web page inside it, a trick used to avoid detection.',
  },
  'file-download': {
    weight: 0.6,
    title: 'Link downloads an app or program',
    explanation:
      'Apps from links can read your messages and codes. Install only from the official store.',
  },
  shortener: {
    weight: 0.22,
    title: 'Link is shortened',
    explanation: 'Short links hide where they go. Scammers use them to disguise fake sites.',
  },
  'suspicious-tld': {
    weight: 0.3,
    title: 'Link ends in an unusual domain',
    explanation: 'This kind of web address is often used for short-lived scam sites.',
  },
  'free-hosting': {
    weight: 0.2,
    title: 'Link is on a free website builder',
    explanation: 'Anyone can create these pages in minutes; banks and governments don’t use them.',
  },
  'messaging-redirect': {
    weight: 0.15,
    title: 'Link opens a private chat',
    explanation: 'The link moves you to WhatsApp or Telegram with an unknown account.',
  },
  'many-subdomains': {
    weight: 0.2,
    title: 'Link has a long chain of names',
    explanation: 'Long chains can put a trusted name at the start of an untrusted address.',
  },
  'insecure-http': {
    weight: 0.1,
    title: 'Link isn’t secure',
    explanation: 'The page doesn’t use an encrypted connection.',
  },
  'very-long': {
    weight: 0.08,
    title: 'Link is unusually long',
    explanation: 'Very long links can hide tracking or a disguised address.',
  },
};

export const SENDER_SIGNALS = {
  'free-mail-official': {
    weight: 0.45,
    title: 'Official-sounding name on a free email address',
    explanation:
      'Banks, employers and agencies send email from their own domain, not Gmail or Yahoo.',
  },
  'foreign-number': {
    weight: 0.22,
    title: 'Number is from another country',
    explanation:
      'Job and prize messages from unexpected international numbers are a common scam pattern.',
  },
} as const satisfies Record<string, SignalText & { weight: number }>;

/** Shown under each reason the AI second opinion adds. */
export const AI_EXPLANATION =
  'Flagged by the AI check, which looks at the whole message in context.';

/** Title for a look-alike link when we know which brand it imitates. */
export const LOOKALIKE_TITLE = 'Link imitates {brand}';

/** Advice by id. Translations live in ./l10n; English here is the source and the fallback. */
export const ADVICE: Record<string, string> = {
  'check-anyway':
    'We didn’t find common scam signs. If it asks for money, codes or quick action, check with someone you trust first.',
  pause: 'Pause before you reply, click or pay. Scams rely on speed.',
  'verify-independently':
    'Check the sender yourself: use the official app, website or phone number you already know, not the details in the message.',
  'dont-engage': 'Don’t reply, don’t open the links and don’t pay.',
  'block-report': 'Block the sender and report it (see where to report below).',
  'if-paid':
    'Already paid or shared details? Call your bank now to stop the payment, change your passwords, and report it quickly — speed improves the chance of getting money back.',
  'cat-job': 'Real employers never ask you to pay to get a job, training or a “kit”.',
  'cat-bank-kyc':
    'Your bank will never ask for your PIN, password or one-time code, and won’t close your account by text. Call the number on the back of your card.',
  'cat-delivery':
    'Check deliveries only in the courier’s official app or website. Couriers don’t ask for small fees by text.',
  'cat-investment':
    'Guaranteed high returns are a warning sign. Check the company with your financial regulator before investing.',
  'cat-crypto':
    'Crypto payments can’t be reversed. Don’t send crypto to anyone who contacted you first.',
  'cat-lottery-prize': 'You can’t win a draw you didn’t enter. Never pay a fee to claim a prize.',
  'cat-romance': 'Never send money to someone you haven’t met in person, however close you feel.',
  'cat-sextortion':
    'Don’t pay — paying usually leads to more demands. Stop replying, save the evidence and report it. You are not in trouble.',
  'cat-tech-support':
    'Don’t install remote-access apps or buy gift cards for callers. Real companies don’t call you about viruses.',
  'cat-impersonation-authority':
    'Hang up. Call the agency on its official number, which you look up yourself.',
  'cat-digital-arrest':
    'There is no “digital arrest”. Police never hold anyone on a video call or ask for money to settle a case. Hang up and call your local police.',
  'cat-loan-app':
    'Borrow only from lenders registered with your central bank. Don’t give apps access to your contacts or photos.',
  'cat-utility-disconnection':
    'Pay bills only through the official app, website or office. Power companies don’t ask you to call personal numbers.',
  'cat-tax-refund': 'Claim tax refunds only through the official tax website, typed in yourself.',
  'cat-government-scheme':
    'Government schemes are free to apply for on official portals. Never pay an agent.',
  'cat-family-emergency':
    'Call your family member on the number you already have before you send anything.',
  'cat-marketplace':
    'Don’t refund “overpayments”. Wait until money has actually cleared in your own account.',
  'cat-rental': 'Never pay a deposit before you’ve seen the place and checked who owns it.',
  'cat-charity': 'Give through a registered charity’s official website, not a personal account.',
  'cat-phishing-link': 'Don’t open the link. Type the official website address yourself.',
  'cat-sim-swap-otp':
    'Never share one-time codes. If your phone suddenly loses signal, call your mobile operator at once.',
  'cat-qr-code': 'You never need to scan a code or enter your PIN to receive money.',
  'cat-deepfake-voice':
    'Hang up and call back on a number you know. Agree a family code word for emergencies.',
};

/** Which advice to show, in order, for a level and the top-ranked scam categories. */
export function adviceFor(level: RiskLevel, categories: ScamCategory[]): string[] {
  const top = categories[0] ? `cat-${categories[0]}` : undefined;
  if (level === 'low') return ['check-anyway'];
  if (level === 'unclear')
    return [...(top && ADVICE[top] ? [top] : []), 'pause', 'verify-independently'];
  return [...(top && ADVICE[top] ? [top] : []), 'dont-engage', 'block-report', 'if-paid'];
}
