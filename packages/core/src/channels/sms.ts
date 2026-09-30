/**
 * SMS length rules. A text in the GSM 03.38 alphabet fits 160 characters in one message (153
 * in each part of a longer one); anything outside it — Hindi, Arabic, emoji, even a curly
 * apostrophe — switches the whole text to UCS-2: 70 characters, or 67 per part. Every part
 * costs the sender, and long texts arrive late or in pieces on basic phones.
 */

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€';
const BASIC = new Set(GSM_BASIC);
const EXTENDED = new Set(GSM_EXTENDED);

export type SmsEncoding = 'gsm7' | 'ucs2';

/**
 * Typographic characters that have a plain equivalent in the GSM alphabet. Used on replies
 * so an English, Spanish or Swahili answer stays in the cheaper, longer encoding.
 */
export function plainPunctuation(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/•/g, '-');
}

/**
 * Accented Latin letters the SMS alphabet lacks, and the nearest letter it has (é, è, à, ñ, ü
 * and ç's capital are already in it, so French and Spanish keep most of their accents).
 */
const NEAREST: Record<string, string> = Object.fromEntries(
  [
    ['áâãāą', 'a'],
    ['ÁÂÃĀĄ', 'A'],
    ['êëēęě', 'e'],
    ['ÈÊËĒĘĚ', 'E'],
    ['íîïī', 'i'],
    ['ÌÍÎÏĪ', 'I'],
    ['óôõōő', 'o'],
    ['ÒÓÔÕŌŐ', 'O'],
    ['úûūůű', 'u'],
    ['ÙÚÛŪŮŰ', 'U'],
    ['ç', 'c'],
    ['ýÿ', 'y'],
    ['Ý', 'Y'],
    ['º', 'o'],
    ['ª', 'a'],
  ].flatMap(([from = '', to = '']) => [...from].map((c) => [c, to])),
);

/**
 * A Latin-script text in the cheaper SMS alphabet, trading the few accents it lacks for plain
 * letters, as people do when they text. Anything that would still need UCS-2 (Hindi, Arabic,
 * emoji) comes back unchanged: then the accents cost nothing extra.
 */
export function gsmLatin(text: string): string {
  const plain = plainPunctuation(text)
    .replace(/[œŒ]/g, (c) => (c === 'œ' ? 'oe' : 'OE'))
    .replace(/[^\n -~]/g, (c) => NEAREST[c] ?? c);
  return smsEncoding(plain) === 'gsm7' ? plain : text;
}

const LRM = String.fromCharCode(0x200e);
const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f]/;

/**
 * In Arabic text a phone's display can reverse the groups of a number ("+254 722 178 177"
 * shown as "177 178 722 254+"). A left-to-right mark on each side keeps every number in
 * order; basic phones have understood it for years, and Arabic texts are UCS-2 anyway.
 */
export function numbersInOrder(text: string): string {
  if (!ARABIC_SCRIPT.test(text)) return text;
  return text.replace(/[+*#]?\d[\d\s().*#-]*\d#?|\*\d+#/g, (m) => `${LRM}${m}${LRM}`);
}

export function smsEncoding(text: string): SmsEncoding {
  for (const ch of text) if (!BASIC.has(ch) && !EXTENDED.has(ch)) return 'ucs2';
  return 'gsm7';
}

/** How many parts a text needs, and in which encoding. */
export function smsParts(text: string): { encoding: SmsEncoding; units: number; parts: number } {
  const encoding = smsEncoding(text);
  if (encoding === 'gsm7') {
    let units = 0;
    for (const ch of text) units += EXTENDED.has(ch) ? 2 : 1;
    return { encoding, units, parts: units <= 160 ? 1 : Math.ceil(units / 153) };
  }
  // UCS-2 counts UTF-16 code units: an emoji takes two.
  const units = text.length;
  return { encoding, units, parts: units <= 70 ? 1 : Math.ceil(units / 67) };
}

/**
 * The text cut to fit `maxParts` messages, at a line break, sentence end or space where
 * possible, with an ellipsis. Short texts come back unchanged.
 */
export function fitSms(text: string, maxParts: number): string {
  if (smsParts(text).parts <= maxParts) return text;
  const gsm = smsEncoding(text) === 'gsm7';
  const ellipsis = gsm ? '...' : '…';
  const budget = gsm ? 153 * maxParts : 67 * maxParts;
  let cut = '';
  for (const ch of text) {
    const next = cut + ch;
    const size = gsm ? smsParts(next + ellipsis).units : (next + ellipsis).length;
    if (size > budget) break;
    cut = next;
  }
  const breakAt = Math.max(
    cut.lastIndexOf('\n'),
    cut.lastIndexOf('. '),
    cut.lastIndexOf('। '),
    cut.lastIndexOf('؟ '),
  );
  const space = cut.lastIndexOf(' ');
  const end =
    breakAt > cut.length * 0.6 ? breakAt + 1 : space > cut.length * 0.6 ? space : cut.length;
  return `${cut.slice(0, end).trimEnd()}${ellipsis}`;
}
