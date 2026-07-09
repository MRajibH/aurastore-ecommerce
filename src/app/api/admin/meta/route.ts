import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession } from '@/lib/auth/session';
import { getMetaSettings, updateMetaSettings } from '@/lib/meta/settings';

// All fields optional so the dashboard can patch a subset. Empty strings clear
// a value; a missing key leaves it unchanged.
const settingsSchema = z.object({
  pixelId: z.string().max(64).optional(),
  capiAccessToken: z.string().max(1024).optional(),
  catalogId: z.string().max(64).optional(),
  brandName: z.string().max(120).optional(),
  siteUrl: z.string().url().or(z.literal('')).optional(),
  testEventCode: z.string().max(64).optional(),
  businessId: z.string().max(64).optional(),
  pageId: z.string().max(64).optional(),
});

/** Redacted view safe to return to the browser (never expose the secret token). */
function publicView() {
  const s = getMetaSettings();
  return {
    pixelId: s.pixelId,
    catalogId: s.catalogId,
    brandName: s.brandName,
    siteUrl: s.siteUrl,
    businessId: s.businessId,
    pageId: s.pageId,
    testEventCode: s.testEventCode,
    hasAccessToken: !!s.capiAccessToken,
    connectedAt: s.connectedAt,
  };
}

export async function GET() {
  const session = await validateSession();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(publicView());
}

export async function POST(request: Request) {
  const session = await validateSession();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const result = settingsSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  for (const [key, value] of Object.entries(result.data)) {
    if (value === undefined) continue;
    // Don't overwrite a stored access token with an empty string on save.
    if (key === 'capiAccessToken' && value === '') continue;
    patch[key] = value;
  }

  updateMetaSettings(patch);
  return NextResponse.json({ success: true, settings: publicView() });
}
