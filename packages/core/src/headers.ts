/**
 * Request headers that Waypoint's own apps send to its API.
 */

/**
 * Sent with a sign-in when the person asks to bring what they did as a guest on this device
 * into the account they are signing in to. Without it, only the account created from that
 * guest session receives it: on a shared device, the guest may have been someone else.
 */
export const KEEP_GUEST_HEADER = 'x-waypoint-keep-guest';
