/**
 * Handing what someone typed elsewhere (the go-to palette) to Ask: the words wait in memory,
 * and fill Ask's message box once that box is on the page. They are never sent on their own
 * and never put in an address or in storage, so a reload or quick exit simply forgets them.
 *
 * Ask's message box is its composer form's text area. The words go in as if typed, so Ask's
 * own state (and its Send button) follows. A box someone has already started writing in is
 * left alone.
 */

/** How long the words wait for Ask's page to arrive. */
const WAIT_MS = 8000;

const valueSetter = () =>
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

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
  const filled = new WeakSet<HTMLTextAreaElement>();
  const fill = () => {
    if (window.location.pathname !== '/ask') return;
    const box = document.querySelector<HTMLTextAreaElement>('main form textarea');
    if (!box || filled.has(box)) return;
    filled.add(box);
    if (box.value.trim()) return;
    valueSetter()?.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    focusWhenFree(box);
  };
  // Ask may already be open (a new conversation replaces its box) or still on its way.
  const observer = new MutationObserver(fill);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), WAIT_MS);
  fill();
}
