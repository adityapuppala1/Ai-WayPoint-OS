/**
 * Phone numbers and codes inside right-to-left text. Without help, Arabic text reorders the
 * groups of "+254 722 178 177" into "177 178 722 254+" — a wrong number for someone in crisis.
 * Unicode isolates keep each number left to right, whatever the language around it; they are
 * invisible and change nothing in left-to-right languages.
 */
const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);

/** One number or code, kept left to right. */
export const ltr = (value: string): string => `${LRI}${value}${PDI}`;

/** Every phone number, short code or USSD code inside a sentence. */
export function isolateNumbers(text: string): string {
  return text.replace(/[+*#]?\d[\d\s().*#-]*\d#?|\*\d+#/g, (m) => ltr(m));
}
