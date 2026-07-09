import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db/client';
import { validateSession } from '@/lib/auth/session';
import crypto from 'crypto';

const slideSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  subtitle: z.string().min(5, 'Subtitle must be at least 5 characters'),
  image_url: z.string().min(1, 'Image URL/path is required'),
  link_url: z.string().min(1, 'Link URL/path is required'),
  display_order: z.number().int().nonnegative('Display order must be a non-negative integer'),
  is_active: z.number().int().min(0).max(1)
});

export async function GET() {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const slides = db.prepare('SELECT * FROM carousel_slides ORDER BY display_order ASC').all();
    return NextResponse.json(slides);
  } catch (error) {
    console.error('Fetch carousel slides error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult || sessionResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = slideSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { title, subtitle, image_url, link_url, display_order, is_active } = result.data;
    const slideId = 's_' + crypto.randomUUID().substring(0, 8);

    db.prepare(`
      INSERT INTO carousel_slides (id, title, subtitle, image_url, link_url, display_order, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slideId, title, subtitle, image_url, link_url, display_order, is_active, Date.now());

    return NextResponse.json({ success: true, slideId });
  } catch (error) {
    console.error('Create carousel slide error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
