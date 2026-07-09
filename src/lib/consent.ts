// Cookie-consent state shared by the client banner, the Meta Pixel, and the
// server-side CAPI routes. Consent gates ALL Meta tracking (browser + server)
// so the store is GDPR/CPRA-friendly by default.

export const CONSENT_COOKIE = 'aura_consent';
export type ConsentValue = 'granted' | 'denied';

/** Read consent on the client (returns null if the user hasn't chosen yet). */
export function getConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null;
  return parseConsent(document.cookie);
}

/** Persist the user's choice for a year and broadcast it to listeners. */
export function setConsent(value: ConsentValue): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  window.dispatchEvent(new CustomEvent('aura-consent-changed', { detail: value }));
}

/** Parse a Cookie header (or document.cookie) for the consent value. */
export function parseConsent(cookieHeader: string | null | undefined): ConsentValue | null {
  if (!cookieHeader) return null;
  const match = new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]+)`).exec(cookieHeader);
  const value = match?.[1];
  return value === 'granted' || value === 'denied' ? value : null;
}

/** Server-side: has this request granted marketing consent? */
export function hasConsent(request: Request): boolean {
  return parseConsent(request.headers.get('cookie')) === 'granted';
}
