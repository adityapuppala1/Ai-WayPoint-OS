/**
 * Link analysis for Scam Shield. Offline and deterministic: no lookups, no clicks.
 * We never visit a link someone asks us to check — that could confirm their number
 * to a scammer or trigger a download.
 */
import type { UrlFinding, UrlFlag } from '../types';

const MULTI_PART_SUFFIXES = new Set([
  'co.in',
  'gov.in',
  'org.in',
  'net.in',
  'ac.in',
  'nic.in',
  'res.in',
  'firm.in',
  'gen.in',
  'ind.in',
  'co.uk',
  'gov.uk',
  'org.uk',
  'ac.uk',
  'nhs.uk',
  'police.uk',
  'com.br',
  'gov.br',
  'org.br',
  'net.br',
  'co.ke',
  'go.ke',
  'or.ke',
  'ac.ke',
  'com.ng',
  'gov.ng',
  'org.ng',
  'edu.ng',
  'com.au',
  'gov.au',
  'org.au',
  'net.au',
  'edu.au',
  'co.za',
  'gov.za',
  'org.za',
  'com.ph',
  'gov.ph',
  'org.ph',
  'com.mx',
  'gob.mx',
  'com.ar',
  'gob.ar',
  'com.co',
  'gov.co',
  'com.pe',
  'gob.pe',
  'co.jp',
  'go.jp',
  'or.jp',
  'co.kr',
  'go.kr',
  'com.sg',
  'gov.sg',
  'com.my',
  'gov.my',
  'co.id',
  'go.id',
  'or.id',
  'com.pk',
  'gov.pk',
  'com.bd',
  'gov.bd',
  'com.np',
  'gov.np',
  'com.eg',
  'gov.eg',
  'com.sa',
  'gov.sa',
  'gov.ae',
  'co.ae',
  'com.tr',
  'co.tz',
  'go.tz',
  'or.tz',
  'ac.tz',
  'co.ug',
  'go.ug',
  'or.ug',
  'co.rw',
  'gov.rw',
  'com.gh',
  'gov.gh',
  'com.et',
  'gov.et',
  'co.ma',
  'gov.ma',
  'gouv.sn',
  'gouv.ci',
  'gouv.fr',
  'com.es',
  'gob.es',
  'com.pt',
  'gov.pt',
  'gob.cl',
  'gov.tr',
  'co.tz',
  'go.tz',
  'co.ug',
  'go.ug',
  'com.gh',
  'gov.gh',
  'com.et',
  'gov.et',
  'co.nz',
  'govt.nz',
  'com.vn',
  'gov.vn',
  'co.th',
  'go.th',
]);

/** Official domains of brands and agencies that scammers commonly imitate. */
export const PROTECTED_DOMAINS = [
  'paypal.com',
  'amazon.com',
  'amazon.in',
  'amazon.co.uk',
  'flipkart.com',
  'myntra.com',
  'meesho.com',
  'sbi.co.in',
  'onlinesbi.sbi',
  'hdfcbank.com',
  'icicibank.com',
  'axisbank.com',
  'kotak.com',
  'pnbindia.in',
  'bankofbaroda.in',
  'paytm.com',
  'phonepe.com',
  'npci.org.in',
  'uidai.gov.in',
  'incometax.gov.in',
  'epfindia.gov.in',
  'indiapost.gov.in',
  'india.gov.in',
  'google.com',
  'gmail.com',
  'microsoft.com',
  'outlook.com',
  'apple.com',
  'icloud.com',
  'netflix.com',
  'whatsapp.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'telegram.org',
  'dhl.com',
  'fedex.com',
  'ups.com',
  'usps.com',
  'royalmail.com',
  'bluedart.com',
  'delhivery.com',
  'irs.gov',
  'ssa.gov',
  'gov.uk',
  'hmrc.gov.uk',
  'safaricom.co.ke',
  'mpesa.africa',
  'gcash.com',
  'mercadolibre.com',
  'mercadopago.com',
  'nubank.com.br',
  'itau.com.br',
  'caixa.gov.br',
  'binance.com',
  'coinbase.com',
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'hsbc.com',
  'barclays.co.uk',
  'santander.com',
  'gtbank.com',
  'firstbanknigeria.com',
  'accessbankplc.com',
  'equitybank.co.ke',
  'kcbgroup.com',
  // Couriers, banks and utilities most imitated in the other launch markets
  'laposte.fr',
  'colissimo.fr',
  'chronopost.fr',
  'mondialrelay.fr',
  'ameli.fr',
  'correos.es',
  'estafeta.com',
  'bbva.com',
  'caixabank.es',
  'correios.com.br',
  'bradesco.com.br',
  'picpay.com',
  'ctt.pt',
  'aramex.com',
  'smsaexpress.com',
  'alrajhibank.com.sa',
  'emiratesnbd.com',
  'kplc.co.ke',
  'tanesco.co.tz',
  'vodacom.co.tz',
  'airtel.africa',
];

