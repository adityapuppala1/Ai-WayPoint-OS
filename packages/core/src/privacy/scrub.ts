/**
 * Text that goes where other people will read it — server logs, emails sent in someone's name —
 * with personal details and secrets taken out.
 */
import { redactPII } from './redact';

/**
 * For logs: database errors repeat the values of the failed statement after `params:`, links
 * carry one-time tokens, and messages can contain addresses or numbers. All of that goes.
 */
export function scrubLogText(text: string, max = 500): string {
  const cut = text.split(/\n\s*params:/i)[0] ?? '';
  const noTokens = cut.replace(
    /([?&;](?:token|code|otp|secret|key|signature|sig)=)[^&\s"']+/gi,
    '$1[redacted]',
  );
  return redactPII(noTokens.slice(0, 4000)).text.slice(0, max);
}

/**
 * Control, zero-width, direction-changing and other invisible characters (ranges of code
 * points): soft hyphen, combining grapheme joiner, Arabic letter mark, Hangul and Khmer
 * fillers, Mongolian separators, word joiners and invisible operators, byte-order marks and
 * interlinear annotations. Variation selectors stay, so emoji keep their look.
 */
const INVISIBLE = new RegExp(
  `[${(
    [
      [0x00, 0x1f],
      [0x7f, 0x9f],
      [0xad, 0xad],
      [0x34f, 0x34f],
      [0x61c, 0x61c],
      [0x115f, 0x1160],
      [0x17b4, 0x17b5],
      [0x180b, 0x180f],
      [0x200b, 0x200f],
      [0x2028, 0x202e],
      [0x2060, 0x206f],
      [0x3164, 0x3164],
      [0xfeff, 0xfeff],
      [0xffa0, 0xffa0],
      [0xfff9, 0xfffb],
    ] as const
  )
    .map(([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`)
    .join('')}]`,
  'g',
);

/** The full stops of other scripts, which browsers and mail apps read as the dot in an address. */
const DOT = '[.\u3002\uff0e\uff61]';
/**
 * Endings that mail apps turn into links whatever the capitals: the common generic ones and
 * every country ending. ("Dr.Smith" and "St.John" stay names; "Secure-Bank.Com" does not.)
 */
const ENDINGS =
  'com|net|org|info|biz|name|pro|mobi|app|dev|xyz|top|site|online|shop|store|club|link|live|' +
  'click|icu|vip|work|tech|space|website|fun|page|web|cloud|email|support|help|bank|finance|' +
  'money|pay|cash|loan|loans|credit|gov|edu|mil|int|news|blog|life|world|today|network|' +
  'digital|agency|center|company|group|services|solutions|zone|win|bid|trade|review|party|' +
  'date|stream|download|racing|cricket|science|faith|men|kim|zip|mov|cfd|sbs|bond|lol|buzz|' +
  'rest|quest|monster|cyou|africa|asia|wiki|ngo|ong|' +
  'ac|ad|ae|af|ag|ai|al|am|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|' +
  'bs|bt|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cu|cv|cw|cx|cy|cz|de|dj|dk|dm|do|dz|' +
  'ec|ee|eg|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|' +
  'gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|' +
  'ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|' +
  'mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|' +
  'pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|' +
  'td|tf|tg|th|tj|tk|tl|tm|tn|to|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|' +
  'ye|yt|za|zm|zw';
const EDGE_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const EDGE_AFTER = String.raw`(?![\p{L}\p{N}])`;
const WORD = String.raw`[\p{L}\p{N}-]+`;
const PATH = String.raw`(?:/\S*)?`;
/** Anything that reads as a link or a web address. */
const WEB_ADDRESSES: RegExp[] = [
  /\b[a-z][a-z0-9+.-]*:\/\/\S*/giu,
  new RegExp(String.raw`\bwww${DOT}\S*`, 'giu'),
  // Written in small letters, anything.ending is an address whatever the ending.
  new RegExp(
    `${EDGE_BEFORE}[a-z0-9-]+(?:${DOT}[a-z0-9-]+)*${DOT}[a-z]{2,24}${PATH}${EDGE_AFTER}`,
    'gu',
  ),
  // With capitals, only the endings mail apps recognise.
  new RegExp(
    `${EDGE_BEFORE}${WORD}(?:${DOT}${WORD})*${DOT}(?:${ENDINGS})${PATH}${EDGE_AFTER}`,
    'giu',
  ),
];

const oneLine = (text: string) => text.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();

/**
 * Nothing longer than this is a name. The patterns above take time that grows with the square
 * of the length on text such as "a-a-a-…", so longer input is never searched: a request with
 * a quarter of a megabyte in a name field would otherwise keep the server busy for minutes.
 */
const LONGEST_NAME = 300;

/** A full stop between two letters ("Bank.Cam", "банк.рф"): what a mail app turns into a link. */
const DOT_BETWEEN_LETTERS = new RegExp(String.raw`(?<=\p{L})(${DOT})(?=\p{L})`, 'gu');

/**
 * Whether a name or title contains a link or a web address, however it is written. Text too
 * long to be a name counts as one (it is refused either way).
 */
export function hasWebAddress(text: string | null | undefined): boolean {
  if ((text ?? '').length > LONGEST_NAME) return true;
  const line = oneLine(text ?? '');
  return WEB_ADDRESSES.some((re) => {
    re.lastIndex = 0;
    return re.test(line);
  });
}

/**
 * A name (a person's or an organisation's) to put in an email to someone else: one line, no
 * control characters, no links or web addresses — the text of an invitation must never become
 * a way to send people somewhere else from Waypoint's address.
 */
export function plainName(name: string | null | undefined, max = 60): string {
  let noLinks = oneLine((name ?? '').slice(0, LONGEST_NAME));
  for (const re of WEB_ADDRESSES) noLinks = noLinks.replace(re, '…');
  // No list of endings can keep up with every domain, in every alphabet. So whatever is left
  // with a full stop between two letters gets a space after it: "Secure-Bank.Cam" becomes
  // "Secure-Bank. Cam", which no mail app links — and "Dr.Smith" reads "Dr. Smith".
  noLinks = noLinks.replace(DOT_BETWEEN_LETTERS, '$1 ').replace(/\s+/g, ' ').trim();
  return noLinks.length > max ? `${noLinks.slice(0, max - 1).trimEnd()}…` : noLinks;
}
