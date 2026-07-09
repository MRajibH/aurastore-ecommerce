import crypto from 'crypto';
import { getMetaSettings } from './settings';

// Overridable so tests can point at a local mock instead of Meta's servers.
const GRAPH_URL = process.env.META_GRAPH_API_URL || 'https://graph.facebook.com/v21.0';

/**
 * SHA-256 hash of a normalized PII value, as required by Meta for advanced
 * matching (email, phone, external_id, etc.). Returns undefined for empty input.
 */
export function hashData(value?: string | null): string | undefined {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export interface CapiUserData {
  email?: string | null;
  externalId?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export interface CapiEvent {
  eventName: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'PageView' | 'Search';
  eventId: string;                 // MUST match the browser Pixel eventID for dedup
  eventTime?: number;              // unix seconds
  eventSourceUrl?: string | null;
  actionSource?: string;
  userData: CapiUserData;
  customData?: Record<string, unknown>;
}

export interface CapiResult {
  sent: boolean;
  reason?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response?: any;
}

/**
 * Extract the standard matching signals (IP, user agent, fbp/fbc cookies) from
 * an incoming request, optionally merged with a known email / external id.
 */
export function extractUserDataFromRequest(
  request: Request,
  extra?: { email?: string | null; externalId?: string | null }
): CapiUserData {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  const clientIpAddress = forwarded ? forwarded.split(',')[0].trim() : headers.get('x-real-ip') || undefined;
  const clientUserAgent = headers.get('user-agent') || undefined;

  const cookie = headers.get('cookie') || '';
  const fbp = /_fbp=([^;]+)/.exec(cookie)?.[1];
  const fbc = /_fbc=([^;]+)/.exec(cookie)?.[1];

  return {
    clientIpAddress,
    clientUserAgent,
    fbp,
    fbc,
    email: extra?.email ?? null,
    externalId: extra?.externalId ?? null,
  };
}

/**
 * Fire a single server-side Conversions API event. No-ops (sent:false) when the
 * Pixel ID or access token is not configured, so the app runs fine unconnected.
 */
export async function sendCapiEvent(event: CapiEvent): Promise<CapiResult> {
  const settings = getMetaSettings();
  if (!settings.pixelId || !settings.capiAccessToken) {
    return { sent: false, reason: 'not_configured' };
  }

  const user_data: Record<string, unknown> = {};
  const em = hashData(event.userData.email);
  const externalId = hashData(event.userData.externalId);
  if (em) user_data.em = [em];
  if (externalId) user_data.external_id = [externalId];
  if (event.userData.clientIpAddress) user_data.client_ip_address = event.userData.clientIpAddress;
  if (event.userData.clientUserAgent) user_data.client_user_agent = event.userData.clientUserAgent;
  if (event.userData.fbp) user_data.fbp = event.userData.fbp;
  if (event.userData.fbc) user_data.fbc = event.userData.fbc;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        event_source_url: event.eventSourceUrl ?? undefined,
        action_source: event.actionSource ?? 'website',
        user_data,
        custom_data: event.customData,
      },
    ],
  };
  if (settings.testEventCode) payload.test_event_code = settings.testEventCode;

  const url = `${GRAPH_URL}/${settings.pixelId}/events?access_token=${encodeURIComponent(settings.capiAccessToken)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Meta CAPI error:', JSON.stringify(json));
      return { sent: false, reason: 'api_error', response: json };
    }
    return { sent: true, response: json };
  } catch (err) {
    console.error('Meta CAPI request failed:', err);
    return { sent: false, reason: 'request_failed' };
  }
}
