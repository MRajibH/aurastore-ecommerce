import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession } from '@/lib/auth/session';
import { setThemeSkin, SKINS, type ThemeSkin } from '@/lib/theme';

const bodySchema = z.object({
  skin: z.enum(SKINS.map((s) => s.id) as [ThemeSkin, ...ThemeSkin[]]),
});

export async function POST(request: Request) {
  try {
    // Require an authenticated administrator.
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = bodySchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid theme selection' }, { status: 400 });
    }

    // `skin` is validated against the registry by the enum above.
    setThemeSkin(result.data.skin);
    return NextResponse.json({ success: true, skin: result.data.skin });
  } catch (error) {
    console.error('Update theme error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