const BRAND_LABELS = [...new Set(PROTECTED_DOMAINS.map((d) => d.split('.')[0] ?? d))].filter(
  (b) => b.length >= 3,
);

const SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'cutt.ly',
  'rb.gy',
  'shorturl.at',
  'tiny.cc',
  'rebrand.ly',
  's.id',
  'v.gd',
  't.ly',
  'bl.ink',
  'surl.li',
  'shorturl.asia',
  'u.to',
  'clck.ru',
  'qrco.de',
  'tinyurl.is',
  'short.gy',
  'buff.ly',
  'dub.sh',
]);

const MESSAGING = [
  'wa.me',
  'api.whatsapp.com',
  'chat.whatsapp.com',
  't.me',
  'telegram.me',
  'telegram.dog',
];

const FREE_HOSTING = [
  '000webhostapp.com',
  'weebly.com',
  'wixsite.com',
  'blogspot.com',
  'web.app',
  'firebaseapp.com',
  'glitch.me',
  'netlify.app',
  'vercel.app',
  'pages.dev',
  'github.io',
  'ngrok.io',
  'ngrok-free.app',
  'duckdns.org',
  'herokuapp.com',
  'repl.co',
  'square.site',
  'godaddysites.com',
  'sites.google.com',
  'forms.gle',
  'webflow.io',
  'framer.website',
  'carrd.co',
  'mystrikingly.com',
];

/** TLDs disproportionately used for abuse in recent industry reports. Weak signal on its own. */
const SUSPICIOUS_TLDS = new Set([
  'top',
  'xyz',
  'click',
  'link',
  'shop',
  'online',
  'site',
  'website',
  'buzz',
  'icu',
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
  'work',
  'rest',
  'live',
  'loan',
  'win',
  'bid',
  'cyou',
  'sbs',
  'monster',
  'quest',
  'cfd',
  'lol',
  'mom',
  'zip',
  'mov',
  'bond',
  'autos',
  'hair',
  'boats',
  'vip',
]);

