// Client-side helpers for Facebook (Meta) Pixel event tracking.
//
// The Pixel is only active when NEXT_PUBLIC_FACEBOOK_PIXEL_ID is set in the
// environment. When it is unset, fbTrack() is a safe no-op so the app works
// unchanged in local/dev without a Pixel configured.

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq?: (...args: any[]) => void;
  }
}

import { getConsent } from './consent';

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;

/**
 * Fire a standard or custom Pixel event (e.g. PageView). No-ops on the server
 * or before the Pixel base code has loaded.
 */
export function fbTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('track', event, params);
}

/** Generate a unique event id used to dedupe a browser event against its CAPI twin. */
function newEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

/**
 * Fire the browser Pixel AND the server-side Conversions API for the same event
 * using a shared event_id, so Meta deduplicates the two into one. Pass the same
 * content_ids/content_type here as in the catalog feed's <g:id>.
 *
 * Returns the generated event_id (useful when the caller wants to reuse it).
 */
export function fbTrackWithCapi(
  event: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'Search',
  customData?: Record<string, unknown>,
): string {
  const eventId = newEventId();
  if (typeof window === 'undefined') return eventId;

  // Respect cookie consent: fire no marketing events until the user opts in.
  if (getConsent() !== 'granted') return eventId;

  // 1. Browser Pixel (with eventID for dedup)
  if (typeof window.fbq === 'function') {
    window.fbq('track', event, customData, { eventID: eventId });
  }

  // 2. Server-side CAPI twin (fire-and-forget; keepalive survives navigation)
  try {
    fetch('/api/meta/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: event,
        eventId,
        eventSourceUrl: window.location.href,
        customData,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }

  return eventId;
}

/**
 * Fire ONLY the browser Pixel with a caller-supplied event_id. Used when the
 * server has already sent the CAPI event (e.g. Purchase fired from the checkout
 * API) and we just need the browser half to dedupe against it.
 */
export function fbTrackBrowser(
  event: string,
  customData: Record<string, unknown>,
  eventId: string,
) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  if (getConsent() !== 'granted') return;
  window.fbq('track', event, customData, { eventID: eventId });
}
