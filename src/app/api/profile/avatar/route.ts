import { NextResponse } from 'next/server';
import db from '@/lib/db/client';
import { validateSession } from '@/lib/auth/session';
import { saveImageUpload } from '@/lib/uploads';

export async function POST(request: Request) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const result = await saveImageUpload(formData.get('file'), 'avatars');
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(result.url, session.user.id);

    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
