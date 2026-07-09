import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db/client';
import { validateSession } from '@/lib/auth/session';

const slideSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  subtitle: z.string().min(5, 'Subtitle must be at least 5 characters'),
  image_url: z.string().min(1, 'Image URL/path is required'),
  link_url: z.string().min(1, 'Link URL/path is required'),
  display_order: z.number().int().nonnegative('Display order must be a non-negative integer'),
  is_active: z.number().int().min(0).max(1)
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = slideSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { title, subtitle, image_url, link_url, display_order, is_active } = result.data;

    const info = db.prepare(`
      UPDATE carousel_slides
      SET title = ?, subtitle = ?, image_url = ?, link_url = ?, display_order = ?, is_active = ?
      WHERE id = ?
    `).run(title, subtitle, image_url, link_url, display_order, is_active, id);

    if (info.changes === 0) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update carousel slide error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const info = db.prepare('DELETE FROM carousel_slides WHERE id = ?').run(id);
    if (info.changes === 0) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete carousel slide error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
