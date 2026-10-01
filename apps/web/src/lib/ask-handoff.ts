/**
 * Handing what someone typed elsewhere (the go-to palette) to Ask: the words wait in memory,
 * and fill Ask's message box once that box is on the page. They are never sent on their own
 * and never put in an address or in storage, so a reload or quick exit simply forgets them.
 *
 * Ask's message box is its composer form's text area. The words go in as if typed, so Ask's
 * own state (and its Send button) follows. A box someone has already started writing in is
 * left alone.
 *
 * The words fill one box, once: the new box that going to Ask puts on the page. After that
 * they are the person's. If they clear them, start a new conversation, or leave Ask and come
 * back, nothing brings the words back.
 */

/** How long the words wait for Ask's page to arrive. */
const WAIT_MS = 8000;

const valueSetter = () =>
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

const composer = () => document.querySelector<HTMLTextAreaElement>('main form textarea');

/** Focus the box once no dialog is open, so the one that just closed does not take it back. */
function focusWhenFree(box: HTMLTextAreaElement) {
  const since = performance.now();
  const attempt = () => {
    if (!box.isConnected) return;
    if (!document.querySelector('[role="dialog"]')) {
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    } else if (performance.now() - since < 1500) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
}

export function prefillAsk(text: string): void {
  if (typeof document === 'undefined' || !text.trim()) return;
  // Ask may already be open: going there again replaces its box with a new conversation's,
  // and that one gets the words.
  const before = composer();
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== '/ask') return;
    const box = composer();
    if (!box || box === before) return;
    stop();
    if (box.value.trim()) return;
    valueSetter()?.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    focusWhenFree(box);
  });
  const timer = window.setTimeout(() => observer.disconnect(), WAIT_MS);
  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timer);
  };
  observer.observe(document.body, { childList: true, subtree: true });
}
