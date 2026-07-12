import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { saveImageUpload, saveVideoUpload } from '@/lib/uploads';

export async function POST(request: Request) {
  try {
    // Authenticate and require administrator role
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const kind = formData.get('kind');
    const result =
      kind === 'video'
        ? await saveVideoUpload(formData.get('file'))
        : await saveImageUpload(formData.get('file'), 'products');
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