const DOWNLOAD_EXT = /\.(?:apk|xapk|exe|scr|msi|bat|cmd|jar|vbs|ps1|dmg|pkg)(?:$|[?#])/i;

const URL_RE =
  /\b(?:(?:https?:\/\/|www\.)[^\s<>"'()]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})(?::\d{2,5})?(?:\/[^\s<>"'()]*)?)/gi;

const TRAILING = new Set(['.', ',', ';', ':', '!', '?', ')', ']']);

/**
 * A link without the sentence's punctuation after it ("…/login!!!"). Counted back from the
 * end: a pattern anchored there started again at every "!" of a long run in the middle.
 */
function withoutTrailingPunctuation(link: string): string {
  let end = link.length;
  while (end > 0 && TRAILING.has(link[end - 1] ?? '')) end--;
  return link.slice(0, end);
}

/** Finds links in free text, including bare domains ("paytm-kyc.in/verify"). */
export function extractUrls(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(URL_RE)) {
    const raw = withoutTrailingPunctuation(m[0]);
    if (/^[\d.]+$/.test(raw)) continue; // plain numbers like 1.5
    if (!/[a-z]/i.test(raw.split('/')[0] ?? '')) {
      // bare IPv4 hosts are only links when they have a scheme
      if (!/^https?:\/\//i.test(raw)) continue;
    }
    // "e.g." / "i.e." and file names like "photo.jpg" are not links without a scheme
    if (!/^https?:\/\//i.test(raw) && !/^www\./i.test(raw)) {
      const host = raw.split('/')[0]!.toLowerCase();
      const tld = host.split('.').pop() ?? '';
      if (
        /^(?:jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|txt|mp3|mp4|zip)$/.test(tld) ||
        host.length < 4
      )
        continue;
      if (/^(?:e\.g|i\.e|etc|a\.m|p\.m)$/.test(host)) continue;
    }
    found.add(raw);
  }
  // data: URIs can carry whole phishing pages
  for (const m of text.matchAll(/\bdata:[a-z]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]{16,}/gi))
    found.add(m[0]);
  return [...found].slice(0, 20);
}

export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

/** Undo look-alike character tricks: paypa1 → paypal, arnazon → amazon, g00gle → google. */
function deconfuse(label: string): string {
  return label
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/0/g, 'o')
    .replace(/[1!|]/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Returns the brand domain this host imitates, if any. Official domains and their subdomains are never flagged. */
/** Government domains: .gov, .gov.xx, .gouv.xx, .gob.xx, .go.ke and the like, and .nic.in. */
const GOV =
  /\.gov(?:\.[a-z]{2})?$|\.gov\.[a-z]{2}$|\.gouv\.[a-z]{2}$|\.gob\.[a-z]{2}$|\.go\.(?:ke|tz|ug|id|jp|kr|th)$|\.nic\.in$/;

/** Brands with a site in nearly every country: amazon.es, google.co.ke and dhl.de are theirs. */
const GLOBAL_BRANDS = new Set([
  'amazon',
  'google',
  'microsoft',
  'apple',
  'netflix',
  'paypal',
  'dhl',
  'fedex',
  'ups',
  'facebook',
  'instagram',
  'whatsapp',
  'linkedin',
  'binance',
  'santander',
  'hsbc',
  'mercadolibre',
  'mercadopago',
  'bbva',
  'airtel',
  'vodacom',
]);
/** A country's own suffix: es, fr, de, com.br, co.ke, gob.mx… */
const COUNTRY_SUFFIX = /^(?:(?:com|co|org|net|gob|gouv|ac|or|ne)\.)?[a-z]{2}$/;

/** A site that belongs to a brand or government Shield knows, rather than an imitation. */
export function isOfficialHost(host: string): boolean {
  const h = host.toLowerCase();
  const reg = registrableDomain(h);
  const [label = '', ...suffix] = reg.split('.');
  return (
    PROTECTED_DOMAINS.some((d) => reg === d || h === d || h.endsWith(`.${d}`)) ||
    (GLOBAL_BRANDS.has(label) && COUNTRY_SUFFIX.test(suffix.join('.'))) ||
    GOV.test(reg) ||
    GOV.test(h)
  );
}

export function lookalikeOf(host: string): string | undefined {
  const h = host.toLowerCase();
  const reg = registrableDomain(h);
  if (isOfficialHost(h)) return undefined;
  // On free hosting (whatsapp-renew.web.app) the site's own name is the label before the host's suffix.
  const freeHost = FREE_HOSTING.find((f) => h.endsWith(`.${f}`));
  const siteHost = freeHost ? h.slice(0, -(freeHost.length + 1)) : reg;
  const label = (freeHost ? siteHost.split('.').pop() : siteHost.split('.')[0]) ?? '';
  const words = label.split(/[-_]/);
  const cleaned = deconfuse(label.replace(/[-_]/g, ''));
  for (const brand of BRAND_LABELS) {
    // "sbi-kyc-update", "amazon-refunds", "paytmkyc"
    if (
      words.includes(brand) ||
      (cleaned.includes(brand) && cleaned !== brand && brand.length >= 5)
    ) {
      return PROTECTED_DOMAINS.find((d) => d.startsWith(`${brand}.`));
    }
    // "paypa1", "amaz0n", "hdfcbnak"
    if (cleaned.length >= 4 && Math.abs(cleaned.length - brand.length) <= 2) {
      const d = levenshtein(cleaned, brand);
      if (d > 0 && d <= (brand.length >= 7 ? 2 : 1))
        return PROTECTED_DOMAINS.find((x) => x.startsWith(`${brand}.`));
      if (d === 0 && label !== brand)
        return PROTECTED_DOMAINS.find((x) => x.startsWith(`${brand}.`)); // digits swapped in
    }
  }
  // Brand names hidden in subdomains of an unrelated domain: "sbi.co.in.verify-now.top"
  const sub = h.slice(0, Math.max(0, h.length - reg.length - 1));
  for (const d of PROTECTED_DOMAINS) {
    if (sub && (sub === d || sub.endsWith(d) || sub.includes(`${d}.`))) return d;
  }
  return undefined;
}

export function analyzeUrl(raw: string): UrlFinding {
  const flags = new Set<UrlFlag>();
  if (/^data:/i.test(raw)) return { url: raw.slice(0, 80), host: '', flags: ['data-uri'] };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
  } catch {
    return { url: raw, host: '', flags: [] };
  }
  const host = url.hostname.toLowerCase();
  const reg = registrableDomain(host);
  if (url.protocol === 'http:' && /^https?:\/\//i.test(raw)) flags.add('insecure-http');
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) flags.add('ip-host');
  if (host.split('.').some((l) => l.startsWith('xn--'))) flags.add('punycode');
  if (SHORTENERS.has(reg) || SHORTENERS.has(host)) flags.add('shortener');
  if (MESSAGING.some((m) => host === m || host.endsWith(`.${m}`))) flags.add('messaging-redirect');
  if (FREE_HOSTING.some((f) => host === f || host.endsWith(`.${f}`))) flags.add('free-hosting');
  const tld = host.split('.').pop() ?? '';
  if (SUSPICIOUS_TLDS.has(tld)) flags.add('suspicious-tld');
  if (host.split('.').length >= 5) flags.add('many-subdomains');
  if (url.username || /@/.test(raw.replace(/^https?:\/\//i, '').split('/')[0] ?? ''))
    flags.add('at-sign');
  if (raw.length > 120) flags.add('very-long');
  if (DOWNLOAD_EXT.test(url.pathname)) flags.add('file-download');
  const look = lookalikeOf(host);
  if (look) flags.add('lookalike');
  return {
    url: raw.length > 200 ? `${raw.slice(0, 197)}...` : raw,
    host,
    flags: [...flags],
    ...(look ? { lookalikeOf: look } : {}),
  };
}
