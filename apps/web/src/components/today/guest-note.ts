/**
 * The cookie that remembers a guest pressed "Not now" on the note about where their data
 * lives. A display choice, like the theme: it holds the one word "off" and nothing about the
 * person. Plain module (no 'use client'), so the server page and the note both read the name.
 */
export const GUEST_NOTE_COOKIE = 'wp-guest-note';
