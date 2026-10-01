/**
 * What someone types before the page's script has arrived.
 *
 * Every page is sent ready to read and its script follows. On a slow connection that gap can
 * be seconds, with the fields already on screen. React then starts each field from its own
 * empty state and wipes what was typed, leaving the button under it switched off. So a few
 * lines sent inside the page itself note what is typed into which field, and once React is
 * running `keepEarlyInput` hands each value over as if it had just been typed.
 *
 * Only text that was typed is kept: ticks and presses made in the gap are not replayed.
 */

type EarlyField = HTMLInputElement | HTMLTextAreaElement;

declare global {
  interface Window {
    __wpEarly?: { typed: Map<EarlyField, string>; stop: () => void };
  }
}

/**
 * Runs in the page before anything else can (see the root layout). Plain old JavaScript, no
 * "&" or "<": it is sent with every page, exactly as written.
 */
export const EARLY_INPUT_SCRIPT = `(function(){
var typed=new Map();
var skip=/^(checkbox|radio|file|button|submit|reset|image|hidden|range|color)$/;
function note(e){
var el=e.target;
if(!el)return;
if(el.tagName==='TEXTAREA')typed.set(el,el.value);
else if(el.tagName==='INPUT'){if(!skip.test(el.type))typed.set(el,el.value)}
}
addEventListener('input',note,true);
window.__wpEarly={typed:typed,stop:function(){removeEventListener('input',note,true)}};
})();`;

/** Tells React that `field` now holds `value`, the way typing it would. */
function handOver(field: EarlyField, value: string): void {
  const proto =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setRaw = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (!setRaw) return;
  const focused = document.activeElement === field;
  let caret: [number | null, number | null] | null = null;
  try {
    if (focused) caret = [field.selectionStart, field.selectionEnd];
  } catch {
    // Email and number fields have no caret position to read.
  }
  // React calls onChange only when a field's value differs from the one it last noted. So
  // first give it a different value through the setter it watches, then put the real one in
  // underneath, where it isn't looking, and say "input".
  field.value = value === '' ? ' ' : '';
  setRaw.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  try {
    if (caret && caret[0] !== null) field.setSelectionRange(caret[0], caret[1]);
  } catch {
    // As above.
  }
}

/** Called once, when React has taken the page over. Safe to call when nothing was typed. */
export function keepEarlyInput(): void {
  const early = window.__wpEarly;
  if (!early) return;
  early.stop();
  delete window.__wpEarly;
  for (const [field, value] of early.typed) {
    // A field React replaced while taking over is gone, and what was in it with it.
    if (field.isConnected) handOver(field, value);
  }
}
