import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession } from '@/lib/auth/session';
import { sendCapiEvent, extractUserDataFromRequest } from '@/lib/meta/capi';
import { hasConsent } from '@/lib/consent';

const trackSchema = z.object({
  eventName: z.enum(['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'Search']),
  eventId: z.string().min(1).max(200),
  eventSourceUrl: z.string().url().optional(),
  customData: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    // Respect cookie consent — never process marketing events without it.
    if (!hasConsent(request)) {
      return NextResponse.json({ success: true, sent: false, reason: 'no_consent' });
    }

    const body = await request.json();
    const result = trackSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { eventName, eventId, eventSourceUrl, customData } = result.data;

    // Attach the authenticated identity (if any) for advanced matching. The
    // email/id are hashed inside sendCapiEvent before leaving the server.
    const session = await validateSession();
    const userData = extractUserDataFromRequest(request, {
      email: session?.user.email ?? null,
      externalId: session?.user.id ?? null,
    });

    const capiResult = await sendCapiEvent({
      eventName,
      eventId,
      eventSourceUrl,
      userData,
      customData,
    });

    // Never fail the client flow because tracking failed; report status only.
    return NextResponse.json({ success: true, sent: capiResult.sent, reason: capiResult.reason });
  } catch (error) {
    console.error('Meta track error:', error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
