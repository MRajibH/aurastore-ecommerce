import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession } from '@/lib/auth/session';
import { updateMetaSettings } from '@/lib/meta/settings';

const GRAPH_URL = process.env.META_GRAPH_API_URL || 'https://graph.facebook.com/v21.0';

/**
 * Completes the Facebook Login for Business / Meta Business Extension (MBE)
 * onboarding. The client obtains an authorization `code` via the FB JS SDK
 * (FB.login with a config_id) and posts it here. We exchange it server-side for
 * a long-lived business token and persist the connected assets.
 *
 * NOTE: This requires a registered Meta App (FACEBOOK_APP_ID + FACEBOOK_APP_SECRET)
 * that has passed App Review for the relevant permissions, plus a public HTTPS
 * redirect URI. Without those it returns 501 so the dashboard can fall back to
 * the manual configuration form.
 */
const connectSchema = z.object({
  code: z.string().min(1).optional(),
  // The SDK/MBE flow can also hand back already-resolved asset ids directly.
  pixelId: z.string().max(64).optional(),
  catalogId: z.string().max(64).optional(),
  pageId: z.string().max(64).optional(),
  businessId: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  const session = await validateSession();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  const { code, pixelId, catalogId, pageId, businessId } = parsed.data;

  if (code) {
    if (!appId || !appSecret || !redirectUri) {
      return NextResponse.json(
        {
          error:
            'Facebook App is not configured on the server. Set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET and FACEBOOK_REDIRECT_URI, or use manual configuration.',
        },
        { status: 501 },
      );
    }

    try {
      // Exchange the authorization code for an access token.
      const tokenUrl = new URL(`${GRAPH_URL}/oauth/access_token`);
      tokenUrl.searchParams.set('client_id', appId);
      tokenUrl.searchParams.set('client_secret', appSecret);
      tokenUrl.searchParams.set('redirect_uri', redirectUri);
      tokenUrl.searchParams.set('code', code);

      const tokenRes = await fetch(tokenUrl.toString());
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok || !tokenJson.access_token) {
        console.error('FB token exchange failed:', tokenJson);
        return NextResponse.json({ error: 'Token exchange failed' }, { status: 400 });
      }

      updateMetaSettings({
        capiAccessToken: tokenJson.access_token,
        pixelId: pixelId ?? null,
        catalogId: catalogId ?? null,
        pageId: pageId ?? null,
        businessId: businessId ?? null,
        connectedAt: Date.now(),
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('FB connect error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }

  // Direct asset handoff (no code exchange) — persist whatever the SDK returned.
  updateMetaSettings({
    pixelId: pixelId ?? undefined,
    catalogId: catalogId ?? undefined,
    pageId: pageId ?? undefined,
    businessId: businessId ?? undefined,
    connectedAt: Date.now(),
  });

  return NextResponse.json({ success: true });
}
